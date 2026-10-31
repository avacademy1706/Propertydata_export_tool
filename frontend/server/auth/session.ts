import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "@/server/config/env.ts";

/**
 * Minimal stateless session: a signed cookie carrying the user's email and an
 * expiry. Signed with AUTH_SECRET (HMAC-SHA256). This is a single-admin auth for
 * the frontend; the production backend owns real user accounts (see the backend
 * spec). No secrets or passwords are ever put in the token.
 */

export const SESSION_COOKIE = "pd_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(email: string): string {
  const { secret } = getConfig().auth;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = b64url(JSON.stringify({ email: email.toLowerCase(), exp }));
  const sig = sign(payload, secret ?? "");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): { email: string } | null {
  if (!token) return null;
  const { secret } = getConfig().auth;
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; exp?: number };
    if (!data.email || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

/** Constant-time check of email + password against the configured admin. */
export function verifyCredentials(email: string, password: string): boolean {
  const { adminEmail, password: adminPassword } = getConfig().auth;
  if (!adminPassword) return false;
  const emailOk = email.trim().toLowerCase() === adminEmail;
  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);
  const passwordOk = a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  return emailOk && passwordOk;
}

export function sessionCookieOptions(remove = false) {
  const isProd = getConfig().isProduction;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: remove ? 0 : SESSION_TTL_SECONDS,
  };
}
