import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ClassificationSchema,
  ExtractionResultSchema,
  ImageDescriptionSchema,
  type Classification,
  type ExtractionResult,
  type ImageDescription,
} from "@/server/ai/schemas.ts";
import {
  SYSTEM_PROMPT,
  IMAGE_SYSTEM_PROMPT,
  classificationUserPrompt,
  extractionUserPrompt,
} from "@/server/ai/prompts.ts";
import type {
  AiProvider,
  ClassifyInput,
  DescribeImageInput,
  ExtractInput,
} from "@/server/ai/provider.ts";
import { AiProviderError } from "@/server/lib/errors.ts";
import { logger } from "@/server/lib/logger.ts";

/**
 * Claude-backed extractor. Uses structured outputs (output_config.format) so
 * responses are schema-constrained, then validates again with Zod. Model output
 * is never trusted directly.
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

  async classify(input: ClassifyInput): Promise<Classification> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        output_config: { format: zodOutputFormat(ClassificationSchema) },
        messages: [{ role: "user", content: classificationUserPrompt(input.text) }],
      });
      if (response.stop_reason === "refusal") {
        throw new AiProviderError("The AI declined to process this message.");
      }
      const parsed = response.parsed_output;
      if (!parsed) throw new AiProviderError("AI returned no parseable classification.");
      return parsed;
    } catch (err) {
      throw wrap(err, "classification");
    }
  }

  async extract(input: ExtractInput): Promise<ExtractionResult> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: { format: zodOutputFormat(ExtractionResultSchema) },
        messages: [{ role: "user", content: extractionUserPrompt(input.text, input.hint) }],
      });
      if (response.stop_reason === "refusal") {
        throw new AiProviderError("The AI declined to process this message.");
      }
      const parsed = response.parsed_output;
      if (!parsed) throw new AiProviderError("AI returned no parseable extraction.");
      return parsed;
    } catch (err) {
      throw wrap(err, "extraction");
    }
  }

  async describeImage(input: DescribeImageInput): Promise<ImageDescription> {
    if (!this.visionEnabled) {
      return { description: "", visible_features: [] };
    }
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 1024,
        system: IMAGE_SYSTEM_PROMPT,
        output_config: { format: zodOutputFormat(ImageDescriptionSchema) },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.mimeType as "image/jpeg" | "image/png",
                  data: input.base64,
                },
              },
              { type: "text", text: "Describe this property photo for an agent." },
            ],
          },
        ],
      });
      return response.parsed_output ?? { description: "", visible_features: [] };
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
