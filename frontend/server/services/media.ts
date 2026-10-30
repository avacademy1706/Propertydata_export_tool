import { randomUUID } from "node:crypto";
import type { Prisma, MediaType } from "@/generated/prisma/client.ts";
import { prisma } from "@/server/db/client.ts";
import { getConfig } from "@/server/config/env.ts";
import { getStorage } from "@/server/storage/index.ts";
import { sha256Hex } from "@/server/lib/hash.ts";
import { ValidationError } from "@/server/lib/errors.ts";
import { logger } from "@/server/lib/logger.ts";

const ALLOWED_MIME: Record<string, { type: MediaType; ext: string }> = {
  "image/jpeg": { type: "IMAGE", ext: "jpg" },
  "image/png": { type: "IMAGE", ext: "png" },
  "image/webp": { type: "IMAGE", ext: "webp" },
  "video/mp4": { type: "VIDEO", ext: "mp4" },
  "video/3gpp": { type: "VIDEO", ext: "3gp" },
  "video/quicktime": { type: "VIDEO", ext: "mov" },
  "application/pdf": { type: "DOCUMENT", ext: "pdf" },
};

export interface StoreMediaInput {
  tenantId: string;
  buffer: Buffer;
  mimeType: string;
  provider: "WHATSAPP" | "MANUAL";
  providerMediaId?: string | null;
  originalFilename?: string | null;
  caption?: string | null;
  sourceMessageId?: string | null;
  linkToBuyerIds?: string[];
  linkToSellerIds?: string[];
}

/**
 * Validates, deduplicates (by checksum), stores, and links a media file.
 * The real content type is sniffed; the filename extension is never trusted.
 */
export async function storeMediaBuffer(input: StoreMediaInput) {
  const cfg = getConfig().media;
  if (input.buffer.byteLength > cfg.maxFileBytes) {
    throw new ValidationError(`File exceeds the ${Math.round(cfg.maxFileBytes / 1024 / 1024)} MB limit.`);
  }

  // Sniff real type from the bytes; fall back to the declared type.
  let detectedMime = input.mimeType;
  try {
    const { fileTypeFromBuffer } = await import("file-type");
    const sniffed = await fileTypeFromBuffer(input.buffer);
    if (sniffed?.mime) detectedMime = sniffed.mime;
  } catch {
    // file-type is best-effort; keep the declared type.
  }
  const allowed = ALLOWED_MIME[detectedMime] ?? ALLOWED_MIME[input.mimeType];
  if (!allowed) {
    throw new ValidationError(`Unsupported media type: ${detectedMime}`);
  }

  const checksum = sha256Hex(input.buffer);
  const existing = await prisma.mediaAttachment.findFirst({
    where: { tenantId: input.tenantId, checksum, deletedAt: null },
  });
  if (existing) {
    await linkMedia(existing.id, input.linkToBuyerIds, input.linkToSellerIds);
    return existing;
  }

  const id = randomUUID();
  const storedFilename = `${id}.${allowed.ext}`;
  const storageKey = `${input.tenantId}/${allowed.type.toLowerCase()}/${storedFilename}`;

  let width: number | null = null;
  let height: number | null = null;
  let thumbnailKey: string | null = null;
  if (allowed.type === "IMAGE") {
    try {
      const sharp = (await import("sharp")).default;
      const image = sharp(input.buffer);
      const meta = await image.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      const thumb = await image.clone().resize(400, 400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
      thumbnailKey = `${input.tenantId}/thumbnails/${id}.jpg`;
      await getStorage().put(thumbnailKey, thumb, "image/jpeg");
    } catch (err) {
      logger.warn("thumbnail generation failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  await getStorage().put(storageKey, input.buffer, detectedMime);

  const record = await prisma.mediaAttachment.create({
    data: {
      id,
      tenantId: input.tenantId,
      sourceMessageId: input.sourceMessageId ?? null,
      provider: input.provider,
      providerMediaId: input.providerMediaId ?? null,
      originalFilename: input.originalFilename ?? null,
      storedFilename,
      storageKey,
      thumbnailKey,
      mimeType: detectedMime,
      mediaType: allowed.type,
      fileSizeBytes: input.buffer.byteLength,
      caption: input.caption ?? null,
      width,
      height,
      checksum,
      uploadStatus: "STORED",
    },
  });

  await linkMedia(record.id, input.linkToBuyerIds, input.linkToSellerIds);
  return record;
}

export async function linkMedia(mediaId: string, buyerIds?: string[], sellerIds?: string[]): Promise<void> {
  const links: Prisma.MediaLinkCreateManyInput[] = [];
  for (const buyerId of buyerIds ?? []) links.push({ mediaId, buyerId });
  for (const sellerId of sellerIds ?? []) links.push({ mediaId, sellerId });
  if (links.length) {
    await prisma.mediaLink.createMany({ data: links, skipDuplicates: true });
  }
}

export async function getMediaBuffer(tenantId: string, mediaId: string, thumbnail = false) {
  const media = await prisma.mediaAttachment.findFirst({ where: { id: mediaId, tenantId, deletedAt: null } });
  if (!media) return null;
  const key = thumbnail && media.thumbnailKey ? media.thumbnailKey : media.storageKey;
  const buffer = await getStorage().get(key);
  return { buffer, mimeType: thumbnail && media.thumbnailKey ? "image/jpeg" : media.mimeType, media };
}

export async function softDeleteMedia(tenantId: string, mediaId: string): Promise<boolean> {
  const media = await prisma.mediaAttachment.findFirst({ where: { id: mediaId, tenantId, deletedAt: null } });
  if (!media) return false;
  // Detach from records (so it stops appearing) but keep the row for audit.
  await prisma.mediaLink.deleteMany({ where: { mediaId: media.id } });
  await prisma.mediaAttachment.update({ where: { id: media.id }, data: { deletedAt: new Date(), uploadStatus: "DELETED" } });
  return true;
}
