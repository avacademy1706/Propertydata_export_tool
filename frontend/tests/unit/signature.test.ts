import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWhatsappSignature, verifyWebhookChallenge } from "@/server/whatsapp/signature.ts";

const SECRET = "test-app-secret";
const BODY = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

function sign(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyWhatsappSignature", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyWhatsappSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyWhatsappSignature(BODY + " ", sign(BODY, SECRET), SECRET)).toBe(false);
  });
  it("rejects a wrong secret", () => {
    expect(verifyWhatsappSignature(BODY, sign(BODY, "other"), SECRET)).toBe(false);
  });
  it("rejects a missing header", () => {
    expect(verifyWhatsappSignature(BODY, null, SECRET)).toBe(false);
  });
});

describe("verifyWebhookChallenge", () => {
  it("returns the challenge when the token matches", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "verify-123",
      "hub.challenge": "CHALLENGE",
    });
    expect(verifyWebhookChallenge(params, "verify-123")).toEqual({ ok: true, challenge: "CHALLENGE" });
  });
  it("fails on a wrong token", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "CHALLENGE",
    });
    expect(verifyWebhookChallenge(params, "verify-123")).toEqual({ ok: false });
  });
});
