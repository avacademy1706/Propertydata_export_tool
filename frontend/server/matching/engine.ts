import type { Buyer, Seller, Prisma } from "@/generated/prisma/client.ts";
import { prisma } from "@/server/db/client.ts";
import { DEFAULT_SCORING, MIN_PERSIST_SCORE } from "@/server/matching/config.ts";
import {
  isEligiblePair,
  scoreMatch,
  type BuyerForScore,
  type SellerForScore,
} from "@/server/matching/scorer.ts";
import { logger } from "@/server/lib/logger.ts";

function dec(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value.toString());
}

export function buyerToScore(b: Buyer): BuyerForScore {
  return {
    id: b.id,
    transactionType: b.transactionType,
    propertyType: b.propertyType,
    preferredLocations: b.preferredLocations ?? [],
    district: b.district,
    city: b.city,
    minBudget: dec(b.minBudget),
    maxBudget: dec(b.maxBudget),
    budgetBasis: b.budgetBasis,
    bhk: b.bhk,
    minAreaValue: dec(b.minAreaValue),
    maxAreaValue: dec(b.maxAreaValue),
    areaUnit: b.areaUnit,
    areaType: b.areaType,
    requiredFeatures: b.requiredFeatures ?? [],
    preferredFacing: b.preferredFacing ?? [],
  };
}

export function sellerToScore(s: Seller): SellerForScore {
  return {
    id: s.id,
    transactionType: s.transactionType,
    status: s.status,
    propertyType: s.propertyType,
    location: s.location,
    district: s.district,
    city: s.city,
    priceAmount: dec(s.priceAmount),
    priceBasis: s.priceBasis,
    bhk: s.bhk,
    areaValue: dec(s.areaValue),
    areaUnit: s.areaUnit,
    areaType: s.areaType,
    features: s.features ?? [],
    facing: s.facing,
  };
}

/** Pre-filter candidate sellers for a buyer to avoid an O(n*m) scan. */
function candidateSellerWhere(buyer: Buyer, tenantId: string): Prisma.SellerWhereInput {
  const where: Prisma.SellerWhereInput = {
    tenantId,
    status: { in: ["AVAILABLE"] },
  };
  // Transaction compatibility narrows the set.
  if (buyer.transactionType === "BUY") where.transactionType = "SALE";
  else if (buyer.transactionType === "RENT") where.transactionType = { in: ["RENT", "LEASE"] };
  else if (buyer.transactionType === "LEASE") where.transactionType = { in: ["LEASE", "RENT"] };
  if (buyer.city) where.OR = [{ city: buyer.city }, { city: null }];
  return where;
}

async function upsertMatch(
  tenantId: string,
  buyer: Buyer,
  seller: Seller,
): Promise<boolean> {
  const bs = buyerToScore(buyer);
  const ss = sellerToScore(seller);
  if (!isEligiblePair(bs, ss)) {
    // Remove any stale match row for a now-ineligible pair.
    await prisma.match.deleteMany({ where: { tenantId, buyerId: buyer.id, sellerId: seller.id } });
    return false;
  }
  const result = scoreMatch(bs, ss, DEFAULT_SCORING);
  // Only keep meaningful matches: drop insufficient data, a known property-type
  // mismatch (e.g. a plot buyer vs an apartment), and weak scores — so the
  // Matching view and export aren't cluttered with irrelevant pairs.
  const typeMismatch = result.rawScores.propertyType === 0;
  if (result.insufficientData || typeMismatch || result.matchScore < MIN_PERSIST_SCORE) {
    await prisma.match.deleteMany({ where: { tenantId, buyerId: buyer.id, sellerId: seller.id } });
    return false;
  }
  await prisma.match.upsert({
    where: { tenantId_buyerId_sellerId: { tenantId, buyerId: buyer.id, sellerId: seller.id } },
    create: {
      tenantId,
      buyerId: buyer.id,
      sellerId: seller.id,
      matchScore: result.matchScore,
      dataCompleteness: result.dataCompleteness,
      insufficientData: result.insufficientData,
      scoreBreakdown: result.breakdown,
      matchReasons: result.matchReasons,
      mismatchReasons: result.mismatchReasons,
      unknownCriteria: result.unknownCriteria,
      scoringVersion: result.scoringVersion,
    },
    update: {
      matchScore: result.matchScore,
      dataCompleteness: result.dataCompleteness,
      insufficientData: result.insufficientData,
      scoreBreakdown: result.breakdown,
      matchReasons: result.matchReasons,
      mismatchReasons: result.mismatchReasons,
      unknownCriteria: result.unknownCriteria,
      scoringVersion: result.scoringVersion,
      calculatedAt: new Date(),
    },
  });
  return true;
}

export async function recalculateForBuyer(tenantId: string, buyerId: string): Promise<number> {
  const buyer = await prisma.buyer.findFirst({ where: { id: buyerId, tenantId } });
  if (!buyer) return 0;
  if (["CLOSED", "ARCHIVED"].includes(buyer.status)) {
    await prisma.match.deleteMany({ where: { tenantId, buyerId } });
    return 0;
  }
  const sellers = await prisma.seller.findMany({ where: candidateSellerWhere(buyer, tenantId) });
  let count = 0;
  for (const seller of sellers) {
    if (await upsertMatch(tenantId, buyer, seller)) count += 1;
  }
  logger.debug("recalculated matches for buyer", { buyerId, candidates: sellers.length, matched: count });
  return count;
}

function candidateBuyerWhere(seller: Seller, tenantId: string): Prisma.BuyerWhereInput {
  const where: Prisma.BuyerWhereInput = {
    tenantId,
    status: { notIn: ["CLOSED", "ARCHIVED"] },
  };
  if (seller.transactionType === "SALE") where.transactionType = { in: ["BUY", "SALE"] };
  else if (seller.transactionType === "RENT") where.transactionType = { in: ["RENT", "LEASE"] };
  else if (seller.transactionType === "LEASE") where.transactionType = { in: ["LEASE", "RENT"] };
  if (seller.city) where.OR = [{ city: seller.city }, { city: null }];
  return where;
}

export async function recalculateForSeller(tenantId: string, sellerId: string): Promise<number> {
  const seller = await prisma.seller.findFirst({ where: { id: sellerId, tenantId } });
  if (!seller) return 0;
  if (["SOLD", "RENTED", "ARCHIVED", "UNDER_OFFER"].includes(seller.status)) {
    await prisma.match.deleteMany({ where: { tenantId, sellerId } });
    return 0;
  }
  const buyers = await prisma.buyer.findMany({ where: candidateBuyerWhere(seller, tenantId) });
  let count = 0;
  for (const buyer of buyers) {
    if (await upsertMatch(tenantId, buyer, seller)) count += 1;
  }
  logger.debug("recalculated matches for seller", { sellerId, candidates: buyers.length, matched: count });
  return count;
}

/** Full recalculation (used by the manual "recalculate" action). */
export async function recalculateAll(tenantId: string): Promise<number> {
  const buyers = await prisma.buyer.findMany({ where: { tenantId, status: { notIn: ["CLOSED", "ARCHIVED"] } } });
  let total = 0;
  for (const buyer of buyers) {
    total += await recalculateForBuyer(tenantId, buyer.id);
  }
  return total;
}
