import ExcelJS from "exceljs";
import type { Buyer, Seller, Match, Prisma } from "@/generated/prisma/client.ts";
import { prisma } from "@/server/db/client.ts";
import { formatINR, basisLabel } from "@/server/normalize/currency.ts";
import { areaUnitLabel } from "@/server/normalize/units.ts";

/**
 * Builds a single .xlsx workbook with exactly three sheets: Buyers, Sellers,
 * Matching. Works entirely in the backend; GridCraft is not required.
 */

const ACCENT = "FF1D4ED8";
const HEADER_FILL = "FF1F2937";

function dec(v: Prisma.Decimal | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : Number(v.toString());
}

interface ExportFilters {
  buyerIds?: string[];
  sellerIds?: string[];
}

export interface WorkbookResult {
  buffer: Buffer;
  filename: string;
  counts: { buyers: number; sellers: number; matches: number };
}

export async function buildWorkbook(tenantId: string, filters: ExportFilters = {}): Promise<WorkbookResult> {
  const buyerWhere: Prisma.BuyerWhereInput = { tenantId };
  if (filters.buyerIds?.length) buyerWhere.id = { in: filters.buyerIds };
  const sellerWhere: Prisma.SellerWhereInput = { tenantId };
  if (filters.sellerIds?.length) sellerWhere.id = { in: filters.sellerIds };

  const [buyers, sellers, matches] = await Promise.all([
    prisma.buyer.findMany({ where: buyerWhere, orderBy: { createdAt: "desc" }, include: { mediaLinks: true } }),
    prisma.seller.findMany({ where: sellerWhere, orderBy: { createdAt: "desc" }, include: { mediaLinks: true } }),
    prisma.match.findMany({
      where: { tenantId },
      orderBy: { matchScore: "desc" },
      include: { buyer: true, seller: true },
    }),
  ]);

  const wb = composeWorkbook(buyers, sellers, matches);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    buffer,
    filename: `real-estate-export-${stamp}.xlsx`,
    counts: { buyers: buyers.length, sellers: sellers.length, matches: matches.length },
  };
}

/** Pure workbook composer (no database). Exposed for testing. */
export function composeWorkbook(
  buyers: Array<Buyer & { mediaLinks: unknown[] }>,
  sellers: Array<Seller & { mediaLinks: unknown[] }>,
  matches: Array<Match & { buyer: Buyer; seller: Seller }>,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Real Estate Data Tool";
  wb.created = new Date();
  wb.properties.date1904 = false;
  buildBuyersSheet(wb, buyers);
  buildSellersSheet(wb, sellers);
  buildMatchingSheet(wb, matches);
  return wb;
}

type Col = { header: string; width: number; style?: Partial<ExcelJS.Style> };

function styleHeader(sheet: ExcelJS.Worksheet, columnCount: number) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.height = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
}

function mediaCounts(links: { buyerId: string | null; sellerId: string | null }[]): number {
  return links.length;
}

function buildBuyersSheet(wb: ExcelJS.Workbook, buyers: Array<Buyer & { mediaLinks: unknown[] }>) {
  const sheet = wb.addWorksheet("Buyers", { properties: { defaultColWidth: 16 } });
  const cols: Col[] = [
    { header: "Buyer ID", width: 38 },
    { header: "Date", width: 12, style: { numFmt: "yyyy-mm-dd" } },
    { header: "Name", width: 18 },
    { header: "Phone Number", width: 16 },
    { header: "Email", width: 22 },
    { header: "Transaction Type", width: 16 },
    { header: "Property Category", width: 16 },
    { header: "Property Type", width: 16 },
    { header: "Preferred Location", width: 24 },
    { header: "District", width: 14 },
    { header: "City", width: 14 },
    { header: "Min Budget", width: 14, style: { numFmt: "#,##0" } },
    { header: "Max Budget", width: 14, style: { numFmt: "#,##0" } },
    { header: "Budget (display)", width: 16 },
    { header: "Rate Basis", width: 14 },
    { header: "Area", width: 12, style: { numFmt: "#,##0.##" } },
    { header: "Area Unit", width: 12 },
    { header: "Area Type", width: 12 },
    { header: "BHK", width: 8, style: { numFmt: "0" } },
    { header: "Facing", width: 12 },
    { header: "Furnished", width: 14 },
    { header: "Required Features", width: 28 },
    { header: "Intended Use", width: 18 },
    { header: "Timeline", width: 12 },
    { header: "Photo Count", width: 12, style: { numFmt: "0" } },
    { header: "Notes", width: 30 },
    { header: "Source", width: 10 },
    { header: "Source Message ID", width: 38 },
    { header: "Verification Status", width: 16 },
    { header: "Created At", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ];
  sheet.columns = cols.map((c) => ({ header: c.header, width: c.width, style: c.style }));

  for (const b of buyers) {
    sheet.addRow([
      b.id,
      b.receivedAt,
      b.contactName ?? "",
      b.phone ?? "",
      b.email ?? "",
      b.transactionType,
      b.propertyCategory ?? "",
      b.propertyType ?? "",
      (b.preferredLocations ?? []).join(", "),
      b.district ?? "",
      b.city ?? "",
      dec(b.minBudget),
      dec(b.maxBudget),
      formatINR(dec(b.maxBudget)),
      basisLabel(b.budgetBasis),
      dec(b.maxAreaValue),
      areaUnitLabel(b.areaUnit),
      b.areaType ?? "",
      b.bhk,
      b.preferredFacing?.join(", ") ?? "",
      b.furnishingStatus ?? "",
      (b.requiredFeatures ?? []).join(", "),
      b.intendedUse ?? "",
      b.timeline ?? "",
      mediaCounts(b.mediaLinks as { buyerId: string | null; sellerId: string | null }[]),
      b.notes ?? "",
      b.sourceMessageId ? "WhatsApp/Manual" : "Manual",
      b.sourceMessageId ?? "",
      b.verificationStatus,
      b.createdAt,
    ]);
  }
  if (buyers.length === 0) sheet.addRow(["No buyer records yet. Paste a requirement to get started."]);
  styleHeader(sheet, cols.length);
}

function buildSellersSheet(wb: ExcelJS.Workbook, sellers: Array<Seller & { mediaLinks: unknown[] }>) {
  const sheet = wb.addWorksheet("Sellers", { properties: { defaultColWidth: 16 } });
  const cols: Col[] = [
    { header: "Property ID", width: 38 },
    { header: "Date", width: 12, style: { numFmt: "yyyy-mm-dd" } },
    { header: "Name", width: 18 },
    { header: "Phone Number", width: 16 },
    { header: "Email", width: 22 },
    { header: "Transaction Type", width: 16 },
    { header: "Property Category", width: 16 },
    { header: "Property Type", width: 16 },
    { header: "Location", width: 24 },
    { header: "Landmark", width: 20 },
    { header: "District", width: 14 },
    { header: "City", width: 14 },
    { header: "Price", width: 14, style: { numFmt: "#,##0" } },
    { header: "Price (display)", width: 16 },
    { header: "Rate Basis", width: 14 },
    { header: "Area", width: 12, style: { numFmt: "#,##0.##" } },
    { header: "Area Unit", width: 12 },
    { header: "Area Type", width: 12 },
    { header: "Plot Area", width: 12, style: { numFmt: "#,##0.##" } },
    { header: "Front Width", width: 12 },
    { header: "Road Width", width: 12 },
    { header: "BHK", width: 8, style: { numFmt: "0" } },
    { header: "Facing", width: 12 },
    { header: "Furnished", width: 14 },
    { header: "Building Config", width: 14 },
    { header: "Floor", width: 12 },
    { header: "Property Setting", width: 16 },
    { header: "Features", width: 28 },
    { header: "Deal Source", width: 14 },
    { header: "Google Location", width: 22 },
    { header: "Claims (unverified)", width: 26 },
    { header: "Photo Count", width: 12, style: { numFmt: "0" } },
    { header: "Notes", width: 30 },
    { header: "Source Message ID", width: 38 },
    { header: "Availability", width: 14 },
    { header: "Verification Status", width: 16 },
    { header: "Created At", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ];
  sheet.columns = cols.map((c) => ({ header: c.header, width: c.width, style: c.style }));

  for (const s of sellers) {
    sheet.addRow([
      s.id,
      s.receivedAt,
      s.contactName ?? "",
      s.phone ?? "",
      s.email ?? "",
      s.transactionType,
      s.propertyCategory ?? "",
      s.propertyType ?? "",
      s.location ?? "",
      s.landmark ?? "",
      s.district ?? "",
      s.city ?? "",
      dec(s.priceAmount),
      formatINR(dec(s.priceAmount)),
      basisLabel(s.priceBasis),
      dec(s.areaValue),
      areaUnitLabel(s.areaUnit),
      s.areaType ?? "",
      dec(s.plotAreaValue),
      s.frontWidthValue ? `${dec(s.frontWidthValue)} ${s.frontWidthUnit ?? ""}`.trim() : "",
      s.roadWidthValue ? `${dec(s.roadWidthValue)} ${s.roadWidthUnit ?? ""}`.trim() : "",
      s.bhk,
      s.facing ?? "",
      s.furnishingStatus ?? "",
      s.buildingConfiguration ?? "",
      s.floor ?? "",
      s.propertySetting ?? "",
      (s.features ?? []).join(", "),
      s.dealSource ?? "",
      s.googleMapsUrl ?? "",
      (s.claims ?? []).join(" | "),
      mediaCounts(s.mediaLinks as { buyerId: string | null; sellerId: string | null }[]),
      s.notes ?? "",
      s.sourceMessageId ?? "",
      s.availability ?? s.status,
      s.verificationStatus,
      s.createdAt,
    ]);
  }
  if (sellers.length === 0) sheet.addRow(["No property records yet. Paste a listing to get started."]);
  styleHeader(sheet, cols.length);
}

function buildMatchingSheet(
  wb: ExcelJS.Workbook,
  matches: Array<Match & { buyer: Buyer; seller: Seller }>,
) {
  const sheet = wb.addWorksheet("Matching", { properties: { defaultColWidth: 16 } });
  const cols: Col[] = [
    { header: "Match ID", width: 38 },
    { header: "Buyer ID", width: 38 },
    { header: "Buyer Name", width: 18 },
    { header: "Buyer Phone", width: 16 },
    { header: "Seller ID", width: 38 },
    { header: "Seller Name", width: 18 },
    { header: "Seller Phone", width: 16 },
    { header: "Property Location", width: 22 },
    { header: "District", width: 14 },
    { header: "Property Category", width: 16 },
    { header: "Property Type", width: 16 },
    { header: "Asking Price", width: 14, style: { numFmt: "#,##0" } },
    { header: "Rate Basis", width: 14 },
    { header: "Area", width: 12, style: { numFmt: "#,##0.##" } },
    { header: "Area Unit", width: 12 },
    { header: "Match %", width: 10, style: { numFmt: "0.0" } },
    { header: "Data Completeness", width: 16, style: { numFmt: "0%" } },
    { header: "Location Score", width: 14, style: { numFmt: "0.0" } },
    { header: "Budget Score", width: 12, style: { numFmt: "0.0" } },
    { header: "Property Type Score", width: 16, style: { numFmt: "0.0" } },
    { header: "Area Score", width: 12, style: { numFmt: "0.0" } },
    { header: "Features Score", width: 12, style: { numFmt: "0.0" } },
    { header: "Match Reasons", width: 40 },
    { header: "Mismatch Reasons", width: 36 },
    { header: "Match Status", width: 14 },
    { header: "Calculated At", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ];
  sheet.columns = cols.map((c) => ({ header: c.header, width: c.width, style: c.style }));

  for (const m of matches) {
    const bd = (m.scoreBreakdown ?? {}) as Record<string, number>;
    const reasons = (m.matchReasons ?? []) as string[];
    const mismatches = (m.mismatchReasons ?? []) as string[];
    sheet.addRow([
      m.id,
      m.buyerId,
      m.buyer.contactName ?? "",
      m.buyer.phone ?? "",
      m.sellerId,
      m.seller.contactName ?? "",
      m.seller.phone ?? "",
      m.seller.location ?? "",
      m.seller.district ?? "",
      m.seller.propertyCategory ?? "",
      m.seller.propertyType ?? "",
      dec(m.seller.priceAmount),
      basisLabel(m.seller.priceBasis),
      dec(m.seller.areaValue),
      areaUnitLabel(m.seller.areaUnit),
      m.insufficientData ? null : dec(m.matchScore),
      dec(m.dataCompleteness),
      bd.location ?? 0,
      bd.budget ?? 0,
      bd.propertyType ?? 0,
      bd.area ?? 0,
      bd.features ?? 0,
      reasons.join(" · "),
      mismatches.join(" · "),
      m.insufficientData ? "Insufficient Data" : m.status,
      m.calculatedAt,
    ]);
  }
  if (matches.length === 0) sheet.addRow(["No matches yet. Add buyers and sellers to generate matches."]);
  styleHeader(sheet, cols.length);

  // Conditional formatting on the Match % column (P) for data rows.
  if (matches.length > 0) {
    const lastRow = matches.length + 1;
    sheet.addConditionalFormatting({
      ref: `P2:P${lastRow}`,
      rules: [
        { type: "cellIs", operator: "greaterThan", formulae: ["89.999"], priority: 1, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFBBF7D0" } } } },
        { type: "cellIs", operator: "between", formulae: ["75", "89.999"], priority: 2, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFD9F99D" } } } },
        { type: "cellIs", operator: "between", formulae: ["60", "74.999"], priority: 3, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFEF08A" } } } },
        { type: "cellIs", operator: "lessThan", formulae: ["60"], priority: 4, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFECACA" } } } },
      ],
    });
  }

  void ACCENT;
}
