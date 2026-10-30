import { getConfig } from "@/server/config/env.ts";
import type { AiProvider } from "@/server/ai/provider.ts";
import { RulesProvider } from "@/server/ai/rules-provider.ts";
import { AnthropicProvider } from "@/server/ai/anthropic-provider.ts";
import { OpenAICompatibleProvider } from "@/server/ai/openai-provider.ts";
import { logger } from "@/server/lib/logger.ts";

let cached: AiProvider | undefined;
let override: AiProvider | undefined;

/** Tests can inject a deterministic provider. */
export function setAiProviderOverride(provider: AiProvider | undefined): void {
  override = provider;
  cached = undefined;
}

export function getAiProvider(): AiProvider {
  if (override) return override;
  if (cached) return cached;
  const cfg = getConfig();
  if (cfg.ai.kind === "anthropic" && cfg.ai.apiKey) {
    cached = new AnthropicProvider({
      apiKey: cfg.ai.apiKey,
      model: cfg.ai.model,
      visionEnabled: cfg.ai.visionEnabled,
    });
    logger.info("AI provider ready", { provider: "anthropic", model: cfg.ai.model });
  } else if (cfg.ai.kind === "openai_compatible" && cfg.ai.baseUrl) {
    cached = new OpenAICompatibleProvider({
      name: cfg.ai.provider,
      baseUrl: cfg.ai.baseUrl,
      apiKey: cfg.ai.apiKey ?? "",
      model: cfg.ai.model,
    });
    logger.info("AI provider ready", { provider: cfg.ai.provider, model: cfg.ai.model });
  } else {
    cached = new RulesProvider();
    logger.info("AI provider ready", { provider: "rules" });
  }
  return cached;
}

export type { AiProvider };
