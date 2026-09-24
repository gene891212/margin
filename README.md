# Margin — 本機網頁內容翻譯器

Margin 將文章網址轉成保留結構的雙語閱讀文件。公開頁先以 HTTP 取得；若正文不足，再用 Playwright 渲染。登入頁使用你自行登入的獨立 Chromium Profile，不收集帳號密碼。

目前為本機單人版。第一階段範圍及後續規劃見 [實作計畫](docs/IMPLEMENTATION_PLAN.md)。

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

打開 <http://127.0.0.1:5173>。API 只在 `127.0.0.1:4100` 監聽。SQLite 與瀏覽器資料在專案的 `data/`，不會被 Git 追蹤。無需 Docker。

首頁的「最近文章」會列出工作及已完成文件。翻譯完成後會留在首頁，不會自動開啟閱讀頁；點擊「最近文章」中已完成的文章即可閱讀，也可使用 `http://127.0.0.1:5173/?document=文件 UUID` 直接開啟。使用 Mock 的文章會顯示示範標記，不代表已呼叫 OpenAI。

範例 `.env` 使用 `mock` 翻譯器，讓整條流程不花費 API 額度。要使用真正的 OpenAI 翻譯，將 `.env` 改為：

```dotenv
TRANSLATION_PROVIDER=openai
OPENAI_API_KEY=你的金鑰
OPENAI_MODEL=你帳號可使用且支援結構化輸出的模型名稱
```

重啟 API 後生效。系統一次傳送整篇文章，但每個可翻譯區塊保有穩定 ID；結果缺漏、重複或行內標記被改壞時會失敗，不會顯示不完整譯文。文章超過 `MAX_TRANSLATION_CHARACTERS` 時也會明確失敗，目前不自動分段。

## 使用登入網站

1. 點「建立登入瀏覽器」，建立一份通用 Profile。
2. 輸入登入網址，選擇桌面或手機網站模式，點「開啟登入視窗」。在彈出的 Chromium 親自登入及完成 MFA；可在同一視窗登入其他網站。
3. 回到 Margin 點「完成登入」，系統會關閉視窗並保存登入狀態。
4. 翻譯文章時選擇這份 Profile，並使用該網站登入時的桌面或手機模式。其他網站需要登入時，再開啟同一份 Profile 即可。

同一 Profile 不能同時供兩個瀏覽器工作使用。刪除 Profile 會永久移除它的整個瀏覽器資料夾及其中所有網站的登入狀態。登入頁的原始 HTML 預設不保存。舊版 Profile 可以繼續使用，也可以在介面刪除；新版只允許建立一份 Profile。

## API

```http
POST   /v1/translation-jobs
GET    /v1/translation-jobs
GET    /v1/translation-jobs/{id}
GET    /v1/documents/{id}
GET    /v1/browser-profiles
POST   /v1/browser-profiles
GET    /v1/browser-profiles/{id}
POST   /v1/browser-profiles/{id}/open-login
POST   /v1/browser-profiles/{id}/complete-login
DELETE /v1/browser-profiles/{id}
GET    /health
```

提交匿名文章：

```bash
curl -X POST http://127.0.0.1:4100/v1/translation-jobs \
  -H 'content-type: application/json' \
  -d '{"source":{"type":"url","url":"https://example.com/article"},"targetLanguage":"zh-TW"}'
```

若需要登入，在 JSON 最外層加入 `"browserProfileId":"Profile UUID"`。工作 API 會立即回傳 `jobId`；輪詢工作直到 `completed`，再用 `documentId` 取得 Document AST。若失敗，工作回傳 `errorCode` 與可讀的 `error`。

## 驗證與限制

```bash
pnpm typecheck
pnpm test
pnpm build
```

- 一般網址只接受公開 HTTP(S) 位址；localhost、內網及非標準 port 會被拒絕。
- 不繞過登入、付費牆或反機器人機制；網站可能阻止自動瀏覽器。
- 第一階段不處理「閱讀全文」按鈕、多頁文章、無限滾動、PDF、Webhook 或 Agent。
- 本機 API 僅適合單人使用；不要把 `127.0.0.1` 綁定改為外網位址後直接公開服務。
- 公開頁除錯 snapshot 存在 `data/snapshots/`。若文章含敏感內容，請手動刪除該資料夾；登入頁不建立 snapshot。
