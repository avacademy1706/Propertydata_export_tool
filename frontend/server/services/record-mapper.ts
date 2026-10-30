import type { Prisma } from "@/generated/prisma/client.ts";
import type { ExtractedRecord } from "@/server/ai/schemas.ts";
import { normalizeArea, type AreaUnit, type RegionRule } from "@/server/normalize/units.ts";
import { normalizePhone } from "@/server/lib/phone.ts";
import { titleCase, uniqueStrings } from "@/server/lib/text.ts";

/**
 * Maps a validated ExtractedRecord onto typed buyer/seller columns plus the
 * normalized derived values. The raw extraction is preserved on the record.
 */

const TRANSACTION_TO_ENUM: Record<string, "BUY" | "SALE" | "RENT" | "LEASE"> = {
  buy: "BUY",
  sale: "SALE",
  rent: "RENT",
  lease: "LEASE",
};

interface MapOptions {
  tenantId: string;
  sourceMessageId?: string | null;
  listingSequence: number;
  regionRules: RegionRule[];
  verificationPolicy?: "pending" | "verified";
}

function buildProvenance(record: ExtractedRecord): Record<string, "ai"> {
  const prov: Record<string, "ai"> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
      prov[key] = "ai";
    }
  }
  return prov;
}

function areaFields(
  area: ExtractedRecord["area"],
  opts: MapOptions,
  region: string | undefined,
): { value: number | null; unit: string | null; type: string | null; normalizedSqFt: number | null } {
  if (!area || area.original_value === null || !area.original_unit) {
    return { value: null, unit: null, type: null, normalizedSqFt: null };
  }
  const normalized = normalizeArea(area.original_value, area.original_unit as AreaUnit, {
    areaType: area.area_type,
    region,
    regionRules: opts.regionRules,
    raw: `${area.original_value} ${area.original_unit}`,
  });
  return {
    value: area.original_value,
    unit: area.original_unit,
    type: area.area_type,
    normalizedSqFt: normalized.normalizedValue,
  };
}

export function mapBuyer(record: ExtractedRecord, opts: MapOptions): Prisma.BuyerCreateInput {
  const region = record.district ?? record.city ?? undefined;
  const area = areaFields(record.area, opts, region);
  const phone = normalizePhone(record.phone);
  const budgets = record.budgets ?? [];
  const totalBudgets = [record.rate, ...budgets.map((b) => b.rate)].filter(
    (r): r is NonNullable<typeof r> => !!r && r.amount !== null,
  );
  const amounts = totalBudgets.map((r) => r.amount as number);
  const maxBudget = amounts.length ? Math.max(...amounts) : null;
  const minBudget = amounts.length > 1 ? Math.min(...amounts) : null;
  const budgetBasis = record.rate?.basis ?? budgets[0]?.rate.basis ?? "total";

  const transaction = record.transaction_type ? TRANSACTION_TO_ENUM[record.transaction_type] ?? "BUY" : "BUY";

  const customFields: Record<string, unknown> = {};
  if (budgets.length) customFields.permitted_use_budgets = budgets;
  if (record.property_setting) customFields.property_setting = record.property_setting;
  if (record.google_maps_url) customFields.google_maps_url = record.google_maps_url;

  return {
    tenant: { connect: { id: opts.tenantId } },
    ...(opts.sourceMessageId ? { sourceMessage: { connect: { id: opts.sourceMessageId } } } : {}),
    listingSequence: opts.listingSequence,
    sourceSegment: record.source_segment,
    contactName: record.contact_name ? titleCase(record.contact_name) : null,
    phone,
    email: record.email,
    transactionType: transaction,
    propertyCategory: record.property_category,
    propertyType: record.property_type,
    preferredLocations: uniqueStrings([record.location, record.landmark]),
    district: record.district,
    city: record.city,
    fullAddress: record.full_address,
    minBudget,
    maxBudget,
    budgetBasis,
    currency: record.rate?.currency ?? "INR",
    bhk: record.bhk,
    minAreaValue: area.value,
    maxAreaValue: area.value,
    areaUnit: area.unit,
    areaType: area.type,
    frontWidthValue: record.front_width?.value ?? null,
    frontWidthUnit: record.front_width?.unit ?? null,
    roadWidthValue: record.road_width?.value ?? null,
    roadWidthUnit: record.road_width?.unit ?? null,
    furnishingStatus: record.furnishing_status,
    preferredFacing: record.facing ? [record.facing] : [],
    requiredFeatures: record.features ?? [],
    preferredFloor: record.floor,
    timeline: record.timeline,
    intendedUse: record.intended_use,
    dealSource: record.deal_source,
    notes: record.notes,
    customFields: { ...customFields, normalized_area_sqft: area.normalizedSqFt },
    fieldProvenance: buildProvenance(record),
    rawExtraction: record as unknown as Prisma.InputJsonValue,
    uncertainFields: record.uncertain_fields ?? [],
    extractionConfidence: record.confidence,
    verificationStatus: opts.verificationPolicy === "verified" ? "VERIFIED" : "PENDING",
    status: "NEW",
  };
}

export function mapSeller(record: ExtractedRecord, opts: MapOptions): Prisma.SellerCreateInput {
  const region = record.district ?? record.city ?? undefined;
  const area = areaFields(record.area, opts, region);
  const plotArea = areaFields(record.plot_area, opts, region);
  const phone = normalizePhone(record.phone);
  const transaction = record.transaction_type ? TRANSACTION_TO_ENUM[record.transaction_type] ?? "SALE" : "SALE";

  const customFields: Record<string, unknown> = {};
  if (record.google_maps_url) customFields.google_maps_url = record.google_maps_url;

  return {
    tenant: { connect: { id: opts.tenantId } },
    ...(opts.sourceMessageId ? { sourceMessage: { connect: { id: opts.sourceMessageId } } } : {}),
    listingSequence: opts.listingSequence,
    sourceSegment: record.source_segment,
    contactName: record.contact_name ? titleCase(record.contact_name) : null,
    phone,
    email: record.email,
    transactionType: transaction,
    propertyCategory: record.property_category,
    propertyType: record.property_type,
    location: record.location,
    district: record.district,
    city: record.city,
    fullAddress: record.full_address,
    landmark: record.landmark,
    priceAmount: record.rate?.amount ?? null,
    priceBasis: record.rate?.basis ?? "total",
    currency: record.rate?.currency ?? "INR",
    bhk: record.bhk,
    bathrooms: record.bathrooms,
    areaValue: area.value,
    areaUnit: area.unit,
    areaType: area.type,
    plotAreaValue: plotArea.value,
    plotAreaUnit: plotArea.unit,
    frontWidthValue: record.front_width?.value ?? null,
    frontWidthUnit: record.front_width?.unit ?? null,
    roadWidthValue: record.road_width?.value ?? null,
    roadWidthUnit: record.road_width?.unit ?? null,
    furnishingStatus: record.furnishing_status,
    facing: record.facing,
    floor: record.floor,
    buildingConfiguration: record.building_configuration,
    propertySetting: record.property_setting,
    features: record.features ?? [],
    availability: record.availability,
    dealSource: record.deal_source,
    googleMapsUrl: record.google_maps_url,
    claims: record.claims ?? [],
    notes: record.notes,
    customFields: {
      ...customFields,
      normalized_area_sqft: area.normalizedSqFt,
      normalized_plot_area_sqft: plotArea.normalizedSqFt,
    },
    fieldProvenance: buildProvenance(record),
    rawExtraction: record as unknown as Prisma.InputJsonValue,
    uncertainFields: record.uncertain_fields ?? [],
    extractionConfidence: record.confidence,
    verificationStatus: opts.verificationPolicy === "verified" ? "VERIFIED" : "PENDING",
    status: "AVAILABLE",
  };
}
