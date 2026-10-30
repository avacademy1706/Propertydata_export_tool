import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client.ts";
import { prisma } from "@/server/db/client.ts";
import { serializeBuyer, serializeSeller } from "@/server/services/serialize.ts";
import { recalculateForBuyer, recalculateForSeller } from "@/server/matching/engine.ts";
import { NotFoundError } from "@/server/lib/errors.ts";
import { normalizePhone } from "@/server/lib/phone.ts";

const BuyerUpdateSchema = z.object({
  contactName: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(160).nullable().optional(),
  transactionType: z.enum(["BUY", "SALE", "RENT", "LEASE"]).optional(),
  propertyCategory: z.string().nullable().optional(),
  propertyType: z.string().nullable().optional(),
  preferredLocations: z.array(z.string()).optional(),
  district: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  minBudget: z.number().nullable().optional(),
  maxBudget: z.number().nullable().optional(),
  budgetBasis: z.string().nullable().optional(),
  bhk: z.number().int().nullable().optional(),
  maxAreaValue: z.number().nullable().optional(),
  minAreaValue: z.number().nullable().optional(),
  areaUnit: z.string().nullable().optional(),
  areaType: z.string().nullable().optional(),
  preferredFacing: z.array(z.string()).optional(),
  requiredFeatures: z.array(z.string()).optional(),
  intendedUse: z.string().nullable().optional(),
  timeline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["NEW", "ACTIVE", "CONTACTED", "CLOSED", "ARCHIVED"]).optional(),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "NEEDS_REVIEW"]).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const SellerUpdateSchema = z.object({
  contactName: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(160).nullable().optional(),
  transactionType: z.enum(["BUY", "SALE", "RENT", "LEASE"]).optional(),
  propertyCategory: z.string().nullable().optional(),
  propertyType: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  landmark: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  priceAmount: z.number().nullable().optional(),
  priceBasis: z.string().nullable().optional(),
  bhk: z.number().int().nullable().optional(),
  bathrooms: z.number().int().nullable().optional(),
  areaValue: z.number().nullable().optional(),
  areaUnit: z.string().nullable().optional(),
  areaType: z.string().nullable().optional(),
  facing: z.string().nullable().optional(),
  furnishingStatus: z.string().nullable().optional(),
  buildingConfiguration: z.string().nullable().optional(),
  floor: z.string().nullable().optional(),
  propertySetting: z.string().nullable().optional(),
  features: z.array(z.string()).optional(),
  dealSource: z.string().nullable().optional(),
  googleMapsUrl: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["AVAILABLE", "UNDER_OFFER", "SOLD", "RENTED", "ARCHIVED"]).optional(),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "NEEDS_REVIEW"]).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

/** Fields whose change requires recomputing matches. */
const BUYER_MATCH_FIELDS = new Set([
  "transactionType", "propertyType", "preferredLocations", "city", "district",
  "minBudget", "maxBudget", "budgetBasis", "bhk", "minAreaValue", "maxAreaValue",
  "areaUnit", "areaType", "preferredFacing", "requiredFeatures", "status",
]);
const SELLER_MATCH_FIELDS = new Set([
  "transactionType", "propertyType", "location", "city", "district", "priceAmount",
  "priceBasis", "bhk", "areaValue", "areaUnit", "areaType", "facing", "features", "status",
]);

export async function getBuyerDetail(tenantId: string, id: string) {
  const buyer = await prisma.buyer.findFirst({
    where: { id, tenantId },
    include: { mediaLinks: { include: { media: true } } },
  });
  if (!buyer) throw new NotFoundError("Buyer not found.");
  return {
    ...serializeBuyer(buyer),
    media: buyer.mediaLinks.map((l) => mediaSummary(l.media)),
  };
}

export async function getSellerDetail(tenantId: string, id: string) {
  const seller = await prisma.seller.findFirst({
    where: { id, tenantId },
    include: { mediaLinks: { include: { media: true } } },
  });
  if (!seller) throw new NotFoundError("Seller not found.");
  return {
    ...serializeSeller(seller),
    media: seller.mediaLinks.map((l) => mediaSummary(l.media)),
  };
}

export async function updateBuyer(tenantId: string, id: string, input: unknown) {
  const data = BuyerUpdateSchema.parse(input);
  const existing = await prisma.buyer.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError("Buyer not found.");
  if (data.phone !== undefined && data.phone) data.phone = normalizePhone(data.phone) ?? data.phone;

  const { customFields, ...rest } = data;
  const updateData: Prisma.BuyerUpdateInput = { ...(rest as Prisma.BuyerUpdateInput) };
  if (customFields) {
    updateData.customFields = { ...(existing.customFields as object), ...customFields } as Prisma.InputJsonValue;
  }
  const updated = await prisma.buyer.update({ where: { id }, data: updateData });
  await auditUpdate(tenantId, "buyer", id, data);

  if (Object.keys(data).some((k) => BUYER_MATCH_FIELDS.has(k))) {
    await recalculateForBuyer(tenantId, id);
  }
  return serializeBuyer(updated);
}

export async function updateSeller(tenantId: string, id: string, input: unknown) {
  const data = SellerUpdateSchema.parse(input);
  const existing = await prisma.seller.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError("Seller not found.");
  if (data.phone !== undefined && data.phone) data.phone = normalizePhone(data.phone) ?? data.phone;

  const { customFields, ...rest } = data;
  const updateData: Prisma.SellerUpdateInput = { ...(rest as Prisma.SellerUpdateInput) };
  if (customFields) {
    updateData.customFields = { ...(existing.customFields as object), ...customFields } as Prisma.InputJsonValue;
  }
  const updated = await prisma.seller.update({ where: { id }, data: updateData });
  await auditUpdate(tenantId, "seller", id, data);

  if (Object.keys(data).some((k) => SELLER_MATCH_FIELDS.has(k))) {
    await recalculateForSeller(tenantId, id);
  }
  return serializeSeller(updated);
}

export async function deleteBuyer(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.buyer.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError("Buyer not found.");
  await prisma.buyer.delete({ where: { id } });
  await auditUpdate(tenantId, "buyer", id, { action: "delete" });
}

export async function deleteSeller(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.seller.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError("Seller not found.");
  await prisma.seller.delete({ where: { id } });
  await auditUpdate(tenantId, "seller", id, { action: "delete" });
}

function mediaSummary(media: { id: string; mediaType: string; caption: string | null; aiDescription: string | null; width: number | null; height: number | null }) {
  return {
    id: media.id,
    mediaType: media.mediaType,
    caption: media.caption,
    aiDescription: media.aiDescription,
    url: `/api/media/${media.id}`,
    thumbnailUrl: `/api/media/${media.id}?thumbnail=1`,
  };
}

async function auditUpdate(tenantId: string, entityType: string, entityId: string, changes: unknown) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      entityType,
      entityId,
      action: (changes as { action?: string }).action ?? "update",
      changes: changes as Prisma.InputJsonValue,
      actor: "dashboard-user",
    },
  });
}
