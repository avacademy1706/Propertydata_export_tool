import type { AiProvider, ClassifyInput, ExtractInput } from "@/server/ai/provider.ts";
import { ExtractionResultSchema, type ExtractionResult, type Classification } from "@/server/ai/schemas.ts";

/**
 * Deterministic AI provider for integration tests. Returns canned structured
 * output so tests never depend on a paid API or on heuristic parsing.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  constructor(private responses: Record<string, ExtractionResult>) {}

  async classify(input: ClassifyInput): Promise<Classification> {
    const r = this.responses[input.text];
    return { classification: r?.classification ?? "unknown", confidence: r?.confidence ?? 0.3, reason: "mock", needs_review: r?.needs_review ?? false };
  }

  async extract(input: ExtractInput): Promise<ExtractionResult> {
    const r = this.responses[input.text];
    if (!r) {
      return ExtractionResultSchema.parse({ classification: "unknown", confidence: 0.2, records: [], needs_review: true });
    }
    return ExtractionResultSchema.parse(r);
  }
}
