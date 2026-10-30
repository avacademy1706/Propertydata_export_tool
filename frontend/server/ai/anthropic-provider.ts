import Anthropic from "@anthropic-ai/sdk";
import {
  ClassificationSchema,
  type Classification,
  type ExtractionResult,
  type ImageDescription,
} from "@/server/ai/schemas.ts";
import {
  SYSTEM_PROMPT,
  IMAGE_SYSTEM_PROMPT,
  CLASSIFICATION_JSON_SHAPE,
  EXTRACTION_JSON_SHAPE,
  classificationUserPrompt,
  extractionUserPrompt,
} from "@/server/ai/prompts.ts";
import { extractJson } from "@/server/ai/json.ts";
import { parseExtraction } from "@/server/ai/parse.ts";
import type {
  AiProvider,
  ClassifyInput,
  DescribeImageInput,
  ExtractInput,
} from "@/server/ai/provider.ts";
import { AiProviderError } from "@/server/lib/errors.ts";
import { logger } from "@/server/lib/logger.ts";

/**
 * Claude-backed extractor. Requests JSON by prompt and validates every response
 * with Zod. We intentionally use the plain Messages API (not the strict
 * structured-output format), because our extraction schema is rich enough that
 * the strict JSON-schema conversion is rejected by some models with a 400.
 * Model output is never trusted directly.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;
  private visionEnabled: boolean;

  constructor(opts: { apiKey: string; model: string; visionEnabled: boolean }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.visionEnabled = opts.visionEnabled;
  }

  private async message(system: string, content: Anthropic.MessageParam["content"], maxTokens: number): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") {
      throw new AiProviderError("The AI declined to process this message.");
    }
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text" || !block.text) {
      throw new AiProviderError("AI returned an empty response.");
    }
    return block.text;
  }

  async classify(input: ClassifyInput): Promise<Classification> {
    try {
      const text = await this.message(
        SYSTEM_PROMPT,
        `${classificationUserPrompt(input.text)}\n\n${CLASSIFICATION_JSON_SHAPE}`,
        1024,
      );
      return ClassificationSchema.parse(extractJson(text));
    } catch (err) {
      throw wrap(err, "classification");
    }
  }

  async extract(input: ExtractInput): Promise<ExtractionResult> {
    try {
      const text = await this.message(
        SYSTEM_PROMPT,
        `${extractionUserPrompt(input.text, input.hint)}\n\n${EXTRACTION_JSON_SHAPE}`,
        8000,
      );
      return parseExtraction(extractJson(text));
    } catch (err) {
      throw wrap(err, "extraction");
    }
  }

  async describeImage(input: DescribeImageInput): Promise<ImageDescription> {
    if (!this.visionEnabled) {
      return { description: "", visible_features: [] };
    }
    try {
      const text = await this.message(
        IMAGE_SYSTEM_PROMPT,
        [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.mimeType as "image/jpeg" | "image/png",
              data: input.base64,
            },
          },
          {
            type: "text",
            text: 'Describe this property photo for an agent. Respond ONLY with JSON: {"description": string, "visible_features": [string]}',
          },
        ],
        1024,
      );
      const parsed = extractJson(text) as ImageDescription;
      return { description: parsed.description ?? "", visible_features: parsed.visible_features ?? [] };
    } catch (err) {
      logger.warn("image description failed", { message: err instanceof Error ? err.message : String(err) });
      return { description: "", visible_features: [] };
    }
  }
}

function wrap(err: unknown, stage: string): AiProviderError {
  if (err instanceof AiProviderError) return err;
  if (err instanceof Anthropic.APIError) {
    return new AiProviderError(`AI ${stage} request failed (${err.status ?? "error"}).`, {
      status: err.status,
    });
  }
  return new AiProviderError(`AI ${stage} failed: ${err instanceof Error ? err.message : String(err)}`);
}
