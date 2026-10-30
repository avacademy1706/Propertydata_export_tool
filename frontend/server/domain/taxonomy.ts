/**
 * Canonical real estate vocabulary plus the aliases/synonyms (English, Hindi,
 * Hinglish) the extractors should recognize. These are seeded as the initial
 * configuration; administrators can extend options through Field Settings.
 */

export const TRANSACTION_TYPES = ["buy", "sale", "rent", "lease"] as const;
export type TransactionTypeValue = (typeof TRANSACTION_TYPES)[number];

export const PROPERTY_CATEGORIES = [
  "residential",
  "commercial",
  "logistics",
  "agriculture",
  "mixed_use",
  "other",
] as const;
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export const PROPERTY_TYPES = [
  "plot",
  "apartment",
  "villa",
  "independent_house",
  "office",
  "shop",
  "godown",
  "guest_house",
  "other",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const FURNISHING_STATUSES = [
  "furnished",
  "semi_furnished",
  "unfurnished",
  "raw",
  "not_specified",
] as const;
export type FurnishingStatus = (typeof FURNISHING_STATUSES)[number];

export const BUILDING_CONFIGS = ["simplex", "duplex", "triplex", "not_applicable"] as const;
export type BuildingConfig = (typeof BUILDING_CONFIGS)[number];

export const DEAL_SOURCES = ["broker", "direct", "newspaper", "whatsapp", "reference", "other"] as const;
export type DealSource = (typeof DEAL_SOURCES)[number];

export const PROPERTY_SETTINGS = [
  "apartment_complex",
  "commercial_complex",
  "township",
  "colony",
  "independent_property",
  "other",
] as const;

export const FACINGS = [
  "north",
  "south",
  "east",
  "west",
  "north_east",
  "north_west",
  "south_east",
  "south_west",
  "other",
] as const;
export type Facing = (typeof FACINGS)[number];

export const AREA_TYPES = ["plot", "built_up", "carpet", "super", "land", "unknown"] as const;

interface AliasMap<T extends string> {
  value: T;
  patterns: RegExp[];
}

export const PROPERTY_TYPE_ALIASES: AliasMap<PropertyType>[] = [
  { value: "apartment", patterns: [/\b(apartment|flat|flats|apt|अपार्टमेंट|फ्लैट)\b/i, /\b\d+\s*bhk\b/i] },
  { value: "villa", patterns: [/\b(villa|villas|बंगला|विला|bungalow|kothi|कोठी)\b/i] },
  { value: "independent_house", patterns: [/\b(independent\s*house|house|makan|मकान|घर)\b/i] },
  { value: "plot", patterns: [/\b(plot|plots|land|jamin|जमीन|ज़मीन|zameen|parcel|khasra)\b/i] },
  { value: "office", patterns: [/\b(office|offices|ऑफिस|workspace)\b/i] },
  { value: "shop", patterns: [/\b(shop|shops|showroom|retail|दुकान|dukan)\b/i] },
  { value: "godown", patterns: [/\b(godown|warehouse|गोदाम|storage\s*unit)\b/i] },
  { value: "guest_house", patterns: [/\b(guest\s*house|गेस्ट\s*हाउस)\b/i] },
];

export const CATEGORY_ALIASES: AliasMap<PropertyCategory>[] = [
  { value: "residential", patterns: [/\b(residential|resi|rera|आवासीय|रिहायशी)\b/i] },
  { value: "commercial", patterns: [/\b(commercial|comm|व्यावसायिक|कमर्शियल)\b/i] },
  { value: "logistics", patterns: [/\b(logistic|logistics|warehous(e|ing))\b/i] },
  { value: "agriculture", patterns: [/\b(agri|agriculture|agricultural|खेती|कृषि|farm\s*land)\b/i] },
  { value: "mixed_use", patterns: [/\b(mixed[-\s]?use)\b/i] },
];

export const FURNISHING_ALIASES: AliasMap<FurnishingStatus>[] = [
  { value: "semi_furnished", patterns: [/\b(semi[-\s]?furnished|सेमी\s*फर्निश)\b/i] },
  { value: "furnished", patterns: [/\b(fully\s*furnished|furnished|फर्निश्ड|सुसज्जित)\b/i] },
  { value: "unfurnished", patterns: [/\b(unfurnished|un[-\s]?furnished|खाली)\b/i] },
  { value: "raw", patterns: [/\b(raw\s*(structure|unit)|unfinished)\b/i] },
];

export const BUILDING_CONFIG_ALIASES: AliasMap<BuildingConfig>[] = [
  { value: "triplex", patterns: [/\b(triplex|triple\s*story|triple\s*storey)\b/i] },
  { value: "duplex", patterns: [/\b(duplex|double\s*story|double\s*storey|डुप्लेक्स)\b/i] },
  { value: "simplex", patterns: [/\b(simplex|single\s*story|single\s*storey)\b/i] },
];

export const FACING_ALIASES: AliasMap<Facing>[] = [
  { value: "north_east", patterns: [/\b(north[-\s]?east|n[-\s]?e|ईशान)\b/i] },
  { value: "north_west", patterns: [/\b(north[-\s]?west|n[-\s]?w)\b/i] },
  { value: "south_east", patterns: [/\b(south[-\s]?east|s[-\s]?e)\b/i] },
  { value: "south_west", patterns: [/\b(south[-\s]?west|s[-\s]?w)\b/i] },
  { value: "north", patterns: [/\b(north|उत्तर)\s*(facing|मुखी)?\b/i] },
  { value: "south", patterns: [/\b(south|दक्षिण)\s*(facing|मुखी)?\b/i] },
  { value: "east", patterns: [/\b(east|पूर्व|पूरब)\s*(facing|मुखी)?\b/i] },
  { value: "west", patterns: [/\b(west|पश्चिम)\s*(facing|मुखी)?\b/i] },
];

export const TRANSACTION_ALIASES: Array<{ value: TransactionTypeValue; requirement: boolean; patterns: RegExp[] }> = [
  { value: "lease", requirement: false, patterns: [/\b(on\s*lease|for\s*lease|lease|लीज़|लीज)\b/i] },
  { value: "rent", requirement: false, patterns: [/\b(for\s*rent|on\s*rent|rent|rental|किराय[ेा]|भाड़ा)\b/i] },
  { value: "sale", requirement: false, patterns: [/\b(for\s*sale|on\s*sale|sale|selling|bikri|बिक्री|बिकाऊ|बेचना)\b/i] },
];

export const REQUIREMENT_SIGNALS = [
  /\b(required|requirement|looking\s*for|need(ed)?|want(ed)?|wanted|urgent\s*requirement|in\s*search\s*of|chahiye|चाहिए|आवश्यकता|ज़रूरत|जरूरत)\b/i,
];

export const AVAILABILITY_SIGNALS = [
  /\b(available|for\s*sale|for\s*rent|on\s*lease|up\s*for\s*sale|ready\s*to\s*move|uplabdh|उपलब्ध|बिक्री\s*हेतु|बिकाऊ)\b/i,
];

export const FEATURE_KEYWORDS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Covered Parking", patterns: [/\b(covered\s*(car\s*)?parking|covered\s*park)\b/i] },
  { label: "Parking", patterns: [/\bparking\b/i, /\bपार्किंग\b/] },
  { label: "Lift", patterns: [/\b(lift|elevator)\b/i] },
  { label: "Balcony", patterns: [/\bbalcon(y|ies)\b/i, /\bबालकनी\b/] },
  { label: "Modular Kitchen", patterns: [/\b(modular|modern)\s*kitchen\b/i] },
  { label: "Store Room", patterns: [/\b(store\s*room|store|स्टोर)\b/i] },
  { label: "Servant Room", patterns: [/\b(servant\s*room|servant\s*quarter)\b/i] },
  { label: "Power Backup", patterns: [/\b(power\s*backup|generator|inverter)\b/i] },
  { label: "Gated Security", patterns: [/\b(gated|security|guard|सुरक्षा)\b/i] },
  { label: "Ready to Move", patterns: [/\b(ready\s*to\s*move|rtm|ready\s*possession)\b/i] },
  { label: "Park Facing", patterns: [/\b(park\s*facing|garden\s*facing)\b/i] },
  { label: "Corner", patterns: [/\b(corner\s*(plot|unit|property))\b/i] },
  { label: "Main Road", patterns: [/\b(main\s*road|highway\s*facing|road\s*facing)\b/i] },
];

/** Buyer feature words map onto required features. */
export function extractFeatures(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const { label, patterns } of FEATURE_KEYWORDS) {
    if (patterns.some((p) => p.test(text))) {
      // Prefer the more specific "Covered Parking" over "Parking".
      if (label === "Parking" && seen.has("Covered Parking")) continue;
      if (label === "Covered Parking") seen.add("Covered Parking");
      if (!seen.has(label)) {
        seen.add(label);
        out.push(label);
      }
    }
  }
  return out;
}

function firstMatch<T extends string>(text: string, aliases: AliasMap<T>[]): T | null {
  for (const { value, patterns } of aliases) {
    if (patterns.some((p) => p.test(text))) return value;
  }
  return null;
}

export const detectPropertyType = (text: string) => firstMatch(text, PROPERTY_TYPE_ALIASES);
export const detectCategory = (text: string) => firstMatch(text, CATEGORY_ALIASES);
export const detectFurnishing = (text: string) => firstMatch(text, FURNISHING_ALIASES);
export const detectBuildingConfig = (text: string) => firstMatch(text, BUILDING_CONFIG_ALIASES);
export const detectFacing = (text: string) => firstMatch(text, FACING_ALIASES);

/** Compatible property-type groups for matching (a plot never matches a flat). */
export const PROPERTY_TYPE_COMPAT: Record<string, string[]> = {
  apartment: ["apartment"],
  villa: ["villa", "independent_house"],
  independent_house: ["independent_house", "villa"],
  plot: ["plot"],
  office: ["office"],
  shop: ["shop"],
  godown: ["godown"],
  guest_house: ["guest_house"],
  other: ["other"],
};

/** Which transaction types on each side are compatible for a match. */
export function transactionsCompatible(buyer: string, seller: string): boolean {
  const buyerWantsPurchase = buyer === "buy" || buyer === "sale";
  const sellerSells = seller === "sale";
  const buyerWantsRent = buyer === "rent";
  const buyerWantsLease = buyer === "lease";
  if (buyerWantsPurchase && sellerSells) return true;
  if (buyerWantsRent && (seller === "rent" || seller === "lease")) return true;
  if (buyerWantsLease && (seller === "lease" || seller === "rent")) return true;
  return false;
}
