import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { extractInline, parseTranslatedInline, serializeInline, textOfInline } from "./inline.js";

describe("inline structure", () => {
  it("round-trips translated links and emphasis without changing URLs", () => {
    const document = new JSDOM('<p>Read the <a href="/report"><strong>full report</strong></a> now.</p>').window.document;
    const source = extractInline(document.querySelector("p")!, "https://example.com/article");
    const serialized = serializeInline(source);
    expect(serialized).toContain('kind="link"');
    const translated = parseTranslatedInline(source, '現在閱讀<x id="m1" kind="link"><x id="m2" kind="strong">完整報告</x></x>。');
    expect(textOfInline(translated)).toBe("現在閱讀完整報告。");
    const link = translated.find((node) => node.type === "link");
    expect(link?.type === "link" ? link.href : undefined).toBe("https://example.com/report");
  });

  it("rejects a translation that drops a link marker", () => {
    const document = new JSDOM('<p>Visit <a href="https://example.com">this link</a>.</p>').window.document;
    const source = extractInline(document.querySelector("p")!, "https://example.com/");
    expect(() => parseTranslatedInline(source, "造訪這個連結。")).toThrow(/omitted inline markers/);
  });
});
