import { describe, it, expect, beforeEach } from "vitest";
import { dbEnabled } from "./setup.ts";
import { MockAiProvider } from "./mock-ai.ts";
import type { ExtractionResult } from "@/server/ai/schemas.ts";

const MSG_SELLER = "3 BHK flat for sale in Gomti Nagar, 1300 sqft, covered car parking, 65 lakh. East facing.";
const MSG_BUYER = "Need 3 BHK flat in Gomti Nagar, budget 70 lakh, covered parking and lift required.";

const responses: Record<string, ExtractionResult> = {
  [MSG_SELLER]: {
    classification: "seller",
    confidence: 0.96,
    records: [
      {
        record_type: "seller",
        transaction_type: "sale",
        property_category: "residential",
        property_type: "apartment",
        contact_name: null,
        phone: null,
        email: null,
        location: "Gomti Nagar",
        district: null,
        city: "Lucknow",
        full_address: null,
        landmark: null,
        bhk: 3,
        bathrooms: null,
        area: { original_value: 1300, original_unit: "sq_ft", area_type: "built_up" },
        plot_area: null,
        front_width: null,
        road_width: null,
        rate: { amount: 6_500_000, currency: "INR", basis: "total" },
        budgets: [],
        furnishing_status: null,
        facing: "east",
        floor: null,
        building_configuration: null,
        property_setting: null,
        features: ["Covered Parking"],
        availability: null,
        intended_use: null,
        deal_source: null,
        google_maps_url: null,
        timeline: null,
        claims: [],
        notes: null,
        source_segment: null,
        uncertain_fields: [],
        confidence: 0.95,
      },
    ],
    shared_fields: {},
    needs_review: false,
    review_reasons: [],
  },
  [MSG_BUYER]: {
    classification: "buyer",
    confidence: 0.95,
    records: [
      {
        record_type: "buyer",
        transaction_type: "buy",
        property_category: "residential",
        property_type: "apartment",
        contact_name: null,
        phone: null,
        email: null,
        location: "Gomti Nagar",
        district: null,
        city: "Lucknow",
        full_address: null,
        landmark: null,
        bhk: 3,
        bathrooms: null,
        area: null,
        plot_area: null,
        front_width: null,
        road_width: null,
        rate: { amount: 7_000_000, currency: "INR", basis: "total" },
        budgets: [],
        furnishing_status: null,
        facing: null,
        floor: null,
        building_configuration: null,
        property_setting: null,
        features: ["Covered Parking", "Lift"],
        availability: null,
        intended_use: null,
        deal_source: null,
        google_maps_url: null,
        timeline: null,
        claims: [],
        notes: null,
        source_segment: null,
        uncertain_fields: [],
        confidence: 0.94,
      },
    ],
    shared_fields: {},
    needs_review: false,
    review_reasons: [],
  },
};

describe.skipIf(!dbEnabled)("ingest pipeline (requires DB)", () => {
  let tenantId: string;

  beforeEach(async () => {
    const { setAiProviderOverride } = await import("@/server/ai/index.ts");
    const { prisma } = await import("@/server/db/client.ts");
    const { getDefaultTenantId } = await import("@/server/db/tenant.ts");
    setAiProviderOverride(new MockAiProvider(responses));
    tenantId = await getDefaultTenantId();
    await prisma.match.deleteMany({ where: { tenantId } });
    await prisma.buyer.deleteMany({ where: { tenantId } });
    await prisma.seller.deleteMany({ where: { tenantId } });
    await prisma.sourceMessage.deleteMany({ where: { tenantId } });
  });

  it("creates a seller record from a listing message", async () => {
    const { processMessage } = await import("@/server/services/ingest.ts");
    const result = await processMessage({ tenantId, text: MSG_SELLER, hint: "auto", channel: "MANUAL" });
    expect(result.detectedType).toBe("seller");
    expect(result.createdRecords).toHaveLength(1);
    expect(result.createdRecords[0].type).toBe("seller");
  });

  it("routes a buyer message to Buyers even when the seller tab hint is used", async () => {
    const { processMessage } = await import("@/server/services/ingest.ts");
    const result = await processMessage({ tenantId, text: MSG_BUYER, hint: "seller", channel: "MANUAL" });
    expect(result.detectedType).toBe("buyer");
    expect(result.createdRecords[0].type).toBe("buyer");
  });

  it("does not create a duplicate for the same pasted message", async () => {
    const { processMessage } = await import("@/server/services/ingest.ts");
    await processMessage({ tenantId, text: MSG_SELLER, hint: "auto", channel: "MANUAL" });
    const second = await processMessage({ tenantId, text: MSG_SELLER, hint: "auto", channel: "MANUAL" });
    expect(second.duplicate).toBe(true);
  });

  it("generates a strong match between the buyer and seller", async () => {
    const { processMessage } = await import("@/server/services/ingest.ts");
    const { prisma } = await import("@/server/db/client.ts");
    await processMessage({ tenantId, text: MSG_SELLER, hint: "auto", channel: "MANUAL" });
    await processMessage({ tenantId, text: MSG_BUYER, hint: "auto", channel: "MANUAL" });
    const matches = await prisma.match.findMany({ where: { tenantId } });
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(Number(matches[0].matchScore)).toBeGreaterThanOrEqual(75);
  });

  it("ignores a duplicate WhatsApp webhook delivery (same external id)", async () => {
    const { processMessage } = await import("@/server/services/ingest.ts");
    const first = await processMessage({ tenantId, text: MSG_SELLER, hint: "auto", channel: "WHATSAPP", externalMessageId: "wamid.ABC" });
    const second = await processMessage({ tenantId, text: MSG_SELLER, hint: "auto", channel: "WHATSAPP", externalMessageId: "wamid.ABC" });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });
});

describe.skipIf(!dbEnabled)("export (requires DB)", () => {
  it("produces a workbook with the three primary sheets", async () => {
    const { setAiProviderOverride } = await import("@/server/ai/index.ts");
    const { getDefaultTenantId } = await import("@/server/db/tenant.ts");
    const { processMessage } = await import("@/server/services/ingest.ts");
    const { buildWorkbook } = await import("@/server/export/workbook.ts");
    setAiProviderOverride(new MockAiProvider(responses));
    const tenantId = await getDefaultTenantId();
    await processMessage({ tenantId, text: MSG_SELLER, hint: "auto", channel: "MANUAL" });
    const { buffer, counts } = await buildWorkbook(tenantId);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(counts.sellers).toBeGreaterThanOrEqual(1);
  });
});
