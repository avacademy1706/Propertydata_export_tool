/**
 * Indian real estate currency normalization.
 *
 * Converts human expressions of money into a numeric rupee amount plus the
 * "basis" (total price vs a per-unit rate). The original text is always kept by
 * the caller; this module only interprets, it never invents a value.
 */

export type PriceBasis =
  | "total"
  | "per_sq_ft"
  | "per_sq_yd"
  | "per_sq_m"
  | "per_acre"
  | "per_bigha"
  | "per_biswa"
  | "monthly"
  | "annual";

export interface ParsedAmount {
  amount: number;
  basis: PriceBasis;
  currency: "INR";
  /** true when the text was ambiguous (e.g. a bare number that could be total or rate). */
  uncertain: boolean;
  raw: string;
}

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Convert a magnitude with an optional lakh/crore/thousand suffix to rupees. */
function applyScale(value: number, scale: string | undefined): number {
  switch ((scale ?? "").toLowerCase()) {
    case "cr":
    case "crore":
    case "crores":
    case "करोड़":
      return value * CRORE;
    case "l":
    case "lac":
    case "lakh":
    case "lakhs":
    case "lacs":
    case "लाख":
      return value * LAKH;
    case "k":
    case "thousand":
    case "हजार":
    case "हज़ार":
      return value * 1_000;
    default:
      return value;
  }
}

const SCALE_PATTERN = "cr|crore|crores|करोड़|l|lac|lacs|lakh|lakhs|लाख|k|thousand|हजार|हज़ार";

function detectBasis(context: string): { basis: PriceBasis; explicit: boolean } {
  const c = context.toLowerCase();
  if (/per\s*month|\/\s*month|monthly|p\.?m\.?|प्रति\s*माह|महीना/.test(c)) return { basis: "monthly", explicit: true };
  if (/per\s*(annum|year|yr)|annual|\/\s*year|सालाना|प्रति\s*वर्ष/.test(c)) return { basis: "annual", explicit: true };
  if (/per\s*sq\.?\s*(ft|feet|फीट)|\/\s*sq\.?\s*ft|\/\s*sqft|psf|प्रति\s*(sqft|स्क्वायर\s*फीट|वर्ग\s*फुट)/.test(c)) {
    return { basis: "per_sq_ft", explicit: true };
  }
  if (/per\s*(sq\.?\s*yd|gaj|गज)|\/\s*(sq\.?\s*yd|gaj)|प्रति\s*(गज|वर्ग\s*गज)/.test(c)) return { basis: "per_sq_yd", explicit: true };
  if (/per\s*sq\.?\s*(m|meter|metre)|\/\s*sq\.?\s*m/.test(c)) return { basis: "per_sq_m", explicit: true };
  if (/per\s*(bigha|बीघा)|\/\s*bigha|प्रति\s*बीघा/.test(c)) return { basis: "per_bigha", explicit: true };
  if (/per\s*(biswa|बिस्वा)|\/\s*biswa|प्रति\s*बिस्वा/.test(c)) return { basis: "per_biswa", explicit: true };
  if (/per\s*(acre|एकड़)|\/\s*acre|प्रति\s*एकड़/.test(c)) return { basis: "per_acre", explicit: true };
  return { basis: "total", explicit: false };
}

/**
 * Parse the first money expression found in `text`, optionally biased by the
 * transaction type (rent/lease defaults a bare amount to monthly).
 */
export function parseAmount(
  text: string,
  opts: { transactionKind?: "sale" | "buy" | "rent" | "lease" } = {},
): ParsedAmount | null {
  if (!text) return null;
  const cleaned = text.replace(/₹|rs\.?|inr|rupees?/gi, " ");

  // 1) number + scale word  e.g. "65 lakh", "2.1 cr", "16k"
  const scaleRe = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${SCALE_PATTERN})\\b`, "i");
  const scaleMatch = cleaned.match(scaleRe);

  // 2) Indian-grouped number  e.g. "65,00,000"
  const groupedRe = /(\d{1,3}(?:,\d{2})+(?:,\d{3})|\d{1,3}(?:,\d{3})+)(?:\.\d+)?/;
  const groupedMatch = cleaned.match(groupedRe);

  // 3) plain number
  const plainRe = /(\d+(?:\.\d+)?)/;
  const plainMatch = cleaned.match(plainRe);

  let amount: number | null = null;
  let matchIndex = -1;
  let matched = "";

  if (scaleMatch && scaleMatch.index !== undefined) {
    amount = applyScale(parseFloat(scaleMatch[1].replace(/,/g, ".").replace(/,/g, "")), scaleMatch[2]);
    matchIndex = scaleMatch.index;
    matched = scaleMatch[0];
  } else if (groupedMatch && groupedMatch.index !== undefined) {
    amount = parseFloat(groupedMatch[0].replace(/,/g, ""));
    matchIndex = groupedMatch.index;
    matched = groupedMatch[0];
  } else if (plainMatch && plainMatch.index !== undefined) {
    amount = parseFloat(plainMatch[1]);
    matchIndex = plainMatch.index;
    matched = plainMatch[0];
  }

  if (amount === null || !Number.isFinite(amount)) return null;

  // Look at a window around the number for a basis hint.
  const windowText = cleaned.slice(Math.max(0, matchIndex - 4), matchIndex + matched.length + 14);
  const { basis, explicit } = detectBasis(windowText);

  let finalBasis: PriceBasis = basis;
  let uncertain = false;

  if (!explicit) {
    if (opts.transactionKind === "rent" || opts.transactionKind === "lease") {
      finalBasis = "monthly";
    } else {
      finalBasis = "total";
      // A small bare number in a sale context is suspicious as a total price.
      if (amount < 100_000 && (opts.transactionKind === "sale" || opts.transactionKind === undefined)) {
        uncertain = true;
      }
    }
  }

  return { amount, basis: finalBasis, currency: "INR", uncertain, raw: matched.trim() };
}

/** Human-readable rupee formatting with lakh/crore grouping. */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "";
  const rounded = Math.round(amount);
  if (rounded >= CRORE) return `₹${trimZeros(rounded / CRORE)} Cr`;
  if (rounded >= LAKH) return `₹${trimZeros(rounded / LAKH)} L`;
  if (rounded >= 1000) return `₹${trimZeros(rounded / 1000)}K`;
  return `₹${rounded}`;
}

export function basisLabel(basis: PriceBasis | string | null | undefined): string {
  switch (basis) {
    case "total":
      return "total";
    case "per_sq_ft":
      return "per sq ft";
    case "per_sq_yd":
      return "per sq yd";
    case "per_sq_m":
      return "per sq m";
    case "per_acre":
      return "per acre";
    case "per_bigha":
      return "per bigha";
    case "per_biswa":
      return "per biswa";
    case "monthly":
      return "per month";
    case "annual":
      return "per year";
    default:
      return basis ?? "";
  }
}

function trimZeros(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
