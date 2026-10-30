import type { ParsedInbound, ParsedStatus, WhatsappWebhookPayload } from "@/server/whatsapp/types.ts";

/**
 * Flattens a webhook payload into the inbound messages and status updates we
 * care about. Unsupported event shapes are ignored safely.
 */
export function parseWebhookPayload(payload: WhatsappWebhookPayload): {
  inbound: ParsedInbound[];
  statuses: ParsedStatus[];
} {
  const inbound: ParsedInbound[] = [];
  const statuses: ParsedStatus[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value || value.messaging_product !== "whatsapp") continue;
      const phoneNumberId = value.metadata?.phone_number_id;
      const contactName = value.contacts?.[0]?.profile?.name;

      for (const message of value.messages ?? []) {
        inbound.push({
          phoneNumberId,
          senderWaId: message.from,
          senderName: contactName,
          message,
        });
      }
      for (const status of value.statuses ?? []) {
        statuses.push({ messageId: status.id, status: status.status });
      }
    }
  }
  return { inbound, statuses };
}

/** Extracts human text plus any media reference from an inbound message. */
export function extractMessageContent(message: ParsedInbound["message"]): {
  text: string;
  media: Array<{ kind: "image" | "video" | "document"; id: string; mimeType?: string; caption?: string; filename?: string }>;
} {
  const media: Array<{ kind: "image" | "video" | "document"; id: string; mimeType?: string; caption?: string; filename?: string }> = [];
  let text = "";

  switch (message.type) {
    case "text":
      text = message.text?.body ?? "";
      break;
    case "image":
      if (message.image) {
        media.push({ kind: "image", id: message.image.id, mimeType: message.image.mime_type, caption: message.image.caption });
        text = message.image.caption ?? "";
      }
      break;
    case "video":
      if (message.video) {
        media.push({ kind: "video", id: message.video.id, mimeType: message.video.mime_type, caption: message.video.caption });
        text = message.video.caption ?? "";
      }
      break;
    case "document":
      if (message.document) {
        media.push({ kind: "document", id: message.document.id, mimeType: message.document.mime_type, caption: message.document.caption, filename: message.document.filename });
        text = message.document.caption ?? "";
      }
      break;
    default:
      break;
  }
  return { text, media };
}
