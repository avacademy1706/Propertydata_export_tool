import { createHash } from "node:crypto";

/**
 * Content hash used for duplicate detection of pasted/forwarded messages.
 * Whitespace, punctuation and case differences do not change the hash.
 */
export function normalizeForHash(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[​-‏﻿]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function contentHash(text: string): string {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}
