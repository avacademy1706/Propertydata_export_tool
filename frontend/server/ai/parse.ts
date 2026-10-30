import { ExtractionResultSchema, type ExtractionResult } from "@/server/ai/schemas.ts";

/**
 * Normalize-then-validate the raw extraction JSON. The model occasionally
 * returns a record_type that isn't exactly "buyer"/"seller"; derive it from the
 * top-level classification (or the transaction type) so a buyer is never forced
 * to a seller by a strict enum default.
 */
export function parseExtraction(raw: unknown): ExtractionResult {
  if (raw && typeof raw === "object") {
    const obj = raw as { classification?: unknown; records?: unknown };
    const cls = typeof obj.classification === "string" ? obj.classification.toLowerCase() : "";
    if (Array.isArray(obj.records)) {
      for (const rec of obj.records) {
        if (rec && typeof rec === "object") {
          const r = rec as Record<string, unknown>;
          const rt = String(r.record_type ?? "").toLowerCase();
          if (rt === "buyer" || rt === "seller") {
            r.record_type = rt;
          } else if (cls === "buyer" || cls === "seller") {
            r.record_type = cls;
          } else {
            r.record_type = String(r.transaction_type ?? "").toLowerCase() === "buy" ? "buyer" : "seller";
          }
        }
      }
    }
  }
  return ExtractionResultSchema.parse(raw);
}
