import { JSDOM } from "jsdom";
import type { InlineNode } from "@wct/core";

const MARK_TAGS: Record<string, "link" | "strong" | "emphasis" | "inline-code"> = {
  a: "link",
  strong: "strong",
  b: "strong",
  em: "emphasis",
  i: "emphasis",
  code: "inline-code"
};

function escapeText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function textOfInline(nodes: InlineNode[]): string {
  return nodes.map((node) => node.type === "text"
    ? node.text
    : node.type === "break"
      ? "\n"
      : textOfInline(node.children)).join("");
}

export function extractInline(element: Element, baseUrl: string): InlineNode[] {
  let sequence = 0;
  function walk(node: Node): InlineNode[] {
    if (node.nodeType === 3) {
      const text = node.textContent ?? "";
      return text ? [{ type: "text", text }] : [];
    }
    if (node.nodeType !== 1) return [];
    const current = node as Element;
    if (current.getAttribute("translate") === "no") {
      return [{ type: "text", text: current.textContent ?? "" }];
    }
    const tag = current.tagName.toLowerCase();
    if (tag === "br") return [{ type: "break" }];
    if (["script", "style", "button", "form", "noscript"].includes(tag)) return [];
    const type = MARK_TAGS[tag];
    const id = type ? `m${++sequence}` : undefined;
    const children = [...current.childNodes].flatMap(walk);
    if (!type || children.length === 0) return children;
    const hrefValue = tag === "a" ? current.getAttribute("href") : null;
    let href: string | undefined;
    if (hrefValue) {
      try {
        const candidate = new URL(hrefValue, baseUrl);
        if (["http:", "https:"].includes(candidate.protocol)) href = candidate.toString();
      } catch { /* Ignore malformed links. */ }
    }
    if (type === "link" && !href) return children;
    return [{ type, id: id!, href, children }];
  }
  return [...element.childNodes].flatMap(walk);
}

export function serializeInline(nodes: InlineNode[]): string {
  return nodes.map((node) => {
    if (node.type === "text") return escapeText(node.text);
    if (node.type === "break") return "<br/>";
    return `<x id="${node.id}" kind="${node.type}">${serializeInline(node.children)}</x>`;
  }).join("");
}

export function parseTranslatedInline(source: InlineNode[], translated: string): InlineNode[] {
  const expected = new Map<string, { node: Exclude<InlineNode, { type: "text" } | { type: "break" }>; parent: string | null }>();
  function collect(nodes: InlineNode[], parent: string | null) {
    for (const node of nodes) {
      if (node.type === "text" || node.type === "break") continue;
      if (expected.has(node.id)) throw new Error(`Duplicate source marker ${node.id}`);
      expected.set(node.id, { node, parent });
      collect(node.children, node.id);
    }
  }
  collect(source, null);

  const document = new JSDOM(`<body>${translated}</body>`).window.document;
  const seen = new Set<string>();
  function walk(parent: Node, parentId: string | null): InlineNode[] {
    return [...parent.childNodes].flatMap((child): InlineNode[] => {
      if (child.nodeType === 3) return [{ type: "text", text: child.textContent ?? "" }];
      if (child.nodeType !== 1) return [];
      const element = child as Element;
      const tag = element.tagName.toLowerCase();
      if (tag === "br") return [{ type: "break" }];
      if (tag !== "x" || element.attributes.length !== 2) {
        throw new Error("Translation changed inline markup");
      }
      const id = element.getAttribute("id") ?? "";
      const match = expected.get(id);
      if (!match || match.parent !== parentId || seen.has(id) || element.getAttribute("kind") !== match.node.type) {
        throw new Error(`Translation changed inline marker ${id}`);
      }
      seen.add(id);
      const children = walk(element, id);
      if (match.node.type === "inline-code" && textOfInline(children) !== textOfInline(match.node.children)) {
        throw new Error(`Translation altered inline code marker ${id}`);
      }
      return [{
        type: match.node.type,
        id,
        href: match.node.href,
        children
      }];
    });
  }
  const result = walk(document.body, null);
  if (seen.size !== expected.size) throw new Error("Translation omitted inline markers");
  return result;
}
