import { getConfig } from "@/server/config/env.ts";
import { prisma } from "@/server/db/client.ts";
import { verifyWebhookChallenge, verifyWhatsappSignature } from "@/server/whatsapp/signature.ts";
import { parseWebhookPayload } from "@/server/whatsapp/webhook.ts";
import { handleInboundMessage } from "@/server/whatsapp/inbound.ts";
import type { WhatsappWebhookPayload } from "@/server/whatsapp/types.ts";
import { logger } from "@/server/lib/logger.ts";

export const runtime = "nodejs";

/** GET: Meta webhook verification handshake. */
export async function GET(request: Request): Promise<Response> {
  const cfg = getConfig().whatsapp;
  if (!cfg.verifyToken) {
    return new Response("WhatsApp webhook is not configured.", { status: 503 });
  }
  const url = new URL(request.url);
  const result = verifyWebhookChallenge(url.searchParams, cfg.verifyToken);
  if (result.ok) return new Response(result.challenge, { status: 200 });
  return new Response("Verification failed", { status: 403 });
}

/** POST: inbound messages and status updates. Verifies signature, is idempotent. */
export async function POST(request: Request): Promise<Response> {
  const cfg = getConfig().whatsapp;
  const rawBody = await request.text();

  if (!cfg.configured) {
    logger.warn("whatsapp webhook called but not configured");
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  // Validate signature against the raw body.
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWhatsappSignature(rawBody, signature, cfg.appSecret ?? "")) {
    logger.warn("whatsapp webhook signature verification failed");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: WhatsappWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsappWebhookPayload;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const { inbound, statuses } = parseWebhookPayload(payload);

  // Acknowledge quickly; process messages without holding the webhook open.
  const work = (async () => {
    for (const item of inbound) {
      try {
        // Idempotency: skip messages already recorded.
        const seen = await prisma.webhookEvent.findUnique({
          where: { provider_eventKey: { provider: "whatsapp", eventKey: item.message.id } },
        });
        if (seen) continue;
        await prisma.webhookEvent.create({
          data: {
            provider: "whatsapp",
            eventKey: item.message.id,
            eventType: `message.${item.message.type}`,
            payload: { from: item.senderWaId, type: item.message.type } as object,
          },
        });
        await handleInboundMessage(item);
        await prisma.webhookEvent.update({
          where: { provider_eventKey: { provider: "whatsapp", eventKey: item.message.id } },
          data: { outcome: "processed" },
        });
      } catch (err) {
        logger.error("inbound processing error", {
          messageId: item.message.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    for (const status of statuses) {
      logger.debug("status update", { messageId: status.messageId, status: status.status });
    }
  })();

  // Fire-and-forget on a long-running server; also catch to avoid unhandled rejection.
  work.catch((err) => logger.error("webhook work failed", { error: err instanceof Error ? err.message : String(err) }));

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
