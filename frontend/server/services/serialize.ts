import type { Buyer, Seller, Match, SourceMessage, Prisma } from "@/generated/prisma/client.ts";
import { formatINR, basisLabel } from "@/server/normalize/currency.ts";
import { areaUnitLabel } from "@/server/normalize/units.ts";

function num(v: Prisma.Decimal | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : Number(v.toString());
}

/** Human label for the record's origin, for the Source column. */
function sourceLabel(channel: string | undefined | null, dealSource: string | null | undefined): string {
  if (channel === "WHATSAPP") return "WhatsApp";
  if (dealSource) {
    const map: Record<string, string> = {
      whatsapp: "WhatsApp",
      newspaper: "Newspaper",
      reference: "Reference",
      broker: "Broker",
      direct: "Direct",
    };
    return map[dealSource] ?? dealSource;
  }
  return "Manual";
}

type WithSourceChannel = { sourceMessage?: { channel: string } | null };

export interface BuyerDTO {
  id: string;
  type: "buyer";
  contactName: string | null;
  phone: string | null;
  email: string | null;
  transactionType: string;
  propertyCategory: string | null;
  propertyType: string | null;
  preferredLocations: string[];
  district: string | null;
  city: string | null;
  minBudget: number | null;
  maxBudget: number | null;
  budgetBasis: string | null;
  budgetDisplay: string;
  bhk: number | null;
  areaValue: number | null;
  areaUnit: string | null;
  areaType: string | null;
  areaDisplay: string;
  preferredFacing: string[];
  requiredFeatures: string[];
  intendedUse: string | null;
  timeline: string | null;
  notes: string | null;
  status: string;
  verificationStatus: string;
  extractionConfidence: number | null;
  uncertainFields: string[];
  sourceMessageId: string | null;
  sourceSegment: string | null;
  source: string;
  mediaCount: number;
  customFields: Record<string, unknown>;
  createdAt: string;
  receivedAt: string;
}

export function serializeBuyer(b: Buyer & { mediaLinks?: unknown[] } & WithSourceChannel): BuyerDTO {
  return {
    id: b.id,
    type: "buyer",
    contactName: b.contactName,
    phone: b.phone,
    email: b.email,
    transactionType: b.transactionType,
    propertyCategory: b.propertyCategory,
    propertyType: b.propertyType,
    preferredLocations: b.preferredLocations ?? [],
    district: b.district,
    city: b.city,
    minBudget: num(b.minBudget),
    maxBudget: num(b.maxBudget),
    budgetBasis: b.budgetBasis,
    budgetDisplay: num(b.maxBudget) !== null ? `${formatINR(num(b.maxBudget))} ${basisLabel(b.budgetBasis)}`.trim() : "",
    bhk: b.bhk,
    areaValue: num(b.maxAreaValue),
    areaUnit: b.areaUnit,
    areaType: b.areaType,
    areaDisplay: num(b.maxAreaValue) !== null ? `${num(b.maxAreaValue)} ${areaUnitLabel(b.areaUnit)}`.trim() : "",
    preferredFacing: b.preferredFacing ?? [],
    requiredFeatures: b.requiredFeatures ?? [],
    intendedUse: b.intendedUse,
    timeline: b.timeline,
    notes: b.notes,
    status: b.status,
    verificationStatus: b.verificationStatus,
    extractionConfidence: num(b.extractionConfidence),
    uncertainFields: b.uncertainFields ?? [],
    sourceMessageId: b.sourceMessageId,
    sourceSegment: b.sourceSegment,
    source: sourceLabel(b.sourceMessage?.channel, b.dealSource),
    mediaCount: b.mediaLinks?.length ?? 0,
    customFields: (b.customFields as Record<string, unknown>) ?? {},
    createdAt: b.createdAt.toISOString(),
    receivedAt: b.receivedAt.toISOString(),
  };
}

export interface SellerDTO {
  id: string;
  type: "seller";
  contactName: string | null;
  phone: string | null;
  email: string | null;
  transactionType: string;
  propertyCategory: string | null;
  propertyType: string | null;
  location: string | null;
  landmark: string | null;
  district: string | null;
  city: string | null;
  priceAmount: number | null;
  priceBasis: string | null;
  priceDisplay: string;
  bhk: number | null;
  bathrooms: number | null;
  areaValue: number | null;
  areaUnit: string | null;
  areaType: string | null;
  areaDisplay: string;
  plotAreaValue: number | null;
  facing: string | null;
  furnishingStatus: string | null;
  buildingConfiguration: string | null;
  floor: string | null;
  propertySetting: string | null;
  features: string[];
  dealSource: string | null;
  googleMapsUrl: string | null;
  claims: string[];
  availability: string | null;
  notes: string | null;
  status: string;
  verificationStatus: string;
  extractionConfidence: number | null;
  uncertainFields: string[];
  sourceMessageId: string | null;
  sourceSegment: string | null;
  source: string;
  mediaCount: number;
  customFields: Record<string, unknown>;
  createdAt: string;
  receivedAt: string;
}

export function serializeSeller(s: Seller & { mediaLinks?: unknown[] } & WithSourceChannel): SellerDTO {
  return {
    id: s.id,
    type: "seller",
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    transactionType: s.transactionType,
    propertyCategory: s.propertyCategory,
    propertyType: s.propertyType,
    location: s.location,
    landmark: s.landmark,
    district: s.district,
    city: s.city,
    priceAmount: num(s.priceAmount),
    priceBasis: s.priceBasis,
    priceDisplay: num(s.priceAmount) !== null ? `${formatINR(num(s.priceAmount))} ${basisLabel(s.priceBasis)}`.trim() : "",
    bhk: s.bhk,
    bathrooms: s.bathrooms,
    areaValue: num(s.areaValue),
    areaUnit: s.areaUnit,
    areaType: s.areaType,
    areaDisplay: num(s.areaValue) !== null ? `${num(s.areaValue)} ${areaUnitLabel(s.areaUnit)}`.trim() : "",
    plotAreaValue: num(s.plotAreaValue),
    facing: s.facing,
    furnishingStatus: s.furnishingStatus,
    buildingConfiguration: s.buildingConfiguration,
    floor: s.floor,
    propertySetting: s.propertySetting,
    features: s.features ?? [],
    dealSource: s.dealSource,
    googleMapsUrl: s.googleMapsUrl,
    claims: s.claims ?? [],
    availability: s.availability,
    notes: s.notes,
    status: s.status,
    verificationStatus: s.verificationStatus,
    extractionConfidence: num(s.extractionConfidence),
    uncertainFields: s.uncertainFields ?? [],
    sourceMessageId: s.sourceMessageId,
    sourceSegment: s.sourceSegment,
    source: sourceLabel(s.sourceMessage?.channel, s.dealSource),
    mediaCount: s.mediaLinks?.length ?? 0,
    customFields: (s.customFields as Record<string, unknown>) ?? {},
    createdAt: s.createdAt.toISOString(),
    receivedAt: s.receivedAt.toISOString(),
  };
}

export interface MatchDTO {
  id: string;
  buyerId: string;
  sellerId: string;
  buyerName: string | null;
  buyerPhone: string | null;
  sellerName: string | null;
  sellerLocation: string | null;
  propertyType: string | null;
  priceDisplay: string;
  matchScore: number;
  dataCompleteness: number;
  insufficientData: boolean;
  band: string;
  scoreBreakdown: Record<string, number>;
  matchReasons: string[];
  mismatchReasons: string[];
  unknownCriteria: string[];
  status: string;
  calculatedAt: string;
}

export function serializeMatch(m: Match & { buyer: Buyer; seller: Seller }): MatchDTO {
  const score = num(m.matchScore) ?? 0;
  const band = m.insufficientData
    ? "insufficient_data"
    : score >= 90
      ? "excellent"
      : score >= 75
        ? "strong"
        : score >= 60
          ? "possible"
          : "low";
  return {
    id: m.id,
    buyerId: m.buyerId,
    sellerId: m.sellerId,
    buyerName: m.buyer.contactName,
    buyerPhone: m.buyer.phone,
    sellerName: m.seller.contactName,
    sellerLocation: m.seller.location,
    propertyType: m.seller.propertyType,
    priceDisplay: num(m.seller.priceAmount) !== null ? `${formatINR(num(m.seller.priceAmount))} ${basisLabel(m.seller.priceBasis)}`.trim() : "",
    matchScore: score,
    dataCompleteness: num(m.dataCompleteness) ?? 0,
    insufficientData: m.insufficientData,
    band,
    scoreBreakdown: (m.scoreBreakdown as Record<string, number>) ?? {},
    matchReasons: (m.matchReasons as string[]) ?? [],
    mismatchReasons: (m.mismatchReasons as string[]) ?? [],
    unknownCriteria: (m.unknownCriteria as string[]) ?? [],
    status: m.status,
    calculatedAt: m.calculatedAt.toISOString(),
  };
}

export function serializeSourceMessage(m: SourceMessage) {
  return {
    id: m.id,
    channel: m.channel,
    senderPhone: m.senderPhone,
    senderName: m.senderName,
    rawText: m.rawText,
    processingStatus: m.processingStatus,
    detectedType: m.detectedType,
    classificationConfidence: num(m.classificationConfidence),
    processingSummary: m.processingSummary,
    receivedAt: m.receivedAt.toISOString(),
  };
}
