# Margin — 本機網頁內容翻譯器

Margin 是本機單人使用的網頁內容翻譯器，將文章網址轉成保留結構的雙語閱讀文件（支援段落對照、左右並排、純譯文、純原文模式）。公開頁先以 HTTP 取得，若正文不足或為動態容器則自動改用 Playwright 渲染，並支援多頁文章自動翻頁合併；登入頁使用你自行登入的獨立 Chromium Profile，不收集帳號密碼。

## 需求與啟動

- Node.js 22 以上
- pnpm 10 以上
- macOS／Linux／Windows 可執行 Playwright Chromium 的環境；「開啟登入視窗」需桌面圖形環境

```bash
pnpm install
pnpm browser:install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

打開 <http://127.0.0.1:5173>。API 只在 `127.0.0.1:4100` 監聽。SQLite、圖片快取與瀏覽器資料皆存放在專案的 `data/`，不會被 Git 追蹤，無需 Docker。

首頁整合「文章庫」與工作進度追蹤，支援依分類（Category）、標籤（Tags）篩選及關鍵字搜尋，也可在文章列表或閱讀頁直接編輯分類與標籤。點擊已完成的文章即可進入閱讀器，或使用 `http://127.0.0.1:5173/?document=文件UUID` 直接開啟。使用 Mock 的文章會顯示示範標記，不代表已呼叫真實模型。

未填寫 `OPENAI_MODEL` 時預設走免額度的 `mock` 示範模式。只要填寫 `OPENAI_MODEL`，系統會自動切換為真實模型，並支援所有 OpenAI 相容協定（OpenAI、本地 Ollama、Google Gemini 等），無需手動指定 `TRANSLATION_PROVIDER`：

```dotenv
# 1. 使用 OpenAI:
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=你的金鑰
OPENAI_MODEL=gpt-4o-mini

# 2. 或使用本地 Ollama (免金鑰、完全離線):
# OPENAI_BASE_URL=http://127.0.0.1:11434/v1
# OPENAI_MODEL=qwen2.5:14b

# 3. 或使用 Google Gemini (官方相容層):
# OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
# OPENAI_API_KEY=你的Google金鑰
# OPENAI_MODEL=gemini-1.5-flash
```

重啟 API 後生效。系統一次傳送整篇文章（並同時自動歸類文章分類與標籤），每個可翻譯區塊保有穩定 ID；結果缺漏、重複或行內標記被改壞時會失敗，不會顯示不完整譯文，且可隨時於介面點擊重試。文章超過 `MAX_TRANSLATION_CHARACTERS` 時也會明確失敗，目前不自動分段。

## 使用登入網站

1. 點擊「付費牆與瀏覽器環境」，在彈窗中輸入目標網站登入網址，選擇桌面或手機網站模式，點「開啟視窗登入」。在彈出的 Chromium 親自登入及完成 MFA；可在同一視窗登入多個網站。
2. 回到 Margin 點「完成登入」，系統會關閉視窗並保存登入狀態至本機資料夾。
3. 翻譯文章時「載入身分」切換為「本機登入環境」，並使用該網站登入時的桌面或手機模式。其他網站需要登入時，再重複開啟此環境登入即可。

此本機環境一次只供一個瀏覽器工作使用。點擊「清除環境與登入 Cookie」會安全移除整個瀏覽器資料夾及其中所有網站的登入憑證。登入頁的原始 HTML 預設不留存。

## API

```http
POST   /v1/translation-jobs
GET    /v1/translation-jobs
GET    /v1/translation-jobs/{id}
POST   /v1/translation-jobs/{id}/retry
DELETE /v1/translation-jobs/{id}
GET    /v1/documents/{id}
PATCH  /v1/documents/{id}
GET    /v1/browser-profile
POST   /v1/browser-profile/open-login
POST   /v1/browser-profile/complete-login
DELETE /v1/browser-profile
GET    /v1/assets/stats
DELETE /v1/assets
GET    /health
```

提交匿名文章：

```bash
curl -X POST http://127.0.0.1:4100/v1/translation-jobs \
  -H 'content-type: application/json' \
  -d '{"source":{"type":"url","url":"https://example.com/article"},"targetLanguage":"zh-TW"}'
```

若需要使用已登入環境，在 JSON 最外層加入 `"useBrowserProfile": true`。工作 API 會立即回傳 `jobId`；輪詢工作直到 `completed`，再用 `documentId` 取得 Document AST。若失敗，工作回傳 `errorCode` 與可讀的 `error`，也可呼叫 `/v1/translation-jobs/{id}/retry` 重新執行（重試後仍保留原 `documentId`）。

## 驗證與限制

```bash
pnpm typecheck
pnpm test
pnpm build
```

- 一般網址只接受公開 HTTP(S) 位址；localhost、內網及非標準 port 會被拒絕。
- 不繞過登入、付費牆或反機器人機制；網站可能阻止自動瀏覽器。
- 目前不處理無限滾動動態牆、PDF、影片或 Webhook。
- 本機 API 僅適合單人使用；不要把 `127.0.0.1` 綁定改為外網位址後直接公開服務。
- 公開頁除錯 snapshot 存在 `data/snapshots/`。若文章含敏感內容，刪除該筆工作時會一併清理，或可手動刪除該資料夾；登入頁不建立 snapshot。
