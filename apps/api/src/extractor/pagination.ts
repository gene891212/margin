import { JSDOM } from "jsdom";

function cleanText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function resolvePageUrl(href: string | null | undefined, baseUrl: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.toLowerCase().startsWith("javascript:")) {
    return null;
  }
  try {
    const target = new URL(trimmed, baseUrl);
    if (!["http:", "https:"].includes(target.protocol)) return null;

    const base = new URL(baseUrl);
    if (target.origin !== base.origin) return null;

    // Strip hash for comparison
    target.hash = "";
    const cleanBase = new URL(baseUrl);
    cleanBase.hash = "";

    if (target.href === cleanBase.href) return null;

    return target.href;
  } catch {
    return null;
  }
}

const NEXT_TEXT_REGEX = /^(次へ|次ページ|次のページ|下一頁|下页|下一页|next|next\s*page|›|»|>)$/i;
const EXCLUDE_TEXT_REGEX = /(下一篇|下一則|下一条|次の記事|next\s*article|next\s*post|next\s*story|previous|prev|前へ|上一頁|上页|上一页)/i;

const PAGER_SELECTORS = [
  ".pagination",
  ".pager",
  ".page-nav",
  ".pages",
  ".page-numbers",
  ".nav-links",
  ".newsArticle_pager",
  "nav[role='navigation']",
  "nav[class*='page']",
  "div[class*='pagination']",
  "div[class*='pager']",
  "ul[class*='pagination']",
  "ul[class*='pager']"
];

/**
 * Detects the next page URL from HTML content.
 * Follows a 3-tier priority:
 * 1. <link rel="next"> or <a rel="next">
 * 2. Next button within pagination containers (text/class/img alt)
 * 3. Next sequential page number (e.g. current is page 1, look for page 2)
 */
export function detectNextPageUrl(input: {
  html: string;
  currentUrl: string;
  currentPageNumber?: number;
}): string | null {
  const dom = new JSDOM(input.html, { url: input.currentUrl });
  const doc = dom.window.document;

  // Tier 1: Standard semantic <link rel="next"> in <head>
  const headLink = doc.querySelector('link[rel~="next"]');
  if (headLink) {
    const url = resolvePageUrl(headLink.getAttribute("href"), input.currentUrl);
    if (url) return url;
  }

  // Tier 1.5: <a rel="next"> anywhere in <body>
  const anchorRelNext = doc.querySelector('a[rel~="next"]');
  if (anchorRelNext) {
    const url = resolvePageUrl(anchorRelNext.getAttribute("href"), input.currentUrl);
    if (url) return url;
  }

  // Tier 2: Check inside designated pager containers
  for (const selector of PAGER_SELECTORS) {
    const container = doc.querySelector(selector);
    if (!container) continue;

    // 2a: Look for anchors with next-like classes
    const nextBtn = container.querySelector('a[class*="next"], a[id*="next"]');
    if (nextBtn) {
      const url = resolvePageUrl(nextBtn.getAttribute("href"), input.currentUrl);
      if (url) return url;
    }

    // 2b: Look for anchors with text or img[alt] matching "Next / 下一頁 / 次へ"
    const links = container.querySelectorAll("a");
    for (const link of links) {
      const linkText = cleanText(link.textContent);
      const imgAlt = cleanText(link.querySelector("img")?.getAttribute("alt"));
      const candidateText = linkText || imgAlt;

      if (!candidateText) continue;
      if (EXCLUDE_TEXT_REGEX.test(candidateText)) continue;

      if (NEXT_TEXT_REGEX.test(candidateText)) {
        const url = resolvePageUrl(link.getAttribute("href"), input.currentUrl);
        if (url) return url;
      }
    }

    // 2c: Sequential page number (e.g. looking for "2" if current is 1)
    const targetPageNum = (input.currentPageNumber ?? 1) + 1;
    const targetNumStr = String(targetPageNum);
    for (const link of links) {
      const linkText = cleanText(link.textContent);
      if (linkText === targetNumStr || linkText === targetNumStr.padStart(2, "0")) {
        const url = resolvePageUrl(link.getAttribute("href"), input.currentUrl);
        if (url) return url;
      }
    }
  }

  // Tier 3: Global body search for buttons/links with explicit "下一頁 / 次へ / Next Page" text
  const allLinks = doc.querySelectorAll("a");
  for (const link of allLinks) {
    const linkText = cleanText(link.textContent);
    const imgAlt = cleanText(link.querySelector("img")?.getAttribute("alt"));
    const candidateText = linkText || imgAlt;

    if (!candidateText) continue;
    if (EXCLUDE_TEXT_REGEX.test(candidateText)) continue;

    // Be stricter for global search to avoid false positives
    if (/^(次へ|次ページ|下一頁|下页|下一页|next\s*page)$/i.test(candidateText)) {
      const url = resolvePageUrl(link.getAttribute("href"), input.currentUrl);
      if (url) return url;
    }
  }

  return null;
}

/**
 * Normalizes title for similarity comparison across article pages.
 * Removes site names, page indicators (e.g. (2/3), [2], 第2頁, Page 2), and common separators.
 */
export function normalizeTitleForComparison(title: string): string {
  let normalized = cleanText(title);

  // Remove common trailing site name patterns: " | SiteName", " - SiteName", " _ SiteName"
  normalized = normalized.replace(/\s+[|\-_–—]\s+[^|\-_–—]+$/, "");

  // Remove page indicators: "(2/3)", "(2)", "[2/3]", "【2/3】", "第2頁", "Page 2"
  normalized = normalized.replace(/\s*[\(\[（【]\s*\d+\s*[\/／]\s*\d+\s*[\)\]）】]/g, "");
  normalized = normalized.replace(/\s*[\(\[（【]\s*\d+\s*[\)\]）】]/g, "");
  normalized = normalized.replace(/\s*(?:第\s*\d+\s*[頁页]|page\s*\d+)/gi, "");

  return cleanText(normalized).toLowerCase();
}

/**
 * Checks whether the candidate page title belongs to the same article as the original title.
 */
export function isSameArticleTitle(originalTitle: string, candidateTitle: string): boolean {
  const normOriginal = normalizeTitleForComparison(originalTitle);
  const normCandidate = normalizeTitleForComparison(candidateTitle);

  if (!normOriginal || !normCandidate) return false;
  if (normOriginal === normCandidate) return true;

  // Substring containment check
  if (normCandidate.includes(normOriginal) || normOriginal.includes(normCandidate)) {
    return true;
  }

  // Calculate character overlap ratio (Dice coefficient on bigrams or character set)
  const setOriginal = new Set(normOriginal);
  const setCandidate = new Set(normCandidate);
  let intersection = 0;
  for (const char of setCandidate) {
    if (setOriginal.has(char)) intersection++;
  }
  const minLength = Math.min(setOriginal.size, setCandidate.size);
  const overlap = minLength > 0 ? intersection / minLength : 0;

  return overlap >= 0.7;
}
