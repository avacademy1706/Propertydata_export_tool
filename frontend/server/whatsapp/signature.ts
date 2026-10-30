import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validates Meta's X-Hub-Signature-256 header against the raw request body
 * using the app secret. Uses a constant-time comparison.
 */
export function verifyWhatsappSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) return false;
  const provided = signatureHeader.slice(expectedPrefix.length);
  const computed = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(computed, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** GET verification challenge handshake. Returns the challenge when valid. */
export function verifyWebhookChallenge(
  params: URLSearchParams,
  verifyToken: string,
): { ok: true; challenge: string } | { ok: false } {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token && challenge && token === verifyToken) {
    return { ok: true, challenge };
  }
  return { ok: false };
}
