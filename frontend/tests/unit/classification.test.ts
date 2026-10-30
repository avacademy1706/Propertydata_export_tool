import { describe, it, expect } from "vitest";
import { RulesProvider } from "@/server/ai/rules-provider.ts";

const ai = new RulesProvider();

describe("rules classification + extraction", () => {
  it("classifies a 'for sale' listing as seller (Message A)", async () => {
    const text =
      "3 BHK flat for sale in Gomti Nagar, 1300 sqft, 2 balcony, 2 bathroom, covered car parking, 65 lakh. East facing.";
    const c = await ai.classify({ text });
    expect(c.classification).toBe("seller");
    const e = await ai.extract({ text, hint: "auto" });
    const r = e.records[0];
    expect(r.record_type).toBe("seller");
    expect(r.property_type).toBe("apartment");
    expect(r.bhk).toBe(3);
    expect(r.area?.original_value).toBe(1300);
    expect(r.rate?.amount).toBe(6_500_000);
    expect(r.rate?.basis).toBe("total");
    expect(r.facing).toBe("east");
  });

  it("classifies a 'need' message as buyer (Message B)", async () => {
    const text = "Need 3 BHK flat in Gomti Nagar, budget 70 lakh, covered parking and lift required.";
    const c = await ai.classify({ text });
    expect(c.classification).toBe("buyer");
    const e = await ai.extract({ text, hint: "auto" });
    const r = e.records[0];
    expect(r.record_type).toBe("buyer");
    expect(r.bhk).toBe(3);
    expect(r.rate?.amount).toBe(7_000_000);
  });

  it("classifies a shop-for-rent as seller (Message C)", async () => {
    const text = "Shop for rent 400 sqft, near Spencer Indira Nagar. Rent 35k. Good location.";
    const e = await ai.extract({ text, hint: "auto" });
    const r = e.records[0];
    expect(r.record_type).toBe("seller");
    expect(r.property_type).toBe("shop");
    expect(r.rate?.amount).toBe(35_000);
    expect(r.rate?.basis).toBe("monthly");
  });

  it("classifies a requirement plot as buyer with a per-sqft rate (Message D)", async () => {
    const text = "Required 10000 sq ft plot at Bijnor Road for petrol pump. 100x100. Budget 16k/sqft.";
    const c = await ai.classify({ text });
    expect(c.classification).toBe("buyer");
    const e = await ai.extract({ text, hint: "auto" });
    const r = e.records[0];
    expect(r.property_type).toBe("plot");
    expect(r.area?.original_value).toBe(10_000);
    expect(r.rate?.amount).toBe(16_000);
    expect(r.rate?.basis).toBe("per_sq_ft");
  });

  it("respects a manual hint without misclassifying contradictory content", async () => {
    const text = "3 BHK flat for sale in Gomti Nagar, 65 lakh.";
    // Even if the user picked 'buyer', the content is a listing.
    const e = await ai.extract({ text, hint: "buyer" });
    expect(e.classification).toBe("seller");
  });

  it("marks an empty / non-property message as unknown", async () => {
    const c = await ai.classify({ text: "hello how are you" });
    expect(c.classification).toBe("unknown");
  });
});
