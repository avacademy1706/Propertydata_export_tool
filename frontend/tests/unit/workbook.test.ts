import { describe, it, expect } from "vitest";
import { composeWorkbook } from "@/server/export/workbook.ts";

// Minimal row shapes; the composer only reads the fields it serializes.
function buyerRow() {
  return {
    id: "buyer-1",
    receivedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    contactName: "Asha",
    phone: "+918127211407",
    email: null,
    transactionType: "BUY",
    propertyCategory: "residential",
    propertyType: "apartment",
    preferredLocations: ["Gomti Nagar"],
    district: null,
    city: "Lucknow",
    maxBudget: 7_000_000,
    minBudget: null,
    budgetBasis: "total",
    maxAreaValue: null,
    areaUnit: null,
    areaType: null,
    bhk: 3,
    preferredFacing: [],
    furnishingStatus: null,
    requiredFeatures: ["Covered Parking"],
    intendedUse: null,
    timeline: null,
    notes: null,
    sourceMessageId: null,
    verificationStatus: "PENDING",
    mediaLinks: [],
  } as unknown as Parameters<typeof composeWorkbook>[0][number];
}

function sellerRow() {
  return {
    id: "seller-1",
    receivedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    contactName: "Yogesh",
    phone: "+918127211407",
    email: null,
    transactionType: "SALE",
    propertyCategory: "residential",
    propertyType: "apartment",
    location: "Gomti Nagar",
    landmark: null,
    district: null,
    city: "Lucknow",
    priceAmount: 6_500_000,
    priceBasis: "total",
    areaValue: 1300,
    areaUnit: "sq_ft",
    areaType: "built_up",
    plotAreaValue: null,
    frontWidthValue: null,
    frontWidthUnit: null,
    roadWidthValue: null,
    roadWidthUnit: null,
    bhk: 3,
    facing: "east",
    furnishingStatus: null,
    buildingConfiguration: null,
    floor: null,
    propertySetting: null,
    features: ["Covered Parking"],
    dealSource: null,
    googleMapsUrl: null,
    claims: [],
    notes: null,
    sourceMessageId: null,
    availability: null,
    status: "AVAILABLE",
    verificationStatus: "PENDING",
    mediaLinks: [],
  } as unknown as Parameters<typeof composeWorkbook>[1][number];
}

describe("composeWorkbook", () => {
  it("creates exactly three sheets named Buyers, Sellers, Matching", () => {
    const wb = composeWorkbook([buyerRow()], [sellerRow()], []);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual(["Buyers", "Sellers", "Matching"]);
  });

  it("writes a bold frozen header row on each sheet", () => {
    const wb = composeWorkbook([buyerRow()], [sellerRow()], []);
    for (const sheet of wb.worksheets) {
      expect(sheet.getRow(1).getCell(1).value).toBeTruthy();
      expect(sheet.views?.[0]?.state).toBe("frozen");
    }
  });

  it("uses numeric cells for prices", () => {
    const wb = composeWorkbook([buyerRow()], [sellerRow()], []);
    const sellers = wb.getWorksheet("Sellers")!;
    // Price column index from the Sellers column list (1-based): Price is column 13.
    const priceCell = sellers.getRow(2).getCell(13);
    expect(typeof priceCell.value).toBe("number");
    expect(priceCell.value).toBe(6_500_000);
  });

  it("renders empty sheets with a friendly placeholder", () => {
    const wb = composeWorkbook([], [], []);
    expect(wb.worksheets).toHaveLength(3);
    expect(wb.getWorksheet("Buyers")!.getRow(2).getCell(1).value).toContain("No buyer");
  });
});
