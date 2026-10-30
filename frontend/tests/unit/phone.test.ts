import { describe, it, expect } from "vitest";
import { normalizePhone, waIdToE164 } from "@/server/lib/phone.ts";

describe("normalizePhone", () => {
  it("normalizes a 10-digit Indian mobile", () => {
    expect(normalizePhone("8127211407")).toBe("+918127211407");
  });
  it("handles spaces and dashes", () => {
    expect(normalizePhone("81272-11407")).toBe("+918127211407");
  });
  it("handles a leading 0", () => {
    expect(normalizePhone("08127211407")).toBe("+918127211407");
  });
  it("handles a 91 country code", () => {
    expect(normalizePhone("918127211407")).toBe("+918127211407");
  });
  it("rejects clearly invalid numbers", () => {
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("waIdToE164", () => {
  it("prefixes a plus", () => {
    expect(waIdToE164("918127211407")).toBe("+918127211407");
  });
});
