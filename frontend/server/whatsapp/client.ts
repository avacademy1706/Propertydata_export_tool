import { getConfig } from "@/server/config/env.ts";
import { logger } from "@/server/lib/logger.ts";

/**
 * Thin WhatsApp Cloud API client. Access tokens are used only here, server-side,
 * and never returned to the frontend. All calls no-op when WhatsApp is not
 * configured so the rest of the app keeps working.
 */

function graphBase(): string | null {
  const cfg = getConfig().whatsapp;
  if (!cfg.configured) return null;
  return `https://graph.facebook.com/${cfg.graphApiVersion}`;
}

export interface MediaDownload {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
}

/** Step 1 + 2 of the media flow: resolve the temporary URL, then download it. */
export async function downloadMedia(mediaId: string): Promise<MediaDownload | null> {
  const base = graphBase();
  const cfg = getConfig().whatsapp;
  if (!base || !cfg.accessToken) return null;

  const metaRes = await fetch(`${base}/${mediaId}`, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
  });
  if (!metaRes.ok) {
    logger.warn("media metadata fetch failed", { mediaId, status: metaRes.status });
    return null;
  }
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!meta.url) return null;

  // The temporary URL also requires the access token (valid ~5 minutes).
  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
  if (!fileRes.ok) {
    logger.warn("media download failed", { mediaId, status: fileRes.status });
    return null;
  }
  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    buffer,
    mimeType: meta.mime_type ?? fileRes.headers.get("content-type") ?? "application/octet-stream",
    sizeBytes: meta.file_size ?? buffer.byteLength,
  };
}

/** Sends a plain text message (used for acknowledgements). Respects config flag. */
export async function sendTextMessage(toWaId: string, body: string): Promise<boolean> {
  const base = graphBase();
  const cfg = getConfig().whatsapp;
  if (!base || !cfg.accessToken || !cfg.phoneNumberId) return false;
  if (!cfg.sendAcknowledgements) return false;

  const res = await fetch(`${base}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toWaId,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  if (!res.ok) {
    logger.warn("acknowledgement send failed", { status: res.status });
    return false;
  }
  return true;
}

export const ACK_MESSAGES = {
  success: "Your property details have been received and structured successfully.",
  needsReview: "We received your message, but a few details need confirmation. Please check the dashboard.",
  unclear: "We could not identify this message as a buyer requirement or property listing. Please send a little more detail.",
};
