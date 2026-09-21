import { describe, expect, it } from "vitest";
import { extractArticle } from "./readability.js";

describe("extractArticle", () => {
  it("keeps article hierarchy and image URLs", () => {
    const paragraph = "This is a detailed paragraph about a reusable content translation pipeline. ".repeat(8);
    const result = extractArticle({
      url: "https://example.com/stories/translation",
      targetLanguage: "zh-TW",
      html: `<!doctype html>
        <html lang="en">
          <head><title>Translation systems</title></head>
          <body>
            <nav>Home Products About</nav>
            <article>
              <h1>Translation systems</h1>
              <p>${paragraph}</p>
              <h2>Preserve structure</h2>
              <p>${paragraph}</p>
              <img src="/diagram.png" alt="System diagram">
            </article>
          </body>
        </html>`
    });

    expect(result.document.title).toContain("Translation systems");
    expect(result.document.sourceLanguage).toBe("en");
    expect(result.document.nodes.some((node) => node.type === "heading")).toBe(true);
    expect(result.document.nodes.some((node) => node.src === "https://example.com/diagram.png")).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("rejects pages without meaningful content", () => {
    expect(() => extractArticle({
      url: "https://example.com/",
      targetLanguage: "zh-TW",
      html: "<html><body><nav>Home</nav></body></html>"
    })).toThrow(/main article content/);
  });

  it("retains images nested inside paragraphs", () => {
    const paragraph = "An article with enough meaningful words for extraction. ".repeat(12);
    const result = extractArticle({
      url: "https://example.com/story",
      targetLanguage: "zh-TW",
      html: `<html><body><article><h1>Story</h1><p>${paragraph}</p><p><img src="/inside.png" alt="Inside"></p></article></body></html>`
    });
    expect(result.document.nodes.some((node) => node.type === "image" && node.src === "https://example.com/inside.png")).toBe(true);
  });
});
