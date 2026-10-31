import { withErrorHandling, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { storeMediaBuffer } from "@/server/services/media.ts";
import { ValidationError } from "@/server/lib/errors.ts";

export const runtime = "nodejs";
// Thumbnailing + uploading to object storage can take a while for large files.
export const maxDuration = 60;

export const POST = withErrorHandling(async (request: Request) => {
  const { tenantId } = await getTenantContext();
  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const single = form.get("file");
  if (single instanceof File) files.push(single);
  if (files.length === 0) throw new ValidationError("No files provided.");

  const buyerId = typeof form.get("buyerId") === "string" ? (form.get("buyerId") as string) : undefined;
  const sellerId = typeof form.get("sellerId") === "string" ? (form.get("sellerId") as string) : undefined;

  const stored = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const media = await storeMediaBuffer({
      tenantId,
      buffer,
      mimeType: file.type || "application/octet-stream",
      provider: "MANUAL",
      originalFilename: file.name,
      linkToBuyerIds: buyerId ? [buyerId] : [],
      linkToSellerIds: sellerId ? [sellerId] : [],
    });
    stored.push({ id: media.id, mediaType: media.mediaType, url: `/api/media/${media.id}` });
  }
  return ok({ media: stored });
});
