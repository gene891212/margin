import type { JobStatus } from "./types";

export const statusLabels: Record<Exclude<JobStatus, "idle">, string> = {
  queued: "排隊準備中",
  fetching: "載入網頁",
  extracting: "辨識正文",
  translating: "翻譯整篇文章",
  completed: "翻譯完成",
  failed: "處理失敗"
};

export const pipelineSteps: Exclude<JobStatus, "idle" | "failed">[] = [
  "queued",
  "fetching",
  "extracting",
  "translating",
  "completed"
];

export const ACTIVE_JOB_STATUSES: JobStatus[] = ["queued", "fetching", "extracting", "translating"];

export const LANGUAGE_OPTIONS = [
  { value: "zh-TW", label: "繁體中文 (台灣)" },
  { value: "zh-CN", label: "簡體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" }
] as const;

export const IMAGE_STORAGE_MODE_KEY = "wct_image_storage_mode";
