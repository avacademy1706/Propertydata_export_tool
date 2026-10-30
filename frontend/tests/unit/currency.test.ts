import { describe, it, expect } from "vitest";
import { parseAmount, formatINR, basisLabel } from "@/server/normalize/currency.ts";

describe("parseAmount", () => {
  it("parses lakh", () => {
    expect(parseAmount("65 lakh")?.amount).toBe(6_500_000);
  });
  it("parses abbreviated lakh (65L)", () => {
    expect(parseAmount("price 65L only")?.amount).toBe(6_500_000);
  });
  it("parses crore with decimals", () => {
    expect(parseAmount("2.1 cr")?.amount).toBe(21_000_000);
  });
  it("parses crore from 0.65", () => {
    expect(parseAmount("0.65 cr")?.amount).toBe(6_500_000);
  });
  it("parses Indian-grouped numbers", () => {
    expect(parseAmount("65,00,000")?.amount).toBe(6_500_000);
  });
  it("treats per sqft rate as a rate, not a total", () => {
    const r = parseAmount("16k/sqft");
    expect(r?.amount).toBe(16_000);
    expect(r?.basis).toBe("per_sq_ft");
  });
  it("reads ₹16,000 per sq ft", () => {
    const r = parseAmount("₹16,000 per sq ft");
    expect(r?.amount).toBe(16_000);
    expect(r?.basis).toBe("per_sq_ft");
  });
  it("treats rent amounts as monthly", () => {
    const r = parseAmount("35k", { transactionKind: "rent" });
    expect(r?.amount).toBe(35_000);
    expect(r?.basis).toBe("monthly");
  });
  it("flags a suspiciously small bare sale price", () => {
    const r = parseAmount("3000", { transactionKind: "sale" });
    expect(r?.uncertain).toBe(true);
  });
  it("returns null when there is no number", () => {
    expect(parseAmount("east facing, good location")).toBeNull();
  });
});

describe("formatINR", () => {
  it("formats crore", () => {
    expect(formatINR(21_000_000)).toBe("₹2.1 Cr");
  });
  it("formats lakh", () => {
    expect(formatINR(6_500_000)).toBe("₹65 L");
  });
  it("formats thousands", () => {
    expect(formatINR(35_000)).toBe("₹35K");
  });
});

describe("basisLabel", () => {
  it("labels per_sq_ft", () => {
    expect(basisLabel("per_sq_ft")).toBe("per sq ft");
  });
});
