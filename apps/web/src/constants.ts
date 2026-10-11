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

export const ERROR_MAPPINGS: Record<string, { label: string; tip: string }> = {
  login_required: {
    label: "目標網頁需要登入",
    tip: "此頁面受付費牆或會員登入權限保護，請在設定中開啟『本機登入環境』完成登入後重試。"
  },
  reauth_required: {
    label: "登入階段已過期",
    tip: "目標網頁的登入憑證已失效，請在設定中重新開啟登入視窗完成驗證。"
  },
  rate_limited: {
    label: "請求頻率過高 (HTTP 429)",
    tip: "目標網站或翻譯服務暫時限制請求頻率，建議稍候 1-2 分鐘後再點擊重試。"
  },
  anti_bot_challenge: {
    label: "遇到防爬蟲驗證 (Cloudflare / CAPTCHA)",
    tip: "目標網站啟動了機器人驗證，建議使用『本機登入環境』模式載入。"
  },
  extraction_failed: {
    label: "無法辨識主要文章正文",
    tip: "未能從該網頁解析出內容，建議嘗試切換為『手機版』載入模式，或確認網址是否為主要文章頁。"
  },
  url_not_allowed: {
    label: "不支援的網址",
    tip: "僅支援公開的 HTTP / HTTPS 網址，請確認網址格式是否正確。"
  },
  source_too_large: {
    label: "網頁原始碼過大",
    tip: "網頁大小超出系統單次擷取上限。"
  },
  browser_unavailable: {
    label: "Chromium 瀏覽器驅動未就緒",
    tip: "系統本機未安裝 Chromium 瀏覽器，請在終端機執行 pnpm browser:install。"
  },
  browser_http_error: {
    label: "網頁載入狀態異常",
    tip: "瀏覽器載入時目標伺服器回傳錯誤狀態碼，請確認網址能正常造訪。"
  },
  http_error: {
    label: "連線擷取失敗",
    tip: "無法自目標網站下載頁面內容，請檢查網址或網路連線。"
  },
  translation_too_long: {
    label: "文字量超出限制",
    tip: "文章內文字數超出 AI 模型單次處理上限。"
  },
  unexpected_error: {
    label: "系統非預期錯誤",
    tip: "處理過程發生異常，可直接點擊重試。"
  }
};

export function formatErrorDetail(errorCode?: string | null, error?: string | null) {
  const mapping = errorCode ? ERROR_MAPPINGS[errorCode] : undefined;
  const label = mapping?.label ?? (errorCode ? `錯誤 (${errorCode})` : "處理失敗");
  const tip = mapping?.tip;
  const detail = error && error !== errorCode && error !== label ? error : undefined;
  return { label, tip, detail };
}
