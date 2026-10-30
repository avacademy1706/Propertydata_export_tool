import {
  DEFAULT_SCORING,
  scoreBand,
  type MatchBand,
  type ScoringConfig,
} from "@/server/matching/config.ts";
import { PROPERTY_TYPE_COMPAT, transactionsCompatible } from "@/server/domain/taxonomy.ts";
import { FIXED_SQFT_PER_UNIT, REGION_DEPENDENT_UNITS } from "@/server/normalize/units.ts";

/**
 * Deterministic, explainable matching. No language model produces the score.
 * Each criterion returns a value in [0,1] or "unknown"; the weighted average is
 * computed over KNOWN criteria only, and data completeness is reported alongside.
 */

export interface BuyerForScore {
  id: string;
  transactionType: string;
  propertyType?: string | null;
  preferredLocations: string[];
  district?: string | null;
  city?: string | null;
  minBudget?: number | null;
  maxBudget?: number | null;
  budgetBasis?: string | null;
  bhk?: number | null;
  minAreaValue?: number | null;
  maxAreaValue?: number | null;
  areaUnit?: string | null;
  areaType?: string | null;
  requiredFeatures: string[];
  preferredFacing: string[];
}

export interface SellerForScore {
  id: string;
  transactionType: string;
  status: string;
  propertyType?: string | null;
  location?: string | null;
  district?: string | null;
  city?: string | null;
  priceAmount?: number | null;
  priceBasis?: string | null;
  bhk?: number | null;
  areaValue?: number | null;
  areaUnit?: string | null;
  areaType?: string | null;
  features: string[];
  facing?: string | null;
}

type CriterionKey = "location" | "budget" | "propertyType" | "bhk" | "area" | "features" | "facing";

interface CriterionResult {
  score: number | null; // null = unknown / not comparable
  reason?: string;
  mismatch?: string;
}

export interface ScoreResult {
  eligible: boolean;
  matchScore: number;
  dataCompleteness: number;
  insufficientData: boolean;
  band: MatchBand;
  breakdown: Record<CriterionKey, number>;
  rawScores: Record<CriterionKey, number | null>;
  matchReasons: string[];
  mismatchReasons: string[];
  unknownCriteria: string[];
  scoringVersion: string;
}

const ADJACENT_BHK_SCORE = 0.5;

export function scoreMatch(
  buyer: BuyerForScore,
  seller: SellerForScore,
  cfg: ScoringConfig = DEFAULT_SCORING,
): ScoreResult {
  const results: Record<CriterionKey, CriterionResult> = {
    location: scoreLocation(buyer, seller),
    budget: scoreBudget(buyer, seller, cfg),
    propertyType: scorePropertyType(buyer, seller),
    bhk: scoreBhk(buyer, seller),
    area: scoreArea(buyer, seller),
    features: scoreFeatures(buyer, seller),
    facing: scoreFacing(buyer, seller),
  };

  const weights = cfg.weights;
  const keys = Object.keys(weights) as CriterionKey[];

  let weightedSum = 0;
  let knownWeight = 0;
  let knownCount = 0;
  const breakdown = {} as Record<CriterionKey, number>;
  const rawScores = {} as Record<CriterionKey, number | null>;
  const matchReasons: string[] = [];
  const mismatchReasons: string[] = [];
  const unknownCriteria: string[] = [];

  for (const key of keys) {
    const r = results[key];
    rawScores[key] = r.score;
    if (r.score === null) {
      breakdown[key] = 0;
      unknownCriteria.push(key);
      continue;
    }
    const points = r.score * weights[key] * 100;
    breakdown[key] = round2(points);
    weightedSum += points;
    knownWeight += weights[key];
    knownCount += 1;
    if (r.reason && r.score >= 0.75) matchReasons.push(r.reason);
    if (r.mismatch && r.score < 0.75) mismatchReasons.push(r.mismatch);
  }

  // Normalize over known weight so missing data neither helps nor fully hurts.
  const matchScore = knownWeight > 0 ? round2(weightedSum / knownWeight) : 0;
  const dataCompleteness = round3(knownWeight); // weights sum to 1, so this is 0..1
  const insufficientData = knownCount < cfg.minCriteriaForScore;
  const band = scoreBand(matchScore, insufficientData, cfg);

  return {
    eligible: true,
    matchScore,
    dataCompleteness,
    insufficientData,
    band,
    breakdown,
    rawScores,
    matchReasons,
    mismatchReasons,
    unknownCriteria,
    scoringVersion: cfg.version,
  };
}

/** Transaction + availability gate. Returns null when the pair is ineligible. */
export function isEligiblePair(buyer: BuyerForScore, seller: SellerForScore): boolean {
  if (["SOLD", "RENTED", "ARCHIVED", "UNDER_OFFER"].includes(seller.status)) return false;
  return transactionsCompatible(buyer.transactionType.toLowerCase(), seller.transactionType.toLowerCase());
}

function scoreLocation(buyer: BuyerForScore, seller: SellerForScore): CriterionResult {
  const buyerLocs = buyer.preferredLocations.map((l) => l.toLowerCase().trim()).filter(Boolean);
  const sellerLoc = (seller.location ?? "").toLowerCase().trim();
  const buyerCity = (buyer.city ?? "").toLowerCase().trim();
  const sellerCity = (seller.city ?? "").toLowerCase().trim();

  if (buyerLocs.length === 0 && !buyerCity) return { score: null };
  if (!sellerLoc && !sellerCity) return { score: null };

  if (sellerLoc && buyerLocs.some((b) => b === sellerLoc)) {
    return { score: 1, reason: `Exact location match (${seller.location})` };
  }
  if (sellerLoc && buyerLocs.some((b) => b.includes(sellerLoc) || sellerLoc.includes(b))) {
    return { score: 0.8, reason: `Location overlaps (${seller.location})` };
  }
  if (buyerCity && sellerCity && buyerCity === sellerCity) {
    return { score: 0.5, reason: `Same city (${seller.city})`, mismatch: "Different locality within the same city" };
  }
  if (buyerCity && sellerCity && buyerCity !== sellerCity) {
    return { score: 0.1, mismatch: `Different city (buyer: ${buyer.city}, property: ${seller.city})` };
  }
  return { score: 0.2, mismatch: "Location does not clearly match" };
}

function scoreBudget(buyer: BuyerForScore, seller: SellerForScore, cfg: ScoringConfig): CriterionResult {
  const price = seller.priceAmount ?? null;
  const max = buyer.maxBudget ?? null;
  const min = buyer.minBudget ?? null;
  if (price === null || (max === null && min === null)) return { score: null };

  // Compare on the same basis where possible; otherwise flag softly.
  if (seller.priceBasis && buyer.budgetBasis && seller.priceBasis !== buyer.budgetBasis) {
    // Different basis (e.g. per_sq_ft vs total) is not directly comparable.
    return { score: null };
  }

  if (max !== null) {
    if (price <= max) {
      if (min !== null && price < min) {
        return { score: 0.85, reason: "Within budget (below the stated minimum)", mismatch: "Price is below the buyer's minimum" };
      }
      return { score: 1, reason: "Seller price is within the buyer's budget" };
    }
    const over = (price - max) / max;
    if (over <= cfg.budgetTolerance) {
      const score = 1 - over / cfg.budgetTolerance / 2; // 1.0 -> 0.5 across the tolerance band
      return { score: round2(Math.max(0.5, score)), reason: "Slightly above budget but within tolerance", mismatch: "Price is slightly above the buyer's budget" };
    }
    if (over <= cfg.budgetTolerance * 3) {
      return { score: 0.25, mismatch: `Price is ${Math.round(over * 100)}% above the buyer's budget` };
    }
    return { score: 0, mismatch: `Price is well above the buyer's budget` };
  }
  // Only a minimum budget known.
  if (min !== null && price >= min) return { score: 0.7, reason: "Price meets the buyer's minimum" };
  return { score: 0.3, mismatch: "Price below the buyer's minimum" };
}

function scorePropertyType(buyer: BuyerForScore, seller: SellerForScore): CriterionResult {
  const b = (buyer.propertyType ?? "").toLowerCase();
  const s = (seller.propertyType ?? "").toLowerCase();
  if (!b || !s) return { score: null };
  if (b === s) return { score: 1, reason: `Property type matches (${seller.propertyType})` };
  const compatible = PROPERTY_TYPE_COMPAT[b]?.includes(s) || PROPERTY_TYPE_COMPAT[s]?.includes(b);
  if (compatible) return { score: 0.8, reason: `Compatible property type (${seller.propertyType})` };
  return { score: 0, mismatch: `Property type differs (wants ${buyer.propertyType}, listing is ${seller.propertyType})` };
}

function scoreBhk(buyer: BuyerForScore, seller: SellerForScore): CriterionResult {
  // BHK does not apply to plots/shops/godowns.
  const nonBhk = ["plot", "shop", "godown"];
  if (nonBhk.includes((buyer.propertyType ?? "").toLowerCase())) return { score: null };
  if (buyer.bhk === null || buyer.bhk === undefined || seller.bhk === null || seller.bhk === undefined) {
    return { score: null };
  }
  if (buyer.bhk === seller.bhk) return { score: 1, reason: `${seller.bhk} BHK matches` };
  if (Math.abs(buyer.bhk - seller.bhk) === 1) {
    return { score: ADJACENT_BHK_SCORE, mismatch: `BHK differs by one (${seller.bhk} vs ${buyer.bhk})` };
  }
  return { score: 0, mismatch: `BHK does not match (${seller.bhk} vs ${buyer.bhk})` };
}

/** Convert an area value to sq ft when the unit is fixed; region units return null. */
function toSqFt(value: number | null | undefined, unit: string | null | undefined): number | null {
  if (value === null || value === undefined || !unit) return null;
  if (REGION_DEPENDENT_UNITS.has(unit)) return null;
  const factor = FIXED_SQFT_PER_UNIT[unit];
  return factor ? value * factor : null;
}

function scoreArea(buyer: BuyerForScore, seller: SellerForScore): CriterionResult {
  const sellerArea = toSqFt(seller.areaValue, seller.areaUnit);
  const min = toSqFt(buyer.minAreaValue, buyer.areaUnit);
  const max = toSqFt(buyer.maxAreaValue, buyer.areaUnit);
  if (sellerArea === null || (min === null && max === null)) return { score: null };

  // Comparing unlike area types (plot vs built-up) is not reliable.
  if (buyer.areaType && seller.areaType && buyer.areaType !== "unknown" && seller.areaType !== "unknown" && buyer.areaType !== seller.areaType) {
    return { score: null };
  }

  if (min !== null && max !== null) {
    if (sellerArea >= min && sellerArea <= max) return { score: 1, reason: "Area is within the required range" };
    if (sellerArea < min) {
      const ratio = sellerArea / min;
      return { score: round2(Math.max(0, ratio)), mismatch: "Area is below the preferred range" };
    }
    const ratio = max / sellerArea;
    return { score: round2(Math.max(0, ratio)), mismatch: "Area is above the preferred range" };
  }
  const target = (min ?? max) as number;
  const ratio = sellerArea >= target ? Math.min(1, target / sellerArea + 0.2) : sellerArea / target;
  return { score: round2(Math.max(0, Math.min(1, ratio))), reason: ratio >= 0.9 ? "Area is close to requirement" : undefined, mismatch: ratio < 0.75 ? "Area differs from requirement" : undefined };
}

function scoreFeatures(buyer: BuyerForScore, seller: SellerForScore): CriterionResult {
  const required = buyer.requiredFeatures.map((f) => f.toLowerCase().trim()).filter(Boolean);
  if (required.length === 0) return { score: null };
  const available = new Set(seller.features.map((f) => f.toLowerCase().trim()));
  let matched = 0;
  const missing: string[] = [];
  for (const f of required) {
    if (available.has(f) || [...available].some((a) => a.includes(f) || f.includes(a))) matched += 1;
    else missing.push(f);
  }
  const score = matched / required.length;
  const result: CriterionResult = { score: round2(score) };
  if (score >= 0.75) result.reason = `${matched}/${required.length} required features available`;
  if (missing.length) result.mismatch = `Missing features: ${missing.join(", ")}`;
  return result;
}

function scoreFacing(buyer: BuyerForScore, seller: SellerForScore): CriterionResult {
  const preferred = buyer.preferredFacing.map((f) => f.toLowerCase().trim()).filter(Boolean);
  if (preferred.length === 0) return { score: null };
  const facing = (seller.facing ?? "").toLowerCase().trim();
  if (!facing) return { score: null };
  if (preferred.includes(facing)) return { score: 1, reason: `${seller.facing} facing matches` };
  return { score: 0.2, mismatch: `Facing differs (wants ${buyer.preferredFacing.join("/")}, listing is ${seller.facing})` };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
