export type InlineNode =
  | { type: "text"; text: string }
  | { type: "break" }
  | { type: "link" | "strong" | "emphasis" | "inline-code"; id: string; href?: string; children: InlineNode[] };

export type InlineContainer = { inline: InlineNode[]; translatedInline?: InlineNode[] };
export type DocumentNode = InlineContainer & {
  id: string;
  type: "heading" | "paragraph" | "blockquote" | "list" | "image" | "code" | "table" | "divider";
  level?: number;
  ordered?: boolean;
  items?: InlineContainer[];
  rows?: InlineContainer[][];
  src?: string;
  alt?: string;
  code?: string;
};
export type Article = {
  title: string;
  translatedTitle?: string;
  byline?: string | null;
  siteName?: string | null;
  sourceUrl: string;
  translationProvider?: string | null;
  nodes: DocumentNode[];
};
export type JobStatus = "idle" | "queued" | "fetching" | "extracting" | "translating" | "completed" | "failed";
export type RecentJob = {
  id: string;
  sourceUrl: string;
  status: Exclude<JobStatus, "idle">;
  error: string | null;
  documentId: string | null;
  title: string | null;
  translatedTitle: string | null;
  provider: string | null;
  createdAt: string;
};
export type BrowserProfile = {
  status: "new" | "ready" | "reauth_required";
  busy: boolean;
  createdAt?: string;
  lastUsedAt?: string | null;
};

export type BrowserMode = "desktop" | "mobile";
export type ImageStorageMode = "local" | "proxy";
export type SettingsTab = "general" | "storage" | "browser" | "engine";
export type AssetStats = { count: number; totalBytes: number };
export type ReaderLayout = "stacked" | "side-by-side";
