import { createHash } from "node:crypto";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type { DocumentAst, DocumentNode } from "@wct/core";
import { extractInline, textOfInline } from "./inline.js";

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function stableId(type: string, sequence: number, text: string): string {
  return `${type}-${sequence}-${createHash("sha1").update(text).digest("hex").slice(0, 10)}`;
}

function absoluteUrl(value: string | null, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch { return undefined; }
}

function extractImgSrc(element: Element, baseUrl: string): string | undefined {
  const candidates = [
    element.getAttribute("src"),
    element.getAttribute("data-src"),
    element.getAttribute("data-original"),
    element.getAttribute("data-lazy-src"),
    element.getAttribute("data-actualsrc"),
    element.getAttribute("data-original-src"),
    element.getAttribute("data-url")
  ];
  for (const candidate of candidates) {
    if (candidate && !candidate.startsWith("data:") && candidate.trim()) {
      const abs = absoluteUrl(candidate, baseUrl);
      if (abs) return abs;
    }
  }
  const srcset = element.getAttribute("srcset") ?? element.getAttribute("data-srcset");
  if (srcset) {
    const parts = srcset.split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && !last.startsWith("data:")) {
      const abs = absoluteUrl(last, baseUrl);
      if (abs) return abs;
    }
  }
  const src = element.getAttribute("src");
  if (src && src.startsWith("data:image/") && src.length > 200) {
    return src;
  }
  return undefined;
}

function findLeadImage(document: Document, baseUrl: string): { src: string; alt: string } | undefined {
  for (const selector of [
    "article header img",
    "header.article-header img",
    "header[class*='article'] img",
    "[class*='article-header'] img",
    "[class*='article-lead'] img",
    "[class*='eyecatch'] img",
    "[class*='main-visual'] img",
    "[class*='featured-image'] img",
    "[class*='hero-image'] img",
    ".hero img"
  ]) {
    const el = document.querySelector(selector);
    if (el) {
      const src = extractImgSrc(el, baseUrl);
      if (src) return { src, alt: clean(el.getAttribute("alt")) };
    }
  }

  const socialImage = absoluteUrl(document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null, baseUrl);
  for (const article of document.querySelectorAll("article")) {
    for (const element of article.querySelectorAll<HTMLElement>('[style*="background-image"]')) {
      const cssUrl = element.style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
      const src = absoluteUrl(cssUrl ?? element.getAttribute("data-src"), baseUrl);
      if (src && src === socialImage) return { src, alt: "" };
    }
  }

  if (socialImage && !socialImage.toLowerCase().includes("logo") && !socialImage.toLowerCase().includes("favicon")) {
    return { src: socialImage, alt: "" };
  }

  return undefined;
}

export function extractArticle(input: {
  html: string;
  url: string;
  targetLanguage: string;
}): { document: DocumentAst; confidence: number; textLength: number } {
  const dom = new JSDOM(input.html, { url: input.url });
  const leadImage = findLeadImage(dom.window.document, input.url);
  const parsed = new Readability(dom.window.document.cloneNode(true) as Document).parse();
  if (!parsed || clean(parsed.textContent).length < 120) {
    throw new Error("Could not identify enough main article content");
  }

  const content = new JSDOM(`<main>${parsed.content}</main>`, { url: input.url }).window.document;
  const nodes: DocumentNode[] = [];
  const push = (node: Omit<DocumentNode, "id">, seed: string) => {
    nodes.push({ ...node, id: stableId(node.type, nodes.length, seed) });
  };

  function visit(element: Element) {
    const tag = element.tagName.toLowerCase();
    if (["script", "style", "nav", "aside", "form", "button"].includes(tag)) return;
    if (/^h[1-6]$/.test(tag) || tag === "p" || tag === "blockquote") {
      const inline = extractInline(element, input.url);
      const text = clean(textOfInline(inline));
      if (text) push({
        type: tag.startsWith("h") ? "heading" : tag === "blockquote" ? "blockquote" : "paragraph",
        inline,
        level: tag.startsWith("h") ? Number(tag.slice(1)) : undefined,
        translatable: true
      }, text);
      if (tag === "p") {
        for (const image of element.querySelectorAll("img")) visit(image);
      }
      return;
    }
    if (tag === "ul" || tag === "ol") {
      const items = [...element.children].filter((child) => child.tagName.toLowerCase() === "li")
        .map((child) => ({ inline: extractInline(child, input.url) }))
        .filter((item) => clean(textOfInline(item.inline)));
      if (items.length) push({ type: "list", inline: [], items, ordered: tag === "ol", translatable: true }, items.map((item) => textOfInline(item.inline)).join("|"));
      return;
    }
    if (tag === "table") {
      const rows = [...element.querySelectorAll("tr")].map((row) =>
        [...row.children].filter((cell) => ["td", "th"].includes(cell.tagName.toLowerCase()))
          .map((cell) => ({ inline: extractInline(cell, input.url) }))
      ).filter((row) => row.length > 0);
      if (rows.length) push({ type: "table", inline: [], rows, translatable: true }, rows.map((row) => row.map((cell) => textOfInline(cell.inline)).join("|")).join("||"));
      return;
    }
    if (tag === "pre") {
      const code = element.textContent ?? "";
      if (code.trim()) push({ type: "code", inline: [], code, translatable: false }, code);
      return;
    }
    if (tag === "img") {
      const src = extractImgSrc(element, input.url);
      if (src) push({ type: "image", inline: [], src, alt: clean(element.getAttribute("alt")), translatable: false }, src);
      return;
    }
    if (tag === "figure") {
      const image = element.querySelector("img");
      if (image) visit(image);
      const caption = element.querySelector("figcaption");
      if (caption) {
        const inline = extractInline(caption, input.url);
        if (clean(textOfInline(inline))) push({ type: "paragraph", inline, translatable: true }, textOfInline(inline));
      }
      return;
    }
    if (tag === "hr") {
      push({ type: "divider", inline: [], translatable: false }, "hr");
      return;
    }
    for (const child of element.children) visit(child);
  }

  const root = content.querySelector("main");
  if (root) visit(root);
  if (leadImage && !nodes.some((node) => node.type === "image" && node.src === leadImage.src)) {
    nodes.unshift({ id: stableId("image", 0, leadImage.src), type: "image", inline: [], src: leadImage.src, alt: leadImage.alt, translatable: false });
  }
  if (nodes.length === 0) throw new Error("Article structure did not contain readable blocks");

  let title = clean(parsed.title) || "Untitled article";
  const siteName = clean(parsed.siteName).toLocaleLowerCase();
  if (siteName && title.toLocaleLowerCase().includes(siteName)) {
    const pageTitle = clean(dom.window.document.title).toLocaleLowerCase();
    const headingCandidates = nodes
      .map((node, index) => ({ node, index, text: textOfInline(node.inline).replace(/[\t\r\n ]+/g, " ").trim() }))
      .filter(({ node, index, text }) => index < 8 && node.type === "heading"
        && (node.level === 1 || node.level === 2) && text);
    const matchingHeading = headingCandidates
      .filter(({ text }) => pageTitle.startsWith(text.toLocaleLowerCase()))
      .sort((a, b) => b.text.length - a.text.length)[0];
    const headingIndex = matchingHeading?.index
      ?? (title.toLocaleLowerCase() === siteName ? headingCandidates[0]?.index : undefined);
    if (headingIndex !== undefined) {
      title = textOfInline(nodes[headingIndex]!.inline).replace(/[\t\r\n ]+/g, " ").trim();
      nodes.splice(headingIndex, 1);
    }
  }

  const textLength = clean(parsed.textContent).length;
  const confidence = Math.min(0.97, 0.55 + Math.log10(Math.max(textLength, 100)) / 10);
  return {
    document: {
      version: 1,
      title,
      byline: parsed.byline,
      siteName: parsed.siteName,
      sourceUrl: input.url,
      sourceLanguage: parsed.lang,
      targetLanguage: input.targetLanguage,
      nodes
    },
    confidence,
    textLength
  };
}
