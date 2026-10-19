import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockTranslationProvider, OpenAITranslationProvider } from "./translation.js";

describe("MockTranslationProvider", () => {
  it("translates segments with target language prefix", async () => {
    const provider = new MockTranslationProvider();
    const result = await provider.translate({
      targetLanguage: "zh-TW",
      segments: [{ id: "p1", text: "Hello" }]
    });
    expect(result).toEqual([{ id: "p1", text: "[zh-TW] Hello" }]);
  });

  it("classifies artist and tags by keyword heuristics", async () => {
    const provider = new MockTranslationProvider();
    const miletFc = await provider.classify({
      title: "milet official blog update",
      snippet: "Welcome to miles fan club interview"
    });
    expect(miletFc.category).toBe("milet");
    expect(miletFc.tags).toContain("Fan Club");
    expect(miletFc.tags).toContain("訪談");

    const aimerLive = await provider.classify({
      title: "Aimer live tour report",
      snippet: "Budokan concert"
    });
    expect(aimerLive.category).toBe("Aimer");
    expect(aimerLive.tags).toContain("LIVE");
  });
});

describe("OpenAITranslationProvider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const request = {
    sourceLanguage: "en",
    targetLanguage: "zh-TW",
    documentContext: { title: "Title" },
    segments: [
      { id: "title", text: "Title" },
      { id: "p1", text: "Paragraph" }
    ]
  };

  it("sends request to custom baseUrl and parses standard chat/completions JSON", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  segments: [
                    { id: "title", text: "標題" },
                    { id: "p1", text: "段落" }
                  ]
                })
              }
            }
          ]
        })
      } as Response;
    });

    const provider = new OpenAITranslationProvider(
      "test-key",
      "gpt-4o-mini",
      "https://custom-gateway.local/v1"
    );

    const result = await provider.translate(request);

    expect(capturedUrl).toBe("https://custom-gateway.local/v1/chat/completions");
    expect(capturedHeaders.authorization).toBe("Bearer test-key");
    expect(capturedBody.model).toBe("gpt-4o-mini");
    expect(capturedBody.response_format).toEqual({ type: "json_object" });
    expect(result).toEqual([
      { id: "title", text: "標題" },
      { id: "p1", text: "段落" }
    ]);
  });

  it("cleans markdown code fences returned by local models like Ollama", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: "```json\n{\n  \"segments\": [\n    {\"id\": \"title\", \"text\": \"標題\"},\n    {\"id\": \"p1\", \"text\": \"段落\"}\n  ]\n}\n```"
            }
          }
        ]
      })
    } as Response);

    const provider = new OpenAITranslationProvider(
      "",
      "qwen2.5:14b",
      "http://127.0.0.1:11434/v1"
    );

    const result = await provider.translate(request);
    expect(result).toEqual([
      { id: "title", text: "標題" },
      { id: "p1", text: "段落" }
    ]);
  });

  it("handles empty API key for local providers without error header", async () => {
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  segments: [
                    { id: "title", text: "標題" },
                    { id: "p1", text: "段落" }
                  ]
                })
              }
            }
          ]
        })
      } as Response;
    });

    const provider = new OpenAITranslationProvider("", "local-model", "http://127.0.0.1:11434/v1");
    await provider.translate(request);
    expect(capturedHeaders.authorization).toBeUndefined();
  });

  it("throws error with status when provider returns non-200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "Invalid API key" } })
    } as Response);

    const provider = new OpenAITranslationProvider("bad-key", "gpt-4o-mini");
    await expect(provider.translate(request)).rejects.toThrow(/HTTP 401/);
  });
});
