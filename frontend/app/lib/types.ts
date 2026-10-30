// Plain client-facing types (no server imports so they are safe in the browser bundle).

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
  media?: MediaDTO[];
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
  media?: MediaDTO[];
}

export interface MediaDTO {
  id: string;
  mediaType: string;
  caption: string | null;
  aiDescription: string | null;
  url: string;
  thumbnailUrl: string;
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

export interface FieldDTO {
  id: string;
  fieldKey: string;
  label: string;
  dataType: string;
  entityTypes: string;
  isCore: boolean;
  options: string[];
  aliases: string[];
  unitOptions: string[];
  isActive: boolean;
  isSearchable: boolean;
  showInTable: boolean;
  showInDetail: boolean;
  includeInExport: boolean;
  aiExtractable: boolean;
  displayOrder: number;
}

export interface StatusResponse {
  whatsapp: { configured: boolean; missing: string[]; businessNumber: string | null; status: string };
  ai: { provider: string; model: string; configured: boolean; visionEnabled: boolean };
  gridcraftWebUrl: string | null;
  warnings: string[];
  summary: {
    totalBuyers: number;
    totalSellers: number;
    strongMatches: number;
    needsReview: number;
    pendingSenders: number;
    lastSync: string | null;
    trends?: {
      buyers: Trend;
      sellers: Trend;
      strongMatches: Trend;
      needsReview: Trend;
    };
  };
}

export interface Trend {
  direction: "up" | "down" | "flat";
  percent: number;
}

export interface ProcessResult {
  success: boolean;
  detectedType: string;
  status: string;
  duplicate: boolean;
  confidence: number;
  createdRecords: Array<{ id: string; type: string; sourceSegment: string | null }>;
  needsReview: boolean;
  reviewReasons: string[];
  summary: string;
  message: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
