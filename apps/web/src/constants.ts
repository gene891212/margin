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

type ErrorExplanation = { label: string; description?: string; tip: string; retryable?: boolean };

export const ERROR_MAPPINGS: Record<string, ErrorExplanation> = {
  translation_tunnel_unavailable: {
    label: "翻譯服務的 Cloudflare Tunnel 無法連線",
    description: "Cloudflare 回傳 1033，表示目前沒有可用的通道能接到翻譯服務；尚無法確認模型本身是否啟動。",
    tip: "請到翻譯伺服器檢查 cloudflared 是否正在執行、Tunnel 是否連線，以及主機的網路狀態，再重試。",
    retryable: false
  },
  translation_origin_dns_error: {
    label: "Cloudflare 無法解析翻譯服務的來源主機",
    description: "Cloudflare 回傳 1016，無法從來源主機名稱找到可連線的位址。",
    tip: "請檢查 Cloudflare 的來源主機、DNS 記錄與 Tunnel 路由設定，修正後再重試。",
    retryable: false
  },
  translation_gateway_error: {
    label: "翻譯服務的連線入口發生異常（HTTP 530）",
    description: "已收到翻譯服務入口的錯誤回應，但缺少足夠資訊，無法確認是服務未啟動、通道中斷或 DNS 設定問題。",
    tip: "若使用 Cloudflare Tunnel，請先檢查通道狀態，再確認模型服務與來源位址設定。舊紀錄可能已截掉細部原因，重新執行後才能取得完整診斷。"
  },
  translation_auth_failed: {
    label: "翻譯服務拒絕了 API 金鑰",
    description: "翻譯服務無法驗證目前設定的金鑰。",
    tip: "請檢查 .env 的 OPENAI_API_KEY 是否有效，且與 OPENAI_BASE_URL 的服務相符；更新後重啟 API 再試。",
    retryable: false
  },
  translation_quota_exceeded: {
    label: "翻譯服務的額度不足",
    description: "服務回報可用額度或帳務限制，等待或連續重試通常無法解決。",
    tip: "請檢查服務帳戶的餘額、用量上限與計費狀態，或改用其他可用的翻譯服務。",
    retryable: false
  },
  translation_rate_limited: {
    label: "翻譯服務暫時限制請求頻率",
    description: "模型服務收到過多請求，暫時拒絕處理。",
    tip: "請稍後再試，並減少同時送往此服務的請求；實際等待時間以服務的限制為準。"
  },
  translation_generation_aborted: {
    label: "模型因重複生成內容而中止",
    description: "模型服務偵測到重複輸出並停止生成，這次沒有完成譯文。",
    tip: "可重試一次；若持續發生，請更換模型或檢查模型服務的生成設定。"
  },
  translation_context_exceeded: {
    label: "文章超過模型的上下文容量",
    description: "服務回報輸入文字與預留輸出超過模型可處理的範圍。",
    tip: "請改用上下文容量更大的模型。目前整篇翻譯不會自動分段，同樣設定下直接重試無法解決。",
    retryable: false
  },
  translation_model_not_found: {
    label: "翻譯服務找不到指定模型",
    tip: "請確認 OPENAI_MODEL 名稱與模型存取權限；若使用 Ollama，請確認伺服器已下載該模型。修改 .env 後須重啟 API。",
    retryable: false
  },
  translation_forbidden: {
    label: "沒有使用翻譯服務的權限",
    tip: "請檢查帳戶、模型權限，以及代理服務的存取規則，確認允許此請求後再試。",
    retryable: false
  },
  translation_endpoint_not_found: {
    label: "找不到翻譯 API 路徑",
    tip: "請檢查 OPENAI_BASE_URL。系統會在網址後加上 /chat/completions，服務必須支援 OpenAI 相容協定；修改後重啟 API。",
    retryable: false
  },
  translation_connection_refused: {
    label: "翻譯服務拒絕連線",
    description: "目標位址拒絕建立連線，可能是服務未啟動、連接埠錯誤或存取規則阻擋。",
    tip: "請確認模型服務正在執行，並檢查 OPENAI_BASE_URL 的主機與連接埠是否正確。",
    retryable: false
  },
  translation_dns_error: {
    label: "找不到翻譯服務的主機位址",
    tip: "請檢查 OPENAI_BASE_URL 的網域拼字、DNS 設定與網路連線，再重試。"
  },
  translation_tls_error: {
    label: "無法驗證翻譯服務的安全連線",
    tip: "請檢查伺服器的 HTTPS 憑證、有效期限與憑證鏈，修正後再試。",
    retryable: false
  },
  translation_timeout: {
    label: "等待翻譯服務回應逾時",
    description: "未能在等待期限內取得完整回應，尚無法確認是模型運算過久或中間連線逾時。",
    tip: "請查看模型服務與代理的紀錄，確認是否仍在運算；可稍後重試，或改用較快的模型。"
  },
  translation_service_unavailable: {
    label: "翻譯服務暫時無法提供服務",
    description: "翻譯服務或中間代理回報服務不可用，無法僅憑這個狀態確認模型是否啟動。",
    tip: "請確認模型服務、代理與通道的運作狀態，並查看伺服器紀錄；恢復後再試。"
  },
  translation_server_error: {
    label: "翻譯伺服器處理請求時發生錯誤",
    tip: "請查看下方技術資訊與模型伺服器紀錄；可重試一次，若持續失敗，請檢查服務狀態或更換模型。"
  },
  translation_network_error: {
    label: "與翻譯服務的連線中斷",
    tip: "請檢查網路、翻譯服務與中間代理，再重試；目前無法據此確認服務是否未啟動。"
  },
  translation_request_rejected: {
    label: "翻譯服務不接受目前的請求格式",
    tip: "請確認模型支援 OpenAI 相容的 /chat/completions 與 JSON 輸出格式，並檢查下方服務回報的原因。",
    retryable: false
  },
  translation_request_cancelled: {
    label: "翻譯請求被服務或代理中止（HTTP 499）",
    description: "服務入口回報請求已中止；這個回應本身不足以確認是等待逾時、連線中斷或上游取消。",
    tip: "請檢查翻譯服務與代理的請求紀錄、逾時設定和連線狀態，確認後再重試。"
  },
  translation_provider_error: {
    label: "翻譯服務未能完成請求",
    tip: "請查看下方服務回報的原因，檢查模型與 API 設定後再試。"
  },
  translation_invalid_response: {
    label: "翻譯服務回傳的格式不正確",
    description: "回應不是有效的譯文 JSON，或缺少必要欄位，因此沒有儲存這次結果。",
    tip: "可重試一次；若持續發生，請確認 API 網址與模型是否支援要求的 JSON 格式，或改用其他模型。"
  },
  translation_output_truncated: {
    label: "模型的譯文被輸出長度限制截斷",
    tip: "請增加模型服務允許的輸出長度或更換模型。目前不會自動分段，同樣設定下直接重試可能仍會失敗。",
    retryable: false
  },
  translation_refused: {
    label: "模型拒絕翻譯這篇文章",
    tip: "內容可能觸發模型服務的篩選規則，請確認該服務允許處理此內容。",
    retryable: false
  },
  translation_empty_response: {
    label: "模型沒有回傳譯文",
    tip: "可重試一次；若持續發生，請查看模型服務紀錄並確認模型支援文字與 JSON 輸出。"
  },
  translation_incomplete: {
    label: "模型回傳的譯文不完整",
    description: "譯文有段落缺漏、重複或空白，因此沒有儲存這次結果。",
    tip: "可重試一次；若持續發生，請更換能完整處理這篇文章的模型。"
  },
  translation_markup_invalid: {
    label: "模型改動了文章的排版標記",
    tip: "譯文未能保留必要的行內標記，因此沒有儲存這次結果。請重試或更換模型。"
  },
  api_unreachable: {
    label: "無法連到本機翻譯器後端",
    tip: "請確認本機 API 已啟動並檢查網路連線。這項錯誤尚無法判斷遠端模型服務的狀態。"
  },
  api_http_error: { label: "本機 API 未能完成請求", tip: "請確認本機 API 的運作狀態，並查看技術資訊中的 HTTP 狀態。" },
  invalid_api_response: { label: "無法讀取本機 API 的回應", tip: "請確認本機 API 正常運作，並檢查代理是否將請求導向正確的 API。" },
  job_status_unavailable: {
    label: "暫時無法取得翻譯進度",
    description: "後端工作可能仍在執行，畫面會繼續嘗試取得進度。",
    tip: "請先確認本機 API 與連線狀態，暫時不需要重新送出翻譯。",
    retryable: false
  },
  network_error: {
    label: "無法取得工作狀態",
    tip: "請確認本機 API 與連線狀態，再重新開啟這筆工作查看結果。"
  },
  invalid_request: { label: "輸入資料不符合要求", tip: "請確認網址與翻譯選項，再重新送出。", retryable: false },
  job_not_found: { label: "找不到這筆翻譯工作", tip: "請重新整理文章紀錄，或重新建立翻譯工作。", retryable: false },
  document_not_found: { label: "找不到這篇文章", tip: "文章可能已被刪除，請重新整理文章紀錄。", retryable: false },
  invalid_stored_document: { label: "儲存的文章資料無法讀取", tip: "請重新翻譯這篇文章；若持續發生，請檢查本機資料庫。" },
  profile_busy: { label: "本機登入環境正在使用中", tip: "請先完成並關閉登入視窗，或等待使用此環境的工作結束，再試一次。" },
  login_not_open: { label: "目前沒有開啟登入視窗", tip: "請先開啟登入視窗，再完成登入。", retryable: false },
  profile_storage_invalid: { label: "無法使用本機登入資料夾", tip: "請檢查瀏覽器環境的資料夾與存取權限。", retryable: false },
  unsupported_content_type: { label: "網址回傳的內容不是網頁文章", tip: "目前只支援 HTML 網頁，請改貼文章頁網址。", retryable: false },
  source_timeout: { label: "等待文章網站回應逾時", tip: "請確認原文網站能正常開啟，稍後再試。" },
  source_network_error: { label: "無法連線到文章網站", tip: "請檢查文章網址、網路與原文網站的運作狀態，再試一次。" },
  login_required: {
    label: "目標網頁需要登入",
    tip: "此頁面受付費牆或會員登入權限保護，請在設定中開啟『本機登入環境』完成登入後重試。",
    retryable: false
  },
  reauth_required: {
    label: "需要完成或更新網站登入",
    tip: "請在設定中開啟登入視窗，確認已登入文章網站；完成後選擇『本機登入環境』再試。",
    retryable: false
  },
  rate_limited: {
    label: "請求頻率過高 (HTTP 429)",
    tip: "文章網站暫時限制請求頻率，請稍候再試；實際等待時間以網站的限制為準。"
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
    tip: "僅支援公開的 HTTP / HTTPS 網址，請確認網址格式是否正確。",
    retryable: false
  },
  source_too_large: {
    label: "網頁原始碼過大",
    tip: "網頁大小超出系統單次擷取上限，請改用較小的文章頁。",
    retryable: false
  },
  browser_unavailable: {
    label: "Chromium 瀏覽器驅動未就緒",
    tip: "請查看技術資訊中的瀏覽器啟動原因。若尚未安裝 Chromium，請在終端機執行 pnpm browser:install；若已安裝，請檢查執行路徑與系統環境。",
    retryable: false
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
    tip: "文章超出本程式 MAX_TRANSLATION_CHARACTERS 設定的上限，目前不會自動分段。請調整上限並確認模型容量足夠後重啟 API，或改用較短的文章。",
    retryable: false
  },
  unexpected_error: {
    label: "系統非預期錯誤",
    tip: "目前沒有足夠資訊確認原因。可查看技術資訊；若重試仍失敗，請檢查本機 API 紀錄。"
  }
};

export function formatErrorDetail(errorCode?: string | null, error?: string | null) {
  const mapping = errorCode ? ERROR_MAPPINGS[errorCode] : undefined;
  const label = mapping?.label ?? "無法完成這次處理";
  const tip = mapping?.tip ?? "請查看技術資訊，確認服務與設定後再試。";
  const detail = error && error !== errorCode && error !== label ? error : undefined;
  return { label, description: mapping?.description, tip, detail, retryable: mapping?.retryable !== false };
}
