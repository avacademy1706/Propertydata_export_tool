import { prisma } from "@/server/db/client.ts";
import { getConfig } from "@/server/config/env.ts";
import { getDefaultTenantId } from "@/server/db/tenant.ts";
import { processMessage } from "@/server/services/ingest.ts";
import { downloadMedia, sendTextMessage, ACK_MESSAGES } from "@/server/whatsapp/client.ts";
import { extractMessageContent } from "@/server/whatsapp/webhook.ts";
import type { ParsedInbound } from "@/server/whatsapp/types.ts";
import { storeMediaBuffer } from "@/server/services/media.ts";
import { waIdToE164 } from "@/server/lib/phone.ts";
import { logger } from "@/server/lib/logger.ts";

/**
 * Resolve the tenant for a WhatsApp sender using the allowed-sender mapping and
 * the configured unknown-sender policy. Returns null when the sender is not
 * authorized and the policy is to reject/hold.
 */
async function resolveSenderTenant(
  senderE164: string,
): Promise<{ tenantId: string | null; held: boolean; reason: string }> {
  const sender = await prisma.authorizedSender.findUnique({ where: { phoneE164: senderE164 } });
  if (sender && sender.status === "APPROVED") return { tenantId: sender.tenantId, held: false, reason: "authorized" };
  if (sender && sender.status === "BLOCKED") return { tenantId: null, held: false, reason: "blocked" };

  const policy = getConfig().whatsapp.unknownSenderPolicy;
  if (policy === "default_tenant") {
    return { tenantId: await getDefaultTenantId(), held: false, reason: "default_tenant" };
  }
  if (policy === "hold") {
    // Record the pending sender so an admin can approve it.
    const tenantId = await getDefaultTenantId();
    await prisma.authorizedSender.upsert({
      where: { phoneE164: senderE164 },
      update: {},
      create: { tenantId, phoneE164: senderE164, status: "PENDING" },
    });
    return { tenantId: null, held: true, reason: "pending_approval" };
  }
  return { tenantId: null, held: false, reason: "rejected" };
}

/** Process a single inbound WhatsApp message end-to-end. Idempotent per message id. */
export async function handleInboundMessage(item: ParsedInbound): Promise<void> {
  const senderE164 = waIdToE164(item.senderWaId) ?? item.senderWaId;
  const { text, media } = extractMessageContent(item.message);

  const { tenantId, held, reason } = await resolveSenderTenant(senderE164);

  if (!tenantId) {
    // Store an unrouted record for audit without writing into any tenant's data.
    logger.info("inbound message not routed", { reason, messageId: item.message.id });
    return;
  }

  // Media-only messages still need a source message; give a placeholder text.
  const messageText = text || (media.length ? "[media message]" : "");
  if (!messageText) {
    logger.info("empty inbound message ignored", { messageId: item.message.id });
    return;
  }

  const result = await processMessage({
    tenantId,
    text: messageText,
    hint: "auto",
    channel: "WHATSAPP",
    externalMessageId: item.message.id,
    senderPhone: senderE164,
    senderName: item.senderName,
    actor: "whatsapp",
  });

  // Download and attach any media (best-effort; never blocks record creation).
  if (media.length && !result.duplicate) {
    for (const m of media) {
      try {
        const download = await downloadMedia(m.id);
        if (!download) continue;
        await storeMediaBuffer({
          tenantId,
          buffer: download.buffer,
          mimeType: download.mimeType,
          provider: "WHATSAPP",
          providerMediaId: m.id,
          originalFilename: m.filename,
          caption: m.caption,
          sourceMessageId: result.messageId,
          linkToBuyerIds: result.createdRecords.filter((r) => r.type === "buyer").map((r) => r.id),
          linkToSellerIds: result.createdRecords.filter((r) => r.type === "seller").map((r) => r.id),
        });
      } catch (err) {
        logger.warn("media attach failed", { messageId: item.message.id, mediaId: m.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  // Optional acknowledgement (respects config; never for duplicates).
  if (!result.duplicate) {
    const ack =
      result.status === "NEEDS_REVIEW"
        ? ACK_MESSAGES.needsReview
        : result.detectedType === "unknown"
          ? ACK_MESSAGES.unclear
          : ACK_MESSAGES.success;
    await sendTextMessage(item.senderWaId, ack).catch(() => undefined);
  }

  void held;
}
