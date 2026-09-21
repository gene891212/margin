import { describe, expect, it } from "vitest";
import type { TranslationProvider } from "@wct/core";
import { WholeDocumentTranslationStrategy } from "./translation-strategy.js";

function providerWith(
  result: Array<{ id: string; text: string }>
): TranslationProvider {
  return {
    name: "test",
    kind: "mock",
    async translate() {
      return result;
    }
  };
}

const request = {
  sourceLanguage: "en",
  targetLanguage: "zh-TW",
  documentContext: { title: "Article" },
  segments: [
    { id: "title", text: "Article" },
    { id: "p1", text: "First paragraph" }
  ]
};

describe("WholeDocumentTranslationStrategy", () => {
  it("sends and returns the complete document in one provider call", async () => {
    let calls = 0;
    const provider: TranslationProvider = {
      name: "test",
      kind: "llm",
      async translate(input) {
        calls += 1;
        return input.segments.map((segment) => ({ id: segment.id, text: `譯：${segment.text}` }));
      }
    };
    const strategy = new WholeDocumentTranslationStrategy(1_000);
    const result = await strategy.execute({ ...request, provider });
    expect(calls).toBe(1);
    expect(result).toHaveLength(2);
  });

  it("rejects missing segment IDs", async () => {
    const strategy = new WholeDocumentTranslationStrategy(1_000);
    await expect(strategy.execute({
      ...request,
      provider: providerWith([{ id: "title", text: "文章" }])
    })).rejects.toThrow(/omitted/);
  });

  it("fails explicitly when the whole document is too large", async () => {
    const strategy = new WholeDocumentTranslationStrategy(5);
    await expect(strategy.execute({
      ...request,
      provider: providerWith([])
    })).rejects.toThrow(/adaptive chunking/);
  });
});
