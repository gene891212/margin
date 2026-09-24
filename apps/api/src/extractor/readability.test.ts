import { describe, expect, it } from "vitest";
import { textOfInline } from "./inline.js";
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

  it("uses the article heading when Readability returns the site name as title", () => {
    const paragraph = "A detailed journal entry with enough body text for Readability to identify the article. ".repeat(12);
    const result = extractArticle({
      url: "https://example.com/blog/detail/6/",
      targetLanguage: "zh-TW",
      html: `<html><head><title>Example Fan Club</title><meta property="og:site_name" content="Example Fan Club"></head>
        <body><article><p>2026.09.16</p><h2>Once Upon a Time　September 2016</h2><p>${paragraph}</p></article></body></html>`
    });
    expect(result.document.title).toBe("Once Upon a Time　September 2016");
    expect(result.document.nodes.some((node) => node.type === "heading" && textOfInline(node.inline) === result.document.title)).toBe(false);
  });

  it("uses a heading matching the page title instead of a blog category", () => {
    const paragraph = "A detailed journal entry with enough body text for Readability to identify the article. ".repeat(12);
    const result = extractArticle({
      url: "https://example.com/diary/detail/454094",
      targetLanguage: "zh-TW",
      html: `<html><head><title>MoG 💎 埼玉 | miles | milet official mobile fanclub</title>
        <meta property="og:title" content="miles | milet official mobile fanclub">
        <meta property="og:site_name" content="milet official mobile fanclub"></head>
        <body><article><h1>blog</h1><p>2026.09.22</p><p>milet</p><h1>MoG 💎 埼玉</h1><p>${paragraph}</p></article></body></html>`
    });
    expect(result.document.title).toBe("MoG 💎 埼玉");
    expect(result.document.nodes.some((node) => node.type === "heading" && textOfInline(node.inline) === "blog")).toBe(true);
    expect(result.document.nodes.some((node) => node.type === "heading" && textOfInline(node.inline) === "MoG 💎 埼玉")).toBe(false);
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

  it("retains an article cover rendered as a CSS background", () => {
    const paragraph = "An article with enough meaningful words for extraction. ".repeat(12);
    const result = extractArticle({
      url: "https://example.com/story",
      targetLanguage: "zh-TW",
      html: `<html><head><meta property="og:image" content="https://example.com/cover.jpg"></head><body>
        <article><h1>Story</h1><div class="article-cover" data-src="/cover.jpg" style="background-image: url('/cover.jpg')"></div>
        <div><p>${paragraph}</p><p><img src="/body.jpg" alt="Body"></p></div></article>
      </body></html>`
    });
    expect(result.document.nodes.filter((node) => node.type === "image").map((node) => node.src))
      .toEqual(["https://example.com/cover.jpg", "https://example.com/body.jpg"]);
  });
});
