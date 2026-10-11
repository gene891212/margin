import { z } from "zod";

const configSchema = z.object({
  DATABASE_FILE: z.string().default("./data/app.sqlite"),
  DATA_DIR: z.string().default("./data"),
  API_PORT: z.coerce.number().int().positive().default(4100),
  WEB_ORIGIN: z.string().default("http://127.0.0.1:5173"),
  TRANSLATION_PROVIDER: z.string().optional(),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  MAX_SOURCE_BYTES: z.coerce.number().int().positive().default(5_000_000),
  MAX_TRANSLATION_CHARACTERS: z.coerce.number().int().min(1_000).default(120_000),
  BROWSER_FALLBACK_ENABLED: z.enum(["true", "false"]).default("true")
    .transform((value) => value === "true"),
  BROWSER_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
  BROWSER_EXECUTABLE_PATH: z.string().optional()
});

export interface AppConfig {
  DATABASE_FILE: string;
  DATA_DIR: string;
  API_PORT: number;
  WEB_ORIGIN: string;
  TRANSLATION_PROVIDER: string;
  IS_MOCK_TRANSLATION: boolean;
  OPENAI_BASE_URL: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  MAX_SOURCE_BYTES: number;
  MAX_TRANSLATION_CHARACTERS: number;
  BROWSER_FALLBACK_ENABLED: boolean;
  BROWSER_TIMEOUT_MS: number;
  BROWSER_EXECUTABLE_PATH?: string;
}

export function loadConfig(): AppConfig {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.message}`);
  }

  const rawProvider = result.data.TRANSLATION_PROVIDER?.trim().toLowerCase();
  const hasModel = Boolean(result.data.OPENAI_MODEL?.trim());

  let resolvedProvider: string;
  let isMock = false;

  if (rawProvider === "mock") {
    resolvedProvider = "mock";
    isMock = true;
  } else if (!hasModel && (!rawProvider || rawProvider === "auto")) {
    // 未設定模型且無指定 provider：自動啟用 mock 示範模式
    resolvedProvider = "mock";
    isMock = true;
  } else {
    // 已指定模型或明確要求非 mock 提供者
    if (!hasModel) {
      throw new Error(`OPENAI_MODEL is required when TRANSLATION_PROVIDER is '${rawProvider}'`);
    }

    const isLocal = ["localhost", "127.0.0.1"].some((host) => result.data.OPENAI_BASE_URL.includes(host));
    if (!result.data.OPENAI_API_KEY && !isLocal) {
      throw new Error("OPENAI_API_KEY is required when using a remote endpoint (unless using local endpoint like Ollama)");
    }

    if (rawProvider && rawProvider !== "auto" && rawProvider !== "openai") {
      resolvedProvider = rawProvider;
    } else if (result.data.OPENAI_BASE_URL.includes("googleapis.com")) {
      resolvedProvider = "gemini";
    } else if (result.data.OPENAI_BASE_URL.includes("11434")) {
      resolvedProvider = "ollama";
    } else {
      resolvedProvider = "openai";
    }
  }

  return {
    ...result.data,
    TRANSLATION_PROVIDER: resolvedProvider,
    IS_MOCK_TRANSLATION: isMock
  };
}
