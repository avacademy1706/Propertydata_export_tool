import { z } from "zod";
import {
  AREA_TYPES,
  BUILDING_CONFIGS,
  DEAL_SOURCES,
  FACINGS,
  FURNISHING_STATUSES,
  PROPERTY_CATEGORIES,
  PROPERTY_TYPES,
  TRANSACTION_TYPES,
} from "@/server/domain/taxonomy.ts";

/**
 * Runtime schemas for AI output. Model responses are ALWAYS validated against
 * these before use; the application never trusts raw model JSON.
 */

export const ClassificationSchema = z.object({
  classification: z.enum(["buyer", "seller", "both", "unknown"]).catch("unknown"),
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
  reason: z.string().max(400).catch(""),
  needs_review: z.boolean().catch(false),
});
export type Classification = z.infer<typeof ClassificationSchema>;

const AreaSchema = z.object({
  original_value: z.coerce.number().nonnegative().nullable().catch(null),
  original_unit: z.enum(["sq_ft", "sq_yd", "sq_m", "acre", "bigha", "biswa"]).nullable().catch(null),
  area_type: z.enum(AREA_TYPES).catch("unknown"),
});

const MeasurementSchema = z.object({
  value: z.number().nonnegative().nullable().default(null),
  unit: z.string().max(12).nullable().default(null),
});

const RateSchema = z.object({
  amount: z.coerce.number().nonnegative().nullable().catch(null),
  currency: z.string().catch("INR"),
  basis: z
    .enum(["total", "per_sq_ft", "per_sq_yd", "per_sq_m", "per_acre", "per_bigha", "per_biswa", "monthly", "annual"])
    .catch("total"),
});

/** One extracted buyer or seller record. */
export const ExtractedRecordSchema = z.object({
  record_type: z.enum(["buyer", "seller"]).catch("seller"),
  transaction_type: z.enum(TRANSACTION_TYPES).nullable().catch(null),
  property_category: z.enum(PROPERTY_CATEGORIES).nullable().catch(null),
  property_type: z.enum(PROPERTY_TYPES).nullable().catch(null),

  contact_name: z.string().max(120).nullable().default(null),
  phone: z.string().max(40).nullable().default(null),
  email: z.string().max(160).nullable().default(null),

  location: z.string().max(240).nullable().default(null),
  district: z.string().max(120).nullable().default(null),
  city: z.string().max(120).nullable().default(null),
  full_address: z.string().max(400).nullable().default(null),
  landmark: z.string().max(240).nullable().default(null),

  bhk: z.coerce.number().int().min(0).max(50).nullable().catch(null),
  bathrooms: z.coerce.number().int().min(0).max(50).nullable().catch(null),
  area: AreaSchema.nullable().default(null),
  plot_area: AreaSchema.nullable().default(null),
  front_width: MeasurementSchema.nullable().default(null),
  road_width: MeasurementSchema.nullable().default(null),

  rate: RateSchema.nullable().default(null),
  // Buyers may list several permitted-use budgets (e.g. residential vs commercial rent).
  budgets: z
    .array(z.object({ label: z.string().max(80), rate: RateSchema }))
    .max(8)
    .default([]),

  furnishing_status: z.enum(FURNISHING_STATUSES).nullable().catch(null),
  facing: z.enum(FACINGS).nullable().catch(null),
  floor: z.string().max(80).nullable().default(null),
  building_configuration: z.enum(BUILDING_CONFIGS).nullable().catch(null),
  property_setting: z.string().max(80).nullable().default(null),
  features: z.array(z.string().max(80)).max(40).catch([]),
  availability: z.string().max(120).nullable().default(null),
  intended_use: z.string().max(240).nullable().default(null),
  deal_source: z.enum(DEAL_SOURCES).nullable().catch(null),
  google_maps_url: z.string().max(400).nullable().default(null),
  timeline: z.string().max(120).nullable().default(null),

  // Unverified statements (legal approvals, etc.) kept as claims, not facts.
  claims: z.array(z.string().max(200)).max(20).catch([]),
  notes: z.string().max(1000).nullable().default(null),

  source_segment: z.string().max(60).nullable().default(null),
  uncertain_fields: z.array(z.string().max(60)).max(40).catch([]),
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
});
export type ExtractedRecord = z.infer<typeof ExtractedRecordSchema>;

export const ExtractionResultSchema = z.object({
  classification: z.enum(["buyer", "seller", "both", "unknown"]).catch("unknown"),
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
  records: z.array(ExtractedRecordSchema).max(50).catch([]),
  shared_fields: z.record(z.string(), z.unknown()).catch({}),
  needs_review: z.boolean().catch(false),
  review_reasons: z.array(z.string().max(200)).max(20).catch([]),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/** Vision description of a property photo (suggestions only, never facts). */
export const ImageDescriptionSchema = z.object({
  description: z.string().max(600),
  visible_features: z.array(z.string().max(80)).max(20).default([]),
});
export type ImageDescription = z.infer<typeof ImageDescriptionSchema>;
