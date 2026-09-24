import { z } from "zod";

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "break" }
  | {
      type: "link" | "strong" | "emphasis" | "inline-code";
      id: string;
      href?: string;
      children: InlineNode[];
    };

export const inlineNodeSchema: z.ZodType<InlineNode> = z.lazy(() => z.union([
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("break") }),
  z.object({
    type: z.enum(["link", "strong", "emphasis", "inline-code"]),
    id: z.string(),
    href: z.string().url().optional(),
    children: z.array(inlineNodeSchema)
  })
]));

export const inlineContainerSchema = z.object({
  inline: z.array(inlineNodeSchema),
  translatedInline: z.array(inlineNodeSchema).optional()
});

export const documentNodeSchema = inlineContainerSchema.extend({
  id: z.string(),
  type: z.enum(["heading", "paragraph", "blockquote", "list", "image", "code", "table", "divider"]),
  level: z.number().int().min(1).max(6).optional(),
  ordered: z.boolean().optional(),
  items: z.array(inlineContainerSchema).optional(),
  rows: z.array(z.array(inlineContainerSchema)).optional(),
  src: z.string().url().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  code: z.string().optional(),
  translatable: z.boolean().default(true)
});

export const documentAstSchema = z.object({
  version: z.literal(1),
  title: z.string(),
  translatedTitle: z.string().optional(),
  byline: z.string().nullable().optional(),
  siteName: z.string().nullable().optional(),
  sourceUrl: z.string().url(),
  sourceLanguage: z.string().nullable().optional(),
  targetLanguage: z.string(),
  nodes: z.array(documentNodeSchema)
});

export const createTranslationJobSchema = z.object({
  source: z.object({ type: z.literal("url"), url: z.string().url() }),
  targetLanguage: z.string().min(2).max(35).default("zh-TW"),
  browserProfileId: z.string().uuid().optional(),
  browserMode: z.enum(["desktop", "mobile"]).default("desktop")
});

export const createBrowserProfileSchema = z.object({
  name: z.string().trim().min(1).max(80)
});

export type DocumentNode = z.infer<typeof documentNodeSchema>;
export type DocumentAst = z.infer<typeof documentAstSchema>;
export type CreateTranslationJob = z.infer<typeof createTranslationJobSchema>;

export interface TranslationSegment {
  id: string;
  text: string;
}

export interface TranslatedSegment {
  id: string;
  text: string;
}

export interface TranslationProvider {
  readonly name: string;
  readonly kind: "llm" | "machine-translation" | "mock";
  readonly model?: string;
  translate(input: {
    sourceLanguage?: string | null;
    targetLanguage: string;
    documentContext: { title: string; siteName?: string | null; byline?: string | null };
    segments: TranslationSegment[];
  }): Promise<TranslatedSegment[]>;
}

export interface TranslationExecutionStrategy {
  readonly name: string;
  execute(input: {
    provider: TranslationProvider;
    sourceLanguage?: string | null;
    targetLanguage: string;
    documentContext: { title: string; siteName?: string | null; byline?: string | null };
    segments: TranslationSegment[];
  }): Promise<TranslatedSegment[]>;
}
