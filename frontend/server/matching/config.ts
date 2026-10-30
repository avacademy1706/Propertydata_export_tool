/** Weighted scoring configuration. Weights sum to 1.0. Tunable per tenant later. */
export interface ScoringConfig {
  version: string;
  weights: {
    location: number;
    budget: number;
    propertyType: number;
    bhk: number;
    area: number;
    features: number;
    facing: number;
  };
  budgetTolerance: number; // fraction over max budget still scored (declining)
  minCriteriaForScore: number; // below this many known criteria -> Insufficient Data
  bands: { excellent: number; strong: number; possible: number };
}

/** Matches below this score, or with insufficient data, are not persisted (noise). */
export const MIN_PERSIST_SCORE = 40;

export const DEFAULT_SCORING: ScoringConfig = {
  version: "2026.10.1",
  weights: {
    location: 0.3,
    budget: 0.25,
    propertyType: 0.15,
    bhk: 0.1,
    area: 0.1,
    features: 0.05,
    facing: 0.05,
  },
  budgetTolerance: 0.1,
  minCriteriaForScore: 3,
  bands: { excellent: 90, strong: 75, possible: 60 },
};

export type MatchBand = "excellent" | "strong" | "possible" | "low" | "insufficient_data";

export function scoreBand(score: number, insufficient: boolean, cfg: ScoringConfig = DEFAULT_SCORING): MatchBand {
  if (insufficient) return "insufficient_data";
  if (score >= cfg.bands.excellent) return "excellent";
  if (score >= cfg.bands.strong) return "strong";
  if (score >= cfg.bands.possible) return "possible";
  return "low";
}

export function bandLabel(band: MatchBand): string {
  switch (band) {
    case "excellent":
      return "Excellent";
    case "strong":
      return "Strong";
    case "possible":
      return "Possible";
    case "low":
      return "Low priority";
    case "insufficient_data":
      return "Insufficient data";
  }
}
