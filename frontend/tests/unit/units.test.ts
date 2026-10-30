import { describe, it, expect } from "vitest";
import { normalizeArea, parseAreaUnit, parseDimensions } from "@/server/normalize/units.ts";

describe("normalizeArea", () => {
  it("keeps sq ft as-is", () => {
    const a = normalizeArea(1300, "sq_ft");
    expect(a.normalizedValue).toBe(1300);
    expect(a.conversionStatus).toBe("converted");
  });
  it("converts square yards", () => {
    const a = normalizeArea(100, "sq_yd");
    expect(a.normalizedValue).toBe(900);
  });
  it("converts acres", () => {
    const a = normalizeArea(1, "acre");
    expect(a.normalizedValue).toBe(43_560);
  });
  it("does NOT convert bigha without a verified region rule", () => {
    const a = normalizeArea(6, "bigha", { region: "Lucknow" });
    expect(a.normalizedValue).toBeNull();
    expect(a.conversionStatus).toBe("needs_region_rule");
    expect(a.originalValue).toBe(6);
    expect(a.originalUnit).toBe("bigha");
  });
  it("converts bigha when a matching region rule is provided", () => {
    const a = normalizeArea(2, "bigha", {
      region: "Lucknow, Uttar Pradesh",
      regionRules: [{ unit: "bigha", region: "Lucknow, Uttar Pradesh", sqFtPerUnit: 27000 }],
    });
    expect(a.normalizedValue).toBe(54_000);
    expect(a.conversionStatus).toBe("converted");
  });
});

describe("parseAreaUnit", () => {
  it("detects sqft variants", () => {
    expect(parseAreaUnit("1300 sqft")).toBe("sq_ft");
    expect(parseAreaUnit("स्क्वायर फीट")).toBe("sq_ft");
  });
  it("detects bigha", () => {
    expect(parseAreaUnit("6 बीघा")).toBe("bigha");
  });
});

describe("parseDimensions", () => {
  it("parses 100x100 as dimensions in feet, not area", () => {
    const d = parseDimensions("100x100 plot");
    expect(d).toEqual({ width: 100, depth: 100, unit: "ft" });
  });
});
