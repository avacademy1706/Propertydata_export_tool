import { describe, it, expect } from "vitest";
import { scoreMatch, isEligiblePair, type BuyerForScore, type SellerForScore } from "@/server/matching/scorer.ts";

function buyer(overrides: Partial<BuyerForScore> = {}): BuyerForScore {
  return {
    id: "b1",
    transactionType: "BUY",
    propertyType: "apartment",
    preferredLocations: ["Gomti Nagar"],
    district: null,
    city: "Lucknow",
    minBudget: null,
    maxBudget: 7_000_000,
    budgetBasis: "total",
    bhk: 3,
    minAreaValue: null,
    maxAreaValue: null,
    areaUnit: null,
    areaType: null,
    requiredFeatures: ["Covered Parking", "Lift"],
    preferredFacing: [],
    ...overrides,
  };
}

function seller(overrides: Partial<SellerForScore> = {}): SellerForScore {
  return {
    id: "s1",
    transactionType: "SALE",
    status: "AVAILABLE",
    propertyType: "apartment",
    location: "Gomti Nagar",
    district: null,
    city: "Lucknow",
    priceAmount: 6_500_000,
    priceBasis: "total",
    bhk: 3,
    areaValue: 1300,
    areaUnit: "sq_ft",
    areaType: "built_up",
    features: ["Covered Parking", "Balcony"],
    facing: "east",
    ...overrides,
  };
}

describe("isEligiblePair", () => {
  it("allows BUY vs SALE", () => {
    expect(isEligiblePair(buyer(), seller())).toBe(true);
  });
  it("blocks a sold property", () => {
    expect(isEligiblePair(buyer(), seller({ status: "SOLD" }))).toBe(false);
  });
  it("blocks incompatible transaction types (buy vs rent)", () => {
    expect(isEligiblePair(buyer({ transactionType: "BUY" }), seller({ transactionType: "RENT" }))).toBe(false);
  });
});

describe("scoreMatch", () => {
  it("scores a strong apartment match high (A vs B)", () => {
    const result = scoreMatch(buyer(), seller());
    expect(result.matchScore).toBeGreaterThanOrEqual(90);
    expect(result.band).toBe("excellent");
    expect(result.matchReasons.join(" ")).toMatch(/location/i);
    expect(result.insufficientData).toBe(false);
  });

  it("penalizes a price above budget", () => {
    const result = scoreMatch(buyer({ maxBudget: 5_000_000 }), seller({ priceAmount: 9_000_000 }));
    expect(result.rawScores.budget).toBeLessThan(0.5);
  });

  it("gives zero for an incompatible property type (plot vs apartment)", () => {
    const result = scoreMatch(buyer({ propertyType: "plot", bhk: null }), seller({ propertyType: "apartment" }));
    expect(result.rawScores.propertyType).toBe(0);
  });

  it("does not compare different price bases", () => {
    const result = scoreMatch(
      buyer({ budgetBasis: "per_sq_ft" }),
      seller({ priceBasis: "total" }),
    );
    expect(result.rawScores.budget).toBeNull();
  });

  it("reports Insufficient Data when too few criteria are known", () => {
    const sparseBuyer = buyer({
      propertyType: null,
      preferredLocations: [],
      city: null,
      maxBudget: null,
      bhk: null,
      requiredFeatures: [],
      preferredFacing: [],
    });
    const sparseSeller = seller({ propertyType: null, location: null, city: null, priceAmount: null, bhk: null, features: [], facing: null, areaValue: null });
    const result = scoreMatch(sparseBuyer, sparseSeller);
    expect(result.insufficientData).toBe(true);
    expect(result.band).toBe("insufficient_data");
  });

  it("marks missing criteria as not comparable rather than a mismatch", () => {
    const result = scoreMatch(buyer({ preferredFacing: [] }), seller({ facing: null }));
    expect(result.unknownCriteria).toContain("facing");
  });
});
