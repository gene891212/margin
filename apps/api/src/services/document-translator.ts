import type { DocumentAst, TranslationSegment } from "@wct/core";
import { parseTranslatedInline, serializeInline, textOfInline } from "../extractor/inline.js";

export function translationUnits(document: DocumentAst): TranslationSegment[] {
  const units: TranslationSegment[] = [{ id: "document-title", text: document.title }];
  for (const node of document.nodes) {
    if (!node.translatable) continue;
    if (node.type === "list") {
      node.items?.forEach((item, index) => {
        units.push({ id: `${node.id}:item:${index}`, text: serializeInline(item.inline) });
      });
    } else if (node.type === "table") {
      node.rows?.forEach((row, rowIndex) => row.forEach((cell, cellIndex) => {
        units.push({ id: `${node.id}:cell:${rowIndex}:${cellIndex}`, text: serializeInline(cell.inline) });
      }));
    } else if (node.inline.length && textOfInline(node.inline).trim()) {
      units.push({ id: node.id, text: serializeInline(node.inline) });
    }
  }
  return units;
}

export function applyTranslations(document: DocumentAst, translated: Map<string, string>): DocumentAst {
  const title = translated.get("document-title");
  if (!title) throw new Error("Missing translated title");
  return {
    ...document,
    translatedTitle: title,
    nodes: document.nodes.map((node) => {
      if (!node.translatable) return node;
      if (node.type === "list") return {
        ...node,
        items: node.items?.map((item, index) => {
          const value = translated.get(`${node.id}:item:${index}`);
          if (!value) throw new Error(`Missing list translation: ${node.id}:${index}`);
          return { ...item, translatedInline: parseTranslatedInline(item.inline, value) };
        })
      };
      if (node.type === "table") return {
        ...node,
        rows: node.rows?.map((row, rowIndex) => row.map((cell, cellIndex) => {
          const value = translated.get(`${node.id}:cell:${rowIndex}:${cellIndex}`);
          if (!value) throw new Error(`Missing table translation: ${node.id}:${rowIndex}:${cellIndex}`);
          return { ...cell, translatedInline: parseTranslatedInline(cell.inline, value) };
        }))
      };
      if (!node.inline.length) return node;
      const value = translated.get(node.id);
      if (!value) throw new Error(`Missing block translation: ${node.id}`);
      return { ...node, translatedInline: parseTranslatedInline(node.inline, value) };
    })
  };
}
