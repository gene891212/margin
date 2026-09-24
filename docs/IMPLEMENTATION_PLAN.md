# Margin 實作規劃

## 產品目標

Margin 是本機單人使用的網頁內容翻譯器。使用者輸入文章網址；系統取得公開或使用者已登入的頁面、辨識正文、保留文章結構、整篇翻譯，再於網頁中雙語閱讀。服務提供 REST API，方便未來接其他平台。

## 第一階段（本次）

- 技術：React、Vite、Fastify、TypeScript、Playwright、Mozilla Readability、Drizzle、SQLite（better-sqlite3）。不需要 Docker、Redis 或 Electron。
- 來源：匿名頁先 HTTP，若正文不足或需要 JavaScript 則以 Playwright 渲染。指定登入 Profile 時直接使用專用 persistent Chromium context。401、429、登入失效及反機器人頁明確失敗，不繞過存取限制。
- 登入：一份通用 Profile 可保存多個網站的登入狀態；使用者在有畫面的 Chromium 自行登入。Profile 一次只供一個瀏覽器工作使用，不接受任意檔案路徑、帳密或 Cookie 輸入。Profile 持續存在至使用者刪除。
- 文件：建立版本化 Document AST，保留標題、段落、清單、圖片、表格、引用、程式碼、連結、粗體、斜體及行內程式碼。原文與翻譯以穩定區塊 ID 對應；行內標記由程式驗證與重建。
- 翻譯：預設 OpenAI Responses API，整篇文章一次請求、結構化回傳。缺少或重複區塊、行內標記不符及文章超長均明確失敗。Mock provider 支援不花費 API 額度的測試。
- 儲存：SQLite 保存工作、取得紀錄、文件、段落、翻譯紀錄、Profile metadata。公開頁 snapshot 可存本機檔案；登入內容預設不留原始 HTML。Profile 資料夾與 DB 分開，均排除版本控制。
- 介面：URL、目標語言、Profile 選擇、Profile 管理、工作狀態與雙語閱讀；REST API 提供同樣的核心能力。API 預設僅在 `127.0.0.1` 監聽。

### 第一階段完成標準

1. 全新環境不用 Docker 可依 README 安裝與啟動。
2. 靜態公開頁、JavaScript 動態頁、已登入頁完成取得→抽取→翻譯→閱讀流程。
3. 通用 Profile 可供多個網站使用、重啟後保留及刪除；同一 Profile 不可同時啟動兩次。
4. Document AST 與閱讀頁維持區塊、連結及行內樣式對應。
5. 工作、文件及譯文重啟後仍可取得。
6. `pnpm typecheck`、`pnpm test`、`pnpm build` 通過；若提供 OpenAI 金鑰，再做一次真實付費翻譯驗收。

## 後續階段

- 第二階段：受控的「閱讀全文」與翻頁偵測、同文章驗證、去重及循環上限。
- 第三階段：長文自適應分段、術語表、翻譯記憶、人工修訂、傳統翻譯 API、Webhook 與匯出。
- 第四階段：只有規則抽取低信心時才接入受限 Agent，用於選擇內容候選或受控操作；不讓 Agent 重寫 HTML 或登入。
- 若改成多人雲端服務，再加入帳號／租戶隔離、遠端互動瀏覽器、加密儲存、queue、PostgreSQL 與物件儲存。

## 明確不在第一階段

自動翻頁、Agent、付費牆或反機器人機制繞過、使用者帳密保存、PDF／影片／社群動態牆、多人服務、分散式 worker、Webhook、傳統翻譯 provider。
