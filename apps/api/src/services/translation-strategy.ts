import type {
  TranslatedSegment,
  TranslationExecutionStrategy,
  TranslationSegment
} from "@wct/core";
import { AppError } from "./errors.js";

function assertCompleteTranslation(
  source: TranslationSegment[],
  translated: TranslatedSegment[]
): void {
  const expected = new Set(source.map((segment) => segment.id));
  const received = new Set<string>();

  for (const segment of translated) {
    if (!expected.has(segment.id)) {
      throw new Error(`Translation provider returned unknown segment ID: ${segment.id}`);
    }
    if (received.has(segment.id)) {
      throw new Error(`Translation provider returned duplicate segment ID: ${segment.id}`);
    }
    if (!segment.text.trim()) {
      throw new Error(`Translation provider returned empty text for segment ID: ${segment.id}`);
    }
    received.add(segment.id);
  }

  const missing = [...expected].filter((id) => !received.has(id));
  if (missing.length > 0) {
    throw new Error(`Translation provider omitted ${missing.length} segment(s): ${missing.slice(0, 5).join(", ")}`);
  }
}

export class WholeDocumentTranslationStrategy implements TranslationExecutionStrategy {
  readonly name = "whole-document";

  constructor(private readonly maxCharacters: number) {}

  async execute(input: Parameters<TranslationExecutionStrategy["execute"]>[0]) {
    const characterCount = input.segments.reduce((sum, segment) => sum + segment.text.length, 0);
    if (characterCount > this.maxCharacters) {
      throw new AppError("translation_too_long",
        `Article contains ${characterCount} translatable characters, exceeding the whole-document limit of ${this.maxCharacters}. `
        + "An adaptive chunking strategy is required for this article."
      );
    }

    const translated = await input.provider.translate({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      documentContext: input.documentContext,
      segments: input.segments
    });
    assertCompleteTranslation(input.segments, translated);
    return translated;
  }
}
