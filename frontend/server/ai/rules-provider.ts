import {
  ExtractionResultSchema,
  type Classification,
  type ExtractedRecord,
  type ExtractionResult,
} from "@/server/ai/schemas.ts";
import type { AiProvider, ClassifyInput, ExtractInput } from "@/server/ai/provider.ts";
import {
  AVAILABILITY_SIGNALS,
  REQUIREMENT_SIGNALS,
  TRANSACTION_ALIASES,
  detectBuildingConfig,
  detectCategory,
  detectFacing,
  detectFurnishing,
  detectPropertyType,
  extractFeatures,
  type TransactionTypeValue,
} from "@/server/domain/taxonomy.ts";
import { parseAmount } from "@/server/normalize/currency.ts";
import { parseAreaUnit, parseDimensions } from "@/server/normalize/units.ts";
import { normalizePhone } from "@/server/lib/phone.ts";

/**
 * Deterministic, offline extractor. Lower accuracy than Claude but requires no
 * API key, and gives the automated tests a stable, provider-free path.
 */
export class RulesProvider implements AiProvider {
  readonly name = "rules";

  async classify(input: ClassifyInput): Promise<Classification> {
    return classifyText(input.text);
  }

  async extract(input: ExtractInput): Promise<ExtractionResult> {
    return extractText(input.text, input.hint);
  }
}

const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\b\d{10}\b/;
const BHK_RE = /(\d+)\s*bhk\b/i;
const BATH_RE = /(\d+)\s*(?:bath|bathroom|toilet|washroom)/i;
const AREA_VALUE_RE =
  /(\d[\d,]*(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|square\s*feet|स्क्वायर\s*फीट|वर्ग\s*फुट|sq\.?\s*yd|sqyd|gaj|गज|sq\.?\s*m|sqm|acre|एकड़|bigha|बीघा|biswa|बिस्वा)/i;

function classifyText(text: string): Classification {
  const reqHits = REQUIREMENT_SIGNALS.filter((p) => p.test(text)).length;
  const availHits = AVAILABILITY_SIGNALS.filter((p) => p.test(text)).length;
  const hasPropertyInfo =
    BHK_RE.test(text) || AREA_VALUE_RE.test(text) || detectPropertyType(text) !== null || /plot|flat|shop|office|villa|house|land/i.test(text);

  if (!hasPropertyInfo && reqHits === 0 && availHits === 0) {
    return { classification: "unknown", confidence: 0.3, reason: "No clear property information.", needs_review: true };
  }

  if (reqHits > availHits) {
    return {
      classification: "buyer",
      confidence: reqHits >= 2 ? 0.86 : 0.72,
      reason: "Requirement wording detected.",
      needs_review: reqHits < 1,
    };
  }
  if (availHits > reqHits) {
    return {
      classification: "seller",
      confidence: availHits >= 2 ? 0.88 : 0.74,
      reason: "Availability wording detected.",
      needs_review: false,
    };
  }
  // Tie: an asking price + area with no requirement wording leans seller.
  if (hasPropertyInfo) {
    return { classification: "seller", confidence: 0.6, reason: "Property details present without requirement wording.", needs_review: true };
  }
  return { classification: "unknown", confidence: 0.4, reason: "Ambiguous message.", needs_review: true };
}

function detectTransaction(text: string): { value: TransactionTypeValue; isRequirement: boolean } | null {
  for (const { value, patterns } of TRANSACTION_ALIASES) {
    if (patterns.some((p) => p.test(text))) {
      const isReq = REQUIREMENT_SIGNALS.some((p) => p.test(text));
      return { value, isRequirement: isReq };
    }
  }
  return null;
}

/** Split a message into listing segments when it clearly holds several blocks. */
function splitListings(text: string): string[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const withArea = blocks.filter((b) => AREA_VALUE_RE.test(b) || /@|rate|रेट|price/i.test(b));
  if (withArea.length >= 2) return blocks.filter((b) => AREA_VALUE_RE.test(b) || /@|rate|रेट/i.test(b) || PHONE_RE.test(b) === false);
  // Try numbered lines like "1)" "2." when there are several.
  const numbered = text.split(/\n(?=\s*\d+[.)]\s)/).map((s) => s.trim()).filter(Boolean);
  if (numbered.length >= 2 && numbered.filter((n) => AREA_VALUE_RE.test(n)).length >= 2) return numbered;
  return [text];
}

function extractText(text: string, hint: ExtractInput["hint"]): ExtractionResult {
  const classification = classifyText(text);
  let recordType: "buyer" | "seller" =
    classification.classification === "buyer"
      ? "buyer"
      : classification.classification === "seller"
        ? "seller"
        : hint === "buyer"
          ? "buyer"
          : "seller";
  if (hint === "buyer" && classification.classification !== "seller") recordType = "buyer";
  if (hint === "seller" && classification.classification !== "buyer") recordType = "seller";

  const sharedPhone = normalizePhone(text.match(PHONE_RE)?.[0] ?? null);
  const transaction = detectTransaction(text);

  const segments = splitListings(text);
  const multi = segments.length > 1;

  const records: ExtractedRecord[] = segments.map((segment, idx) =>
    buildRecord(segment, {
      recordType,
      transaction,
      sharedPhone: multi ? sharedPhone : sharedPhone,
      index: idx + 1,
      isMulti: multi,
      fullText: text,
    }),
  );

  const result: ExtractionResult = {
    classification: classification.classification,
    confidence: classification.confidence,
    records,
    shared_fields: {
      ...(sharedPhone ? { phone: sharedPhone } : {}),
      ...(transaction ? { transaction_type: transaction.value } : {}),
    },
    needs_review: classification.needs_review || records.some((r) => r.uncertain_fields.length > 2),
    review_reasons: classification.needs_review ? [classification.reason] : [],
  };
  return ExtractionResultSchema.parse(result);
}

function buildRecord(
  segment: string,
  ctx: {
    recordType: "buyer" | "seller";
    transaction: { value: TransactionTypeValue; isRequirement: boolean } | null;
    sharedPhone: string | null;
    index: number;
    isMulti: boolean;
    fullText: string;
  },
): ExtractedRecord {
  const uncertain: string[] = [];
  const transactionKind = ctx.recordType === "buyer" ? (ctx.transaction?.value === "sale" ? "buy" : ctx.transaction?.value ?? "buy") : ctx.transaction?.value ?? "sale";

  // Area
  let area: ExtractedRecord["area"] = null;
  const areaMatch = segment.match(AREA_VALUE_RE);
  if (areaMatch) {
    const value = parseFloat(areaMatch[1].replace(/,/g, ""));
    const unit = parseAreaUnit(areaMatch[2]) ?? "sq_ft";
    const covered = /covered|built|built-up|builtup/i.test(segment);
    area = {
      original_value: Number.isFinite(value) ? value : null,
      original_unit: unit,
      area_type: covered ? "built_up" : unit === "bigha" || unit === "biswa" || unit === "acre" ? "land" : "unknown",
    };
  }

  // Price / rate
  const rate = parseAmount(segment, { transactionKind: transactionKind as "sale" | "buy" | "rent" | "lease" });
  if (rate?.uncertain) uncertain.push("rate");

  // BHK
  const bhkMatch = segment.match(BHK_RE);
  const bhk = bhkMatch ? parseInt(bhkMatch[1], 10) : null;
  const bathMatch = segment.match(BATH_RE);

  // Dimensions -> front width note
  const dims = parseDimensions(segment);

  // Phone within this segment, else shared
  const phone = normalizePhone(segment.match(PHONE_RE)?.[0] ?? null) ?? ctx.sharedPhone;

  // Location: first capitalized place-like phrase after "in/at/near"
  const location = guessLocation(segment);

  const features = extractFeatures(segment);
  const facing = detectFacing(segment);
  const furnishing = detectFurnishing(segment);
  const buildingConfig = detectBuildingConfig(segment);
  const propertyType = detectPropertyType(segment);
  const category = detectCategory(segment);

  const transactionType: TransactionTypeValue | null = ctx.recordType === "buyer"
    ? ctx.transaction?.value === "sale"
      ? "buy"
      : ctx.transaction?.value ?? "buy"
    : ctx.transaction?.value ?? "sale";

  if (!location) uncertain.push("location");
  if (!rate) uncertain.push("rate");
  if (!propertyType) uncertain.push("property_type");

  return {
    record_type: ctx.recordType,
    transaction_type: transactionType,
    property_category: category,
    property_type: propertyType,
    contact_name: null,
    phone,
    email: segment.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null,
    location,
    district: null,
    city: guessCity(segment),
    full_address: null,
    landmark: segment.match(/near\s+([^,.\n]{3,40})/i)?.[1]?.trim() ?? null,
    bhk,
    bathrooms: bathMatch ? parseInt(bathMatch[1], 10) : null,
    area,
    plot_area: null,
    front_width: dims ? { value: dims.width, unit: dims.unit } : null,
    road_width: null,
    rate: rate ? { amount: rate.amount, currency: "INR", basis: rate.basis } : null,
    budgets: [],
    furnishing_status: furnishing,
    facing,
    floor: segment.match(/(\d+(?:st|nd|rd|th)?\s*floor|ground\s*floor|basement)/i)?.[0] ?? null,
    building_configuration: buildingConfig,
    property_setting: null,
    features,
    availability: /ready\s*to\s*move/i.test(segment) ? "Ready to Move" : null,
    intended_use: segment.match(/for\s+(petrol\s*pump|office|showroom|warehouse|airbnb|guest\s*house)/i)?.[0] ?? null,
    deal_source: null,
    google_maps_url: segment.match(/https?:\/\/\S*(?:maps|goo\.gl|g\.co)\S*/i)?.[0] ?? null,
    timeline: /immediate|urgent|तुरंत/i.test(segment) ? "Immediate" : null,
    claims: extractClaims(segment),
    notes: null,
    source_segment: ctx.isMulti ? `listing_${ctx.index}` : null,
    uncertain_fields: Array.from(new Set(uncertain)),
    confidence: 0.6,
  };
}

function guessLocation(text: string): string | null {
  const m =
    text.match(/\b(?:in|at|near|location[:\s])\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,3})/) ??
    text.match(/\b([A-Z][a-z]+\s+(?:Nagar|Puram|Vihar|Khand|Colony|Road|Marg|Sector[-\s]?\d+|City|Enclave|Garden))/);
  return m ? m[1].trim() : null;
}

function guessCity(text: string): string | null {
  const cities = ["Lucknow", "Kanpur", "Delhi", "Noida", "Gurgaon", "Gurugram", "Ghaziabad", "Faizabad", "Ayodhya", "Varanasi", "Prayagraj", "Allahabad"];
  for (const c of cities) {
    if (new RegExp(`\\b${c}\\b`, "i").test(text)) return c;
  }
  return null;
}

function extractClaims(text: string): string[] {
  const claims: string[] = [];
  const patterns = [
    /\bdhara\s*80[^.,\n]*/i,
    /\bधारा\s*80[^.,\n]*/,
    /\b(lda|rera|jda|bda|awas\s*vikas)\s*approved\b[^.,\n]*/i,
    /\bjila\s*panchayat\s*approved\b[^.,\n]*/i,
    /\bजिला\s*पंचायत[^.,\n]*/,
    /\bbank\s*loan\s*available\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) claims.push(m[0].trim());
  }
  return claims;
}
