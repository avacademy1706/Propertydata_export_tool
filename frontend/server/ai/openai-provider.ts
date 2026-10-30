import {
  ClassificationSchema,
  ExtractionResultSchema,
  type Classification,
  type ExtractionResult,
} from "@/server/ai/schemas.ts";
import {
  SYSTEM_PROMPT,
  CLASSIFICATION_JSON_SHAPE,
  EXTRACTION_JSON_SHAPE,
  classificationUserPrompt,
  extractionUserPrompt,
} from "@/server/ai/prompts.ts";
import type { AiProvider, ClassifyInput, ExtractInput } from "@/server/ai/provider.ts";
import { AiProviderError } from "@/server/lib/errors.ts";

/**
 * Provider for any OpenAI-compatible /chat/completions endpoint:
 * Google Gemini (free tier), Groq (free), OpenRouter, OpenAI, or a local Ollama.
 * Uses JSON response mode and validates every response with Zod — model output
 * is never trusted directly.
 */
export class OpenAICompatibleProvider implements AiProvider {
  readonly name: string;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(opts: { name: string; baseUrl: string; apiKey: string; model: string }) {
    this.name = opts.name;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.model = opts.model;
  }

  private async chat(system: string, user: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }),
      });
    } catch (err) {
      throw new AiProviderError(`Could not reach the AI provider (${this.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiProviderError(`AI provider ${this.name} returned ${res.status}. ${truncate(body)}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new AiProviderError(`AI provider ${this.name} returned an empty response.`);
    return content;
  }

  async classify(input: ClassifyInput): Promise<Classification> {
    const raw = await this.chat(SYSTEM_PROMPT, `${classificationUserPrompt(input.text)}\n\n${CLASSIFICATION_JSON_SHAPE}`);
    return ClassificationSchema.parse(extractJson(raw));
  }

  async extract(input: ExtractInput): Promise<ExtractionResult> {
    const raw = await this.chat(SYSTEM_PROMPT, `${extractionUserPrompt(input.text, input.hint)}\n\n${EXTRACTION_JSON_SHAPE}`);
    return ExtractionResultSchema.parse(extractJson(raw));
  }
}

/** Tolerant JSON extraction: strips markdown fences and finds the JSON object. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new AiProviderError("AI provider returned invalid JSON.");
  }
}

function truncate(s: string): string {
  return s.length > 300 ? s.slice(0, 300) + "…" : s;
}
