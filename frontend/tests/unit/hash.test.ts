import { describe, it, expect } from "vitest";
import { contentHash } from "@/server/lib/hash.ts";

describe("contentHash", () => {
  it("is stable across whitespace and case", () => {
    expect(contentHash("3 BHK flat   in Gomti Nagar")).toBe(contentHash("3 bhk flat in gomti nagar"));
  });
  it("differs for different content", () => {
    expect(contentHash("3 BHK flat")).not.toBe(contentHash("2 BHK flat"));
  });
});
