import { z } from "zod";

const configSchema = z.object({
  DATABASE_FILE: z.string().default("./data/app.sqlite"),
  DATA_DIR: z.string().default("./data"),
  API_PORT: z.coerce.number().int().positive().default(4100),
  WEB_ORIGIN: z.string().default("http://127.0.0.1:5173"),
  TRANSLATION_PROVIDER: z.enum(["mock", "openai"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  MAX_SOURCE_BYTES: z.coerce.number().int().positive().default(5_000_000),
  MAX_TRANSLATION_CHARACTERS: z.coerce.number().int().min(1_000).default(120_000),
  BROWSER_FALLBACK_ENABLED: z.enum(["true", "false"]).default("true")
    .transform((value) => value === "true"),
  BROWSER_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
  BROWSER_EXECUTABLE_PATH: z.string().optional()
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.message}`);
  }
  if (result.data.TRANSLATION_PROVIDER === "openai") {
    if (!result.data.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required when TRANSLATION_PROVIDER=openai");
    }
    if (!result.data.OPENAI_MODEL) {
      throw new Error("OPENAI_MODEL is required when TRANSLATION_PROVIDER=openai");
    }
  }
  return result.data;
}
