import type { Prisma } from "@/generated/prisma/client.ts";
import { prisma } from "@/server/db/client.ts";
import { serializeBuyer, serializeSeller, serializeMatch } from "@/server/services/serialize.ts";

export interface ListParams {
  search?: string;
  city?: string;
  propertyType?: string;
  transactionType?: string;
  bhk?: number;
  status?: string;
  minBudget?: number;
  maxBudget?: number;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  since?: string; // ISO date; filters by receivedAt >= since
}

function sinceFilter(since?: string): { gte: Date } | undefined {
  if (!since) return undefined;
  const d = new Date(since);
  return Number.isNaN(d.getTime()) ? undefined : { gte: d };
}

const SOURCE_INCLUDE = { sourceMessage: { select: { channel: true } } } as const;

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 200;

function pagination(params: ListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, params.pageSize ?? PAGE_SIZE_DEFAULT));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export async function listBuyers(tenantId: string, params: ListParams) {
  const { skip, take, page, pageSize } = pagination(params);
  const where: Prisma.BuyerWhereInput = { tenantId };
  if (params.city) where.city = { equals: params.city, mode: "insensitive" };
  if (params.propertyType) where.propertyType = params.propertyType;
  if (params.transactionType) where.transactionType = params.transactionType as Prisma.EnumTransactionTypeFilter["equals"];
  if (params.bhk !== undefined) where.bhk = params.bhk;
  if (params.status) where.status = params.status as Prisma.EnumBuyerStatusFilter["equals"];
  if (params.maxBudget !== undefined) where.maxBudget = { lte: params.maxBudget };
  if (params.search) {
    where.OR = [
      { contactName: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search } },
      { city: { contains: params.search, mode: "insensitive" } },
      { district: { contains: params.search, mode: "insensitive" } },
      { propertyType: { contains: params.search, mode: "insensitive" } },
      { notes: { contains: params.search, mode: "insensitive" } },
      { preferredLocations: { has: params.search } },
    ];
  }
  const since = sinceFilter(params.since);
  if (since) where.receivedAt = since;
  const orderBy = buildOrderBy(params, ["createdAt", "maxBudget", "bhk", "city", "contactName"]);
  const [rows, total] = await Promise.all([
    prisma.buyer.findMany({ where, orderBy, skip, take, include: { mediaLinks: true, ...SOURCE_INCLUDE } }),
    prisma.buyer.count({ where }),
  ]);
  return { items: rows.map(serializeBuyer), total, page, pageSize };
}

export async function listSellers(tenantId: string, params: ListParams) {
  const { skip, take, page, pageSize } = pagination(params);
  const where: Prisma.SellerWhereInput = { tenantId };
  if (params.city) where.city = { equals: params.city, mode: "insensitive" };
  if (params.propertyType) where.propertyType = params.propertyType;
  if (params.transactionType) where.transactionType = params.transactionType as Prisma.EnumTransactionTypeFilter["equals"];
  if (params.bhk !== undefined) where.bhk = params.bhk;
  if (params.status) where.status = params.status as Prisma.EnumSellerStatusFilter["equals"];
  if (params.maxBudget !== undefined) where.priceAmount = { lte: params.maxBudget };
  if (params.minBudget !== undefined) where.priceAmount = { ...(where.priceAmount as object), gte: params.minBudget };
  if (params.search) {
    where.OR = [
      { contactName: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search } },
      { location: { contains: params.search, mode: "insensitive" } },
      { city: { contains: params.search, mode: "insensitive" } },
      { district: { contains: params.search, mode: "insensitive" } },
      { propertyType: { contains: params.search, mode: "insensitive" } },
      { notes: { contains: params.search, mode: "insensitive" } },
    ];
  }
  const since = sinceFilter(params.since);
  if (since) where.receivedAt = since;
  const orderBy = buildOrderBy(params, ["createdAt", "priceAmount", "bhk", "city", "location"]);
  const [rows, total] = await Promise.all([
    prisma.seller.findMany({ where, orderBy, skip, take, include: { mediaLinks: true, ...SOURCE_INCLUDE } }),
    prisma.seller.count({ where }),
  ]);
  return { items: rows.map(serializeSeller), total, page, pageSize };
}

export async function listMatches(
  tenantId: string,
  params: ListParams & { minScore?: number; buyerId?: string; sellerId?: string },
) {
  const { skip, take, page, pageSize } = pagination(params);
  const where: Prisma.MatchWhereInput = { tenantId };
  if (params.minScore !== undefined) where.matchScore = { gte: params.minScore };
  if (params.buyerId) where.buyerId = params.buyerId;
  if (params.sellerId) where.sellerId = params.sellerId;
  if (params.status) where.status = params.status as Prisma.EnumMatchStatusFilter["equals"];
  if (params.search) {
    where.OR = [
      { buyer: { contactName: { contains: params.search, mode: "insensitive" } } },
      { seller: { contactName: { contains: params.search, mode: "insensitive" } } },
      { seller: { location: { contains: params.search, mode: "insensitive" } } },
    ];
  }
  const orderBy: Prisma.MatchOrderByWithRelationInput =
    params.sort === "calculatedAt"
      ? { calculatedAt: params.order ?? "desc" }
      : { matchScore: params.order ?? "desc" };
  const [rows, total] = await Promise.all([
    prisma.match.findMany({ where, orderBy, skip, take, include: { buyer: true, seller: true } }),
    prisma.match.count({ where }),
  ]);
  return { items: rows.map(serializeMatch), total, page, pageSize };
}

function trend(current: number, previous: number): { direction: "up" | "down" | "flat"; percent: number } {
  if (previous === 0) return { direction: current > 0 ? "up" : "flat", percent: current > 0 ? 100 : 0 };
  const change = ((current - previous) / previous) * 100;
  return {
    direction: change > 0.5 ? "up" : change < -0.5 ? "down" : "flat",
    percent: Math.round(Math.abs(change)),
  };
}

export async function getDashboardSummary(tenantId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    buyers, sellers, strong, pendingBuyers, pendingSellers, needsReviewMsgs, heldSenders,
    buyersThis, buyersPrev, sellersThis, sellersPrev, strongThis, strongPrev, reviewThis, reviewPrev,
  ] = await Promise.all([
    prisma.buyer.count({ where: { tenantId, status: { notIn: ["ARCHIVED"] } } }),
    prisma.seller.count({ where: { tenantId, status: { notIn: ["ARCHIVED"] } } }),
    prisma.match.count({ where: { tenantId, matchScore: { gte: 75 }, insufficientData: false } }),
    prisma.buyer.count({ where: { tenantId, verificationStatus: "NEEDS_REVIEW" } }),
    prisma.seller.count({ where: { tenantId, verificationStatus: "NEEDS_REVIEW" } }),
    prisma.sourceMessage.count({ where: { tenantId, processingStatus: "NEEDS_REVIEW" } }),
    prisma.authorizedSender.count({ where: { tenantId, status: "PENDING" } }),
    prisma.buyer.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
    prisma.buyer.count({ where: { tenantId, createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    prisma.seller.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
    prisma.seller.count({ where: { tenantId, createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    prisma.match.count({ where: { tenantId, matchScore: { gte: 75 }, insufficientData: false, createdAt: { gte: monthStart } } }),
    prisma.match.count({ where: { tenantId, matchScore: { gte: 75 }, insufficientData: false, createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    prisma.sourceMessage.count({ where: { tenantId, processingStatus: "NEEDS_REVIEW", createdAt: { gte: monthStart } } }),
    prisma.sourceMessage.count({ where: { tenantId, processingStatus: "NEEDS_REVIEW", createdAt: { gte: prevMonthStart, lt: monthStart } } }),
  ]);
  const lastMessage = await prisma.sourceMessage.findFirst({
    where: { tenantId },
    orderBy: { receivedAt: "desc" },
    select: { receivedAt: true },
  });
  return {
    totalBuyers: buyers,
    totalSellers: sellers,
    strongMatches: strong,
    needsReview: pendingBuyers + pendingSellers + needsReviewMsgs,
    pendingSenders: heldSenders,
    lastSync: lastMessage?.receivedAt.toISOString() ?? null,
    trends: {
      buyers: trend(buyersThis, buyersPrev),
      sellers: trend(sellersThis, sellersPrev),
      strongMatches: trend(strongThis, strongPrev),
      needsReview: trend(reviewThis, reviewPrev),
    },
  };
}

function buildOrderBy(params: ListParams, allowed: string[]): Record<string, "asc" | "desc"> {
  const field = params.sort && allowed.includes(params.sort) ? params.sort : "createdAt";
  return { [field]: params.order ?? "desc" };
}
