import type { Prisma } from "@/generated/prisma/client.ts";

/**
 * Initial administrator-configurable field catalogue (the product owner's
 * requested list). These are seeds, not a hardcoded schema: admins can rename,
 * reorder, disable, add options, or add new fields through Field Settings.
 *
 * "isCore" fields map to typed database columns used for search and matching;
 * the rest live in the custom_fields JSON on each record.
 */

type FieldSeed = Omit<Prisma.CustomFieldDefinitionCreateManyInput, "tenantId">;

export const FIELD_CATALOGUE: FieldSeed[] = [
  // --- Core typed fields (searchable / used for matching) --------------
  core("date", "Date", "DATE", "BOTH", { order: 1, showInTable: true }),
  core("contact_name", "Name", "TEXT", "BOTH", { order: 2, showInTable: true, searchable: true, aliases: ["name", "owner", "broker", "contact"] }),
  core("phone", "Phone Number", "PHONE", "BOTH", { order: 3, showInTable: true, searchable: true, aliases: ["mob number", "mobile", "mob", "contact number", "whatsapp number"] }),
  core("email", "Email", "EMAIL", "BOTH", { order: 4 }),
  core("transaction_type", "Transaction Type", "SINGLE_SELECT", "BOTH", {
    order: 5,
    showInTable: true,
    searchable: true,
    options: ["Sale", "Rent", "Lease", "Requirement to Buy", "Requirement to Rent", "Requirement to Lease"],
    aliases: ["sale", "rent", "lease", "for sale", "for rent", "bikri", "kiraya"],
  }),
  core("property_category", "Property Category", "SINGLE_SELECT", "BOTH", {
    order: 6,
    showInTable: true,
    searchable: true,
    options: ["Residential", "Commercial", "Logistics", "Agriculture", "Mixed Use", "Other"],
    aliases: ["resi", "residential", "commercial", "logistic", "agriculture", "agri"],
  }),
  core("property_type", "Property Type", "SINGLE_SELECT", "BOTH", {
    order: 7,
    showInTable: true,
    searchable: true,
    options: ["Plot", "Apartment / Flat", "Villa", "Independent House", "Office", "Shop", "Godown / Warehouse", "Guest House", "Other"],
    aliases: ["plot", "flat", "apartment", "villa", "office", "shop", "godown", "guest house"],
  }),
  core("location", "Location", "LOCATION", "BOTH", { order: 8, showInTable: true, searchable: true, aliases: ["locality", "area"] }),
  core("full_address", "Address", "LONG_TEXT", "BOTH", { order: 9, aliases: ["address"] }),
  core("district", "District", "TEXT", "BOTH", { order: 10, searchable: true, aliases: ["distt", "district"] }),
  core("city", "City", "TEXT", "BOTH", { order: 11, showInTable: true, searchable: true }),
  core("price_amount", "Rate / Price", "CURRENCY", "BOTH", { order: 12, showInTable: true, searchable: true, aliases: ["rate", "price", "budget", "asking"] }),
  core("price_basis", "Rate Basis", "SINGLE_SELECT", "BOTH", {
    order: 13,
    options: ["Total", "Per Sq Ft", "Per Sq Yd", "Per Acre", "Per Bigha", "Per Month", "Per Year"],
  }),
  core("area_value", "Area", "MEASUREMENT", "BOTH", {
    order: 14,
    showInTable: true,
    searchable: true,
    units: ["sq_ft", "sq_yd", "sq_m", "acre", "bigha", "biswa"],
    aliases: ["area", "feet", "sqft", "square feet", "yds", "gaj", "acre", "bigha", "biswa", "built up"],
  }),
  core("area_type", "Area Type", "SINGLE_SELECT", "BOTH", { order: 15, options: ["Plot", "Built Up", "Carpet", "Super", "Land", "Unknown"] }),
  core("front_width", "Front Width", "MEASUREMENT", "BOTH", { order: 16, units: ["ft", "m", "yd"], aliases: ["front", "frontage"] }),
  core("road_width", "Road Width", "MEASUREMENT", "BOTH", { order: 17, units: ["ft", "m", "yd"], aliases: ["road width"] }),
  core("bhk", "BHK", "NUMBER", "BOTH", { order: 18, showInTable: true, searchable: true }),
  core("facing", "Facing", "SINGLE_SELECT", "BOTH", {
    order: 19,
    options: ["North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West", "Other"],
  }),
  core("furnishing_status", "Furnished", "SINGLE_SELECT", "BOTH", {
    order: 20,
    options: ["Furnished", "Semi-Furnished", "Unfurnished", "Raw / Unfinished", "Not Specified"],
    aliases: ["furnished", "semi furnished", "unfurnished", "raw"],
  }),
  core("building_configuration", "Building Configuration", "SINGLE_SELECT", "SELLER", {
    order: 21,
    options: ["Simplex", "Duplex", "Triplex", "Not Applicable"],
    aliases: ["simplex", "duplex", "triplex"],
  }),
  core("floor", "Floor", "TEXT", "BOTH", { order: 22, aliases: ["floor"] }),
  core("deal_source", "Broker / Direct", "SINGLE_SELECT", "BOTH", {
    order: 23,
    options: ["Broker", "Direct", "Newspaper", "WhatsApp", "Reference", "Other"],
    aliases: ["broker", "direct", "news paper", "newspaper", "reference", "refrence"],
  }),
  core("google_maps_url", "Google Location", "URL", "BOTH", { order: 24, aliases: ["google location", "map"] }),

  // --- Configurable custom fields (JSON-backed) ------------------------
  custom("property_setting", "Property Setting", "SINGLE_SELECT", "SELLER", {
    order: 30,
    options: ["Apartment Complex", "Commercial Complex", "Township", "Colony", "Independent Property", "Other"],
    aliases: ["apartment complex", "commercial complex", "township", "colony"],
  }),
  custom("accommodation", "Accommodation", "LONG_TEXT", "BOTH", { order: 31, aliases: ["accommodation", "servant room", "store room"] }),
  custom("intended_use", "Intended Use", "TEXT", "BUYER", { order: 32, aliases: ["use", "purpose"] }),
  custom("newspaper_ref", "News Paper", "TEXT", "BOTH", { order: 33, aliases: ["news paper", "newspaper"] }),
  custom("reference_detail", "Reference", "TEXT", "BOTH", { order: 34, aliases: ["refrence", "reference"] }),
  custom("timeline", "Timeline", "TEXT", "BUYER", { order: 35, aliases: ["timeline", "urgency"] }),
  custom("photo", "Photo", "MEDIA", "BOTH", { order: 36, aiExtractable: false }),
];

interface Opts {
  order: number;
  showInTable?: boolean;
  searchable?: boolean;
  options?: string[];
  units?: string[];
  aliases?: string[];
  aiExtractable?: boolean;
}

function core(
  key: string,
  label: string,
  dataType: Prisma.CustomFieldDefinitionCreateManyInput["dataType"],
  entity: Prisma.CustomFieldDefinitionCreateManyInput["entityTypes"],
  opts: Opts,
): FieldSeed {
  return build(key, label, dataType, entity, opts, true);
}

function custom(
  key: string,
  label: string,
  dataType: Prisma.CustomFieldDefinitionCreateManyInput["dataType"],
  entity: Prisma.CustomFieldDefinitionCreateManyInput["entityTypes"],
  opts: Opts,
): FieldSeed {
  return build(key, label, dataType, entity, opts, false);
}

function build(
  key: string,
  label: string,
  dataType: Prisma.CustomFieldDefinitionCreateManyInput["dataType"],
  entity: Prisma.CustomFieldDefinitionCreateManyInput["entityTypes"],
  opts: Opts,
  isCore: boolean,
): FieldSeed {
  return {
    fieldKey: key,
    label,
    dataType,
    entityTypes: entity,
    isCore,
    options: (opts.options ?? []) as unknown as Prisma.InputJsonValue,
    aliases: (opts.aliases ?? []) as unknown as Prisma.InputJsonValue,
    unitOptions: (opts.units ?? []) as unknown as Prisma.InputJsonValue,
    isActive: true,
    isSearchable: opts.searchable ?? false,
    showInTable: opts.showInTable ?? false,
    showInDetail: true,
    includeInExport: true,
    aiExtractable: opts.aiExtractable ?? true,
    manualEntry: true,
    displayOrder: opts.order,
    exportOrder: opts.order,
  };
}
