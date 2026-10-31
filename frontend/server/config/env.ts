import { z } from "zod";

/**
 * Central, validated view of process.env.
 * Optional integrations (AI, WhatsApp, S3, auth) are reported as "configured"
 * flags so the UI can show clear status instead of failing at runtime.
 */

const boolString = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim().toLowerCase() === "true");

const optionalString = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = (v ?? "").trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/real_estate_tool"),
  TEST_DATABASE_URL: optionalString,

  AI_PROVIDER: optionalString,
  AI_API_KEY: optionalString,
  AI_MODEL: optionalString,
  AI_BASE_URL: optionalString,
  AI_VISION_ENABLED: boolString,

  WHATSAPP_WABA_ID: optionalString,
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_BUSINESS_NUMBER: optionalString,
  WHATSAPP_ACCESS_TOKEN: optionalString,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalString,
  WHATSAPP_APP_SECRET: optionalString,
  WHATSAPP_GRAPH_API_VERSION: z.string().default("v26.0"),
  WHATSAPP_SEND_ACKNOWLEDGEMENTS: boolString,
  WHATSAPP_UNKNOWN_SENDER_POLICY: z
    .enum(["reject", "hold", "default_tenant"])
    .default("hold"),

  MEDIA_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  MEDIA_STORAGE_DIR: z.string().default("./storage/media"),
  MEDIA_MAX_FILE_MB: z.coerce.number().positive().default(50),
  S3_BUCKET: optionalString,
  S3_REGION: optionalString,
  S3_ENDPOINT: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: boolString,

  AUTH_SECRET: optionalString,
  APP_ACCESS_PASSWORD: optionalString,
  APP_ADMIN_EMAIL: optionalString,
  GRIDCRAFT_WEB_URL: optionalString,
  LOG_MESSAGE_CONTENT: boolString,
});

export type RawEnv = z.infer<typeof EnvSchema>;

export type AiProviderName = "anthropic" | "gemini" | "groq" | "openrouter" | "openai" | "ollama" | "rules";
export type AiProviderKind = "anthropic" | "openai_compatible" | "rules";

/**
 * Presets for hosted providers. The OpenAI-compatible ones all speak the same
 * /chat/completions API, so one client serves Gemini (free tier), Groq (free),
 * OpenRouter, OpenAI and a local Ollama.
 */
export const AI_PRESETS: Record<
  Exclude<AiProviderName, "rules">,
  { kind: AiProviderKind; baseUrl?: string; defaultModel: string; needsKey: boolean; label: string }
> = {
  anthropic: { kind: "anthropic", defaultModel: "claude-opus-5-5", needsKey: true, label: "Anthropic Claude" },
  gemini: {
    kind: "openai_compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    needsKey: true,
    label: "Google Gemini (free tier)",
  },
  groq: {
    kind: "openai_compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    needsKey: true,
    label: "Groq (free tier)",
  },
  openrouter: {
    kind: "openai_compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.0-flash-exp:free",
    needsKey: true,
    label: "OpenRouter",
  },
  openai: {
    kind: "openai_compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    needsKey: true,
    label: "OpenAI",
  },
  ollama: {
    kind: "openai_compatible",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    needsKey: false,
    label: "Ollama (local, free)",
  },
};

export interface AppConfig {
  env: RawEnv;
  isProduction: boolean;
  ai: {
    provider: AiProviderName;
    kind: AiProviderKind;
    apiKey?: string;
    baseUrl?: string;
    model: string;
    visionEnabled: boolean;
    configured: boolean; // true when a real model provider is usable
  };
  whatsapp: {
    configured: boolean;
    missing: string[];
    phoneNumberId?: string;
    wabaId?: string;
    businessNumber?: string;
    accessToken?: string;
    verifyToken?: string;
    appSecret?: string;
    graphApiVersion: string;
    sendAcknowledgements: boolean;
    unknownSenderPolicy: "reject" | "hold" | "default_tenant";
  };
  media: {
    driver: "local" | "s3";
    localDir: string;
    maxFileBytes: number;
    s3: {
      bucket?: string;
      region?: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      forcePathStyle: boolean;
    };
  };
  auth: {
    enabled: boolean;
    secret?: string;
    password?: string;
    adminEmail: string;
  };
  gridcraftWebUrl?: string;
  logMessageContent: boolean;
  warnings: string[];
}

let cached: AppConfig | undefined;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  const warnings: string[] = [];

  // ---- AI --------------------------------------------------------------
  const requested = (env.AI_PROVIDER ?? "").toLowerCase();
  let provider: AiProviderName;
  if (requested in AI_PRESETS || requested === "rules") {
    provider = (requested || "rules") as AiProviderName;
  } else if (requested) {
    warnings.push(`Unknown AI_PROVIDER "${env.AI_PROVIDER}"; using the offline rules extractor.`);
    provider = "rules";
  } else {
    // No provider named: use Anthropic if a key is present, else offline rules.
    provider = env.AI_API_KEY ? "anthropic" : "rules";
  }

  let aiKind: AiProviderKind = "rules";
  let aiBaseUrl: string | undefined;
  let aiModel = env.AI_MODEL ?? "";
  if (provider !== "rules") {
    const preset = AI_PRESETS[provider];
    aiKind = preset.kind;
    aiBaseUrl = env.AI_BASE_URL ?? preset.baseUrl;
    aiModel = env.AI_MODEL ?? preset.defaultModel;
    if (preset.needsKey && !env.AI_API_KEY) {
      warnings.push(
        `AI_PROVIDER=${provider} (${preset.label}) needs AI_API_KEY; falling back to the offline rules extractor. Get a free key and set AI_API_KEY to enable it.`,
      );
      provider = "rules";
      aiKind = "rules";
      aiBaseUrl = undefined;
    }
  }
  if (provider === "rules") {
    warnings.push(
      "AI provider not configured: messages use the offline rules extractor (lower accuracy, weak on Hindi). Set AI_PROVIDER + AI_API_KEY (e.g. a free Google Gemini key) to improve extraction.",
    );
  }

  // ---- WhatsApp --------------------------------------------------------
  const whatsappRequired: Array<[string, string | undefined]> = [
    ["WHATSAPP_PHONE_NUMBER_ID", env.WHATSAPP_PHONE_NUMBER_ID],
    ["WHATSAPP_ACCESS_TOKEN", env.WHATSAPP_ACCESS_TOKEN],
    ["WHATSAPP_WEBHOOK_VERIFY_TOKEN", env.WHATSAPP_WEBHOOK_VERIFY_TOKEN],
    ["WHATSAPP_APP_SECRET", env.WHATSAPP_APP_SECRET],
  ];
  const missing = whatsappRequired.filter(([, v]) => !v).map(([k]) => k);
  const whatsappConfigured = missing.length === 0;
  if (!whatsappConfigured) {
    warnings.push(
      `WhatsApp Cloud API not configured (missing ${missing.join(", ")}). Manual paste works; webhook automation is disabled.`,
    );
  }

  // ---- Auth ------------------------------------------------------------
  const authEnabled = Boolean(env.APP_ACCESS_PASSWORD);
  if (authEnabled && !env.AUTH_SECRET) {
    throw new Error("APP_ACCESS_PASSWORD is set but AUTH_SECRET is empty. Set AUTH_SECRET to sign sessions.");
  }
  if (!authEnabled) {
    warnings.push(
      "Authentication is disabled (APP_ACCESS_PASSWORD empty). Only use this on a trusted local machine.",
    );
  }

  if (env.MEDIA_STORAGE_DRIVER === "s3" && (!env.S3_BUCKET || !env.S3_REGION)) {
    throw new Error("MEDIA_STORAGE_DRIVER=s3 requires S3_BUCKET and S3_REGION.");
  }

  cached = {
    env,
    isProduction: env.NODE_ENV === "production",
    ai: {
      provider,
      kind: aiKind,
      apiKey: env.AI_API_KEY,
      baseUrl: aiBaseUrl,
      model: aiModel || "claude-opus-5-5",
      visionEnabled: env.AI_VISION_ENABLED && provider === "anthropic",
      configured: aiKind !== "rules",
    },
    whatsapp: {
      configured: whatsappConfigured,
      missing,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      wabaId: env.WHATSAPP_WABA_ID,
      businessNumber: env.WHATSAPP_BUSINESS_NUMBER,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      verifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      appSecret: env.WHATSAPP_APP_SECRET,
      graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION,
      sendAcknowledgements: env.WHATSAPP_SEND_ACKNOWLEDGEMENTS,
      unknownSenderPolicy: env.WHATSAPP_UNKNOWN_SENDER_POLICY,
    },
    media: {
      driver: env.MEDIA_STORAGE_DRIVER,
      localDir: env.MEDIA_STORAGE_DIR,
      maxFileBytes: Math.round(env.MEDIA_MAX_FILE_MB * 1024 * 1024),
      s3: {
        bucket: env.S3_BUCKET,
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
      },
    },
    auth: {
      enabled: authEnabled,
      secret: env.AUTH_SECRET,
      password: env.APP_ACCESS_PASSWORD,
      adminEmail: (env.APP_ADMIN_EMAIL ?? "admin@propertydesk.local").toLowerCase(),
    },
    gridcraftWebUrl: env.GRIDCRAFT_WEB_URL,
    logMessageContent: env.LOG_MESSAGE_CONTENT,
    warnings,
  };
  return cached;
}

export function getConfig(): AppConfig {
  return cached ?? loadConfig();
}

/** Test helper: forget the cached configuration. */
export function resetConfigCache(): void {
  cached = undefined;
}
