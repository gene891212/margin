import { describe, expect, it } from "vitest";
import {
  detectNextPageUrl,
  isSameArticleTitle,
  normalizeTitleForComparison,
  resolvePageUrl
} from "./pagination.js";

describe("pagination detection", () => {
  it("resolves valid relative and absolute page URLs while respecting same-origin", () => {
    expect(resolvePageUrl("/p2/", "https://example.com/article/")).toBe("https://example.com/p2/");
    expect(resolvePageUrl("p2/", "https://example.com/article/")).toBe("https://example.com/article/p2/");
    expect(resolvePageUrl("?page=2", "https://example.com/article")).toBe("https://example.com/article?page=2");
    expect(resolvePageUrl("https://other.com/p2", "https://example.com/article")).toBeNull();
    expect(resolvePageUrl("#top", "https://example.com/article")).toBeNull();
    expect(resolvePageUrl("javascript:void(0)", "https://example.com/article")).toBeNull();
    expect(resolvePageUrl("https://example.com/article", "https://example.com/article")).toBeNull();
  });

  it("detects <link rel='next'> in head (Tier 1)", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="canonical" href="https://thetv.jp/news/detail/1430252/" />
          <link rel="next" href="https://thetv.jp/news/detail/1430252/p2/" />
        </head>
        <body><main>Content</main></body>
      </html>
    `;
    const nextUrl = detectNextPageUrl({
      html,
      currentUrl: "https://thetv.jp/news/detail/1430252/"
    });
    expect(nextUrl).toBe("https://thetv.jp/news/detail/1430252/p2/");
  });

  it("detects <a rel='next'> in body", () => {
    const html = `
      <html><body>
        <main>Content</main>
        <a rel="next" href="/article/2">Next Page</a>
      </body></html>
    `;
    const nextUrl = detectNextPageUrl({
      html,
      currentUrl: "https://example.com/article/1"
    });
    expect(nextUrl).toBe("https://example.com/article/2");
  });

  it("detects next button in pager container with text or img alt (Tier 2)", () => {
    const html = `
      <html><body>
        <div class="pager">
          <ul class="num__list">
            <li><span class="current">1</span></li>
            <li><a href="p2/">2</a></li>
          </ul>
          <div class="pager__next">
            <a class="next-btn" href="p2/"><img src="/arrow.svg" alt="次へ"></a>
          </div>
        </div>
      </body></html>
    `;
    const nextUrl = detectNextPageUrl({
      html,
      currentUrl: "https://example.com/news/detail/123/"
    });
    expect(nextUrl).toBe("https://example.com/news/detail/123/p2/");
  });

  it("detects sequential page number (Tier 2c)", () => {
    const html = `
      <html><body>
        <div class="pagination">
          <span class="page-numbers current">1</span>
          <a class="page-numbers" href="/story/page/2/">2</a>
          <a class="page-numbers" href="/story/page/3/">3</a>
        </div>
      </body></html>
    `;
    const nextUrl = detectNextPageUrl({
      html,
      currentUrl: "https://example.com/story/page/1/",
      currentPageNumber: 1
    });
    expect(nextUrl).toBe("https://example.com/story/page/2/");
  });

  it("strictly avoids false positives like '下一篇 / Next Article'", () => {
    const html = `
      <html><body>
        <div class="pager">
          <a href="/other-article">下一篇文章</a>
          <a href="/another-story">Next Article</a>
        </div>
      </body></html>
    `;
    const nextUrl = detectNextPageUrl({
      html,
      currentUrl: "https://example.com/story/1"
    });
    expect(nextUrl).toBeNull();
  });
});

describe("title normalization and same-article comparison", () => {
  it("normalizes titles by stripping site name and page markers", () => {
    const title1 = "鈴木愛理、“アナログに戻ろうキャンペーン”を実施中「叶えたい夢をノートにペンで書いています」＜ミニオンズ&モンスターズ＞ | WEBザテレビジョン";
    const title2 = "鈴木愛理、“アナログに戻ろうキャンペーン”を実施中「叶えたい夢をノートにペンで書いています」＜ミニオンズ&モンスターズ＞(2/3) | WEBザテレビジョン";

    expect(normalizeTitleForComparison(title1)).toBe(normalizeTitleForComparison(title2));
  });

  it("identifies same article across pagination variations", () => {
    const page1 = "An In-Depth Guide to TypeScript 5.8 - Tech Blog";
    const page2 = "An In-Depth Guide to TypeScript 5.8 (Page 2) - Tech Blog";
    const page3 = "An In-Depth Guide to TypeScript 5.8 - 第 3 頁 - Tech Blog";
    const differentArticle = "How to Learn Python in 2026 - Tech Blog";

    expect(isSameArticleTitle(page1, page2)).toBe(true);
    expect(isSameArticleTitle(page1, page3)).toBe(true);
    expect(isSameArticleTitle(page1, differentArticle)).toBe(false);
  });
});
