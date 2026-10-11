import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig translation provider auto inference", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("defaults to mock mode when no model is specified", () => {
    delete process.env.TRANSLATION_PROVIDER;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_API_KEY;

    const config = loadConfig();
    expect(config.TRANSLATION_PROVIDER).toBe("mock");
    expect(config.IS_MOCK_TRANSLATION).toBe(true);
  });

  it("forces mock mode when TRANSLATION_PROVIDER=mock", () => {
    process.env.TRANSLATION_PROVIDER = "mock";
    process.env.OPENAI_MODEL = "gpt-4o-mini";

    const config = loadConfig();
    expect(config.TRANSLATION_PROVIDER).toBe("mock");
    expect(config.IS_MOCK_TRANSLATION).toBe(true);
  });

  it("automatically enables and infers ollama when local port 11434 is used", () => {
    delete process.env.TRANSLATION_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_BASE_URL = "http://127.0.0.1:11434/v1";
    process.env.OPENAI_MODEL = "qwen2.5:14b";

    const config = loadConfig();
    expect(config.TRANSLATION_PROVIDER).toBe("ollama");
    expect(config.IS_MOCK_TRANSLATION).toBe(false);
  });

  it("automatically enables and infers gemini when googleapis.com endpoint is used", () => {
    delete process.env.TRANSLATION_PROVIDER;
    process.env.OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
    process.env.OPENAI_API_KEY = "test-google-key";
    process.env.OPENAI_MODEL = "gemini-1.5-flash";

    const config = loadConfig();
    expect(config.TRANSLATION_PROVIDER).toBe("gemini");
    expect(config.IS_MOCK_TRANSLATION).toBe(false);
  });

  it("automatically enables and infers openai when default endpoint and key are provided", () => {
    delete process.env.TRANSLATION_PROVIDER;
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_MODEL = "gpt-4o-mini";

    const config = loadConfig();
    expect(config.TRANSLATION_PROVIDER).toBe("openai");
    expect(config.IS_MOCK_TRANSLATION).toBe(false);
  });
});
