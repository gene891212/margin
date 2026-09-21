import { describe, expect, it } from "vitest";
import type { DocumentAst } from "@wct/core";
import { applyTranslations, translationUnits } from "./document-translator.js";

const document: DocumentAst = {
  version: 1,
  title: "Article",
  sourceUrl: "https://example.com/article",
  targetLanguage: "zh-TW",
  nodes: [
    { id: "p1", type: "paragraph", inline: [{ type: "text", text: "Hello world" }], translatable: true },
    { id: "l1", type: "list", inline: [], ordered: false, items: [
      { inline: [{ type: "text", text: "First" }] },
      { inline: [{ type: "text", text: "Second" }] }
    ], translatable: true },
    { id: "code1", type: "code", inline: [], code: "const x = 1", translatable: false }
  ]
};

describe("document translation units", () => {
  it("maps title, paragraph and list items without translating code", () => {
    const units = translationUnits(document);
    expect(units.map((item) => item.id)).toEqual(["document-title", "p1", "l1:item:0", "l1:item:1"]);
    const translated = applyTranslations(document, new Map([
      ["document-title", "文章"], ["p1", "你好世界"],
      ["l1:item:0", "第一"], ["l1:item:1", "第二"]
    ]));
    expect(translated.translatedTitle).toBe("文章");
    expect(translated.nodes[1]?.items?.[0]?.translatedInline).toEqual([{ type: "text", text: "第一" }]);
    expect(translated.nodes[2]?.translatedInline).toBeUndefined();
  });
});
