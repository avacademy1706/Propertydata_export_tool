/**
 * Area and length unit handling.
 *
 * Fixed conversions (sq ft / sq yd / sq m / acre) are applied directly.
 * Region-dependent land units (bigha, biswa) are NOT converted with a universal
 * factor; they need a verified per-region rule from LandUnitConversion. When no
 * rule exists the normalized value stays null and the original is preserved.
 */

export type AreaUnit = "sq_ft" | "sq_yd" | "sq_m" | "acre" | "bigha" | "biswa";
export type AreaType = "plot" | "built_up" | "carpet" | "super" | "land" | "unknown";
export type LengthUnit = "ft" | "m" | "yd";

export const FIXED_SQFT_PER_UNIT: Record<string, number> = {
  sq_ft: 1,
  sq_yd: 9,
  sq_m: 10.7639,
  acre: 43_560,
};

export const REGION_DEPENDENT_UNITS = new Set(["bigha", "biswa"]);

export interface AreaMeasurement {
  measurementType: "land_area" | "building_area" | "area";
  originalValue: number;
  originalUnit: AreaUnit;
  normalizedValue: number | null;
  normalizedUnit: "sq_ft";
  areaType: AreaType;
  conversionStatus: "converted" | "needs_region_rule" | "unknown_unit";
  conversionRegion?: string;
  raw: string;
}

export interface RegionRule {
  unit: string;
  region: string;
  sqFtPerUnit: number;
}

// Note: \b word boundaries are not used around the Devanagari alternatives
// because \b is ASCII-based and fails next to non-Latin scripts.
const UNIT_ALIASES: Array<[RegExp, AreaUnit]> = [
  [/(sq\.?\s*ft|sqft|square\s*feet|स्क्वायर\s*फीट|वर्ग\s*फुट|वर्ग\s*फीट)/i, "sq_ft"],
  [/(sq\.?\s*yd|sqyd|square\s*yard|gaj|गज|वर्ग\s*गज)/i, "sq_yd"],
  [/(sq\.?\s*m|sqm|square\s*met(?:er|re)|वर्ग\s*मीटर)/i, "sq_m"],
  [/(acres?|एकड़)/i, "acre"],
  [/(bigha|बीघा)/i, "bigha"],
  [/(biswa|बिस्वा)/i, "biswa"],
];

export function parseAreaUnit(text: string): AreaUnit | null {
  for (const [re, unit] of UNIT_ALIASES) {
    if (re.test(text)) return unit;
  }
  return null;
}

/**
 * Normalize an area value to square feet where a reliable conversion exists.
 * `regionRules` supplies verified bigha/biswa factors for the record's region.
 */
export function normalizeArea(
  value: number,
  unit: AreaUnit,
  opts: { areaType?: AreaType; region?: string; regionRules?: RegionRule[]; raw?: string } = {},
): AreaMeasurement {
  const areaType = opts.areaType ?? "unknown";
  const measurementType: AreaMeasurement["measurementType"] =
    unit === "acre" || unit === "bigha" || unit === "biswa"
      ? "land_area"
      : areaType === "built_up" || areaType === "carpet" || areaType === "super"
        ? "building_area"
        : "area";

  const base: AreaMeasurement = {
    measurementType,
    originalValue: value,
    originalUnit: unit,
    normalizedValue: null,
    normalizedUnit: "sq_ft",
    areaType,
    conversionStatus: "unknown_unit",
    conversionRegion: opts.region,
    raw: opts.raw ?? `${value} ${unit}`,
  };

  if (unit in FIXED_SQFT_PER_UNIT) {
    return {
      ...base,
      normalizedValue: round2(value * FIXED_SQFT_PER_UNIT[unit]),
      conversionStatus: "converted",
    };
  }

  if (REGION_DEPENDENT_UNITS.has(unit)) {
    const rule = findRegionRule(unit, opts.region, opts.regionRules);
    if (rule) {
      return {
        ...base,
        normalizedValue: round2(value * rule.sqFtPerUnit),
        conversionStatus: "converted",
        conversionRegion: rule.region,
      };
    }
    return { ...base, conversionStatus: "needs_region_rule" };
  }

  return base;
}

function findRegionRule(unit: string, region: string | undefined, rules: RegionRule[] | undefined): RegionRule | null {
  if (!rules || rules.length === 0) return null;
  const forUnit = rules.filter((r) => r.unit === unit);
  if (forUnit.length === 0) return null;
  if (region) {
    const needle = region.toLowerCase();
    const exact = forUnit.find((r) => r.region.toLowerCase() === needle);
    if (exact) return exact;
    const partial = forUnit.find(
      (r) => needle.includes(r.region.toLowerCase()) || r.region.toLowerCase().includes(needle),
    );
    if (partial) return partial;
  }
  // A single, region-agnostic rule for the unit can be used as a default.
  if (forUnit.length === 1) return forUnit[0];
  return null;
}

/** Parse "100x100" style dimensions into feet (assumes feet unless told otherwise). */
export function parseDimensions(text: string): { width: number; depth: number; unit: LengthUnit } | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const width = parseFloat(m[1]);
  const depth = parseFloat(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(depth)) return null;
  let unit: LengthUnit = "ft";
  const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 8).toLowerCase();
  if (/\bm\b|meter|metre|मीटर/.test(after)) unit = "m";
  else if (/yd|gaj|गज/.test(after)) unit = "yd";
  return { width, depth, unit };
}

export function areaUnitLabel(unit: string | null | undefined): string {
  switch (unit) {
    case "sq_ft":
      return "sq ft";
    case "sq_yd":
      return "sq yd";
    case "sq_m":
      return "sq m";
    case "acre":
      return "acre";
    case "bigha":
      return "bigha";
    case "biswa":
      return "biswa";
    default:
      return unit ?? "";
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
