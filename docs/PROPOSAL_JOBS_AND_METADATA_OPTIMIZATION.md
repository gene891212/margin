# Margin 功能提案：文章列表查詢優化、標題編輯與重試資料保留機制

本提案針對 Margin 目前在文章檢索、文稿標題編輯，以及重新翻譯時的元資料（Metadata）保留機制提出架構分析與具體實作規劃。

---

## 一、問題背景與現況分析

### 1. GET `/v1/translation-jobs` 數量限制與檢索斷層
* **現況**：前端 `ArticleLibrary.tsx` 已設計了完整的分類過濾、標籤多選與關鍵字搜尋（比對原文標題、譯文標題、網域網址），但目前是在前端記憶體（In-memory）對 `recentJobs` 陣列進行篩選。
* **痛點**：後端 API (`apps/api/src/routes/jobs.ts`) 在查詢時寫死 `.limit(30)`。當使用者翻譯超過 30 篇文章後：
  1. 第 31 篇之後的歷史文章將從首頁庫與側邊欄中永久隱藏。
  2. 前端搜尋永遠檢索不到被 limit 截斷的舊文檔，嚴重損害個人知識庫的保存與查閱價值。

### 2. 文稿標題（`translatedTitle`）無法手動修改
* **現況**：AI 模型產出的譯文標題偶爾會生硬、直譯，或夾帶原網頁的 SEO 綴字（例如「...｜Yahoo 奇摩新聞」或網站版權聲明）。
* **痛點**：目前 `PATCH /v1/documents/:id` 僅支援更新 `category` 與 `tags`。使用者若想修正標題以方便典藏或閱讀，無法透過 API 或介面進行修改。

### 3. `/retry` 重新翻譯導致自訂資料遺失（Data Loss）
* **現況**：在 `POST /v1/translation-jobs/:id/retry` 觸發時，後端會將舊有 `documents` 與相關資源刪除，並將 job 重新推入 `queued` 佇列。隨後 Worker (`process-job.ts`) 重新抓取並翻譯後，會再次呼叫 `provider.classify()` 或覆寫文檔。
* **痛點**：使用者先前精心手動設定的分類（Category）、標籤（Tags），甚至自訂標題，會在點擊「重新翻譯此文章」後被全部洗掉覆蓋，造成使用者努力的資料遺失。

---

## 二、技術方案設計

### 1. GET `/v1/translation-jobs` 支援查詢與彈性數量

#### API 規格調整
支援可選的 Query Parameters：
* `q` 或 `search`（可選）：字串，模糊比對 `documents.title`、`documents.translated_title` 或 `translation_jobs.source_url`。
* `category`（可選）：字串，精確篩選主分類。
* `tag`（可選）：字串，篩選包含該標籤之文檔。
* `limit`（可選，預設 50 或 100，最大 200）：單次取得數量；若傳入 `limit=0` 或 `all=true` 則允許單機版一次拉取全部。
* `offset`（可選，預設 0）：支援分頁位移。

#### 資料庫查詢邏輯
* `packages/db/src/schema.ts` 中的 `documents` 原先已具備 `documents_category_idx` 索引。
* 使用 Drizzle ORM 的 `and(...)`、`like(...)` 或 `ilike(...)` 組合動態條件，兼顧本機 SQLite 查詢效能。

---

### 2. PATCH `/v1/documents/:id` 支援修改 `translatedTitle`

#### 資料結構與 Schema 擴展
* 在 `packages/core/src/index.ts` 中擴充 `updateDocumentMetadataSchema`：
  ```typescript
  export const updateDocumentMetadataSchema = z.object({
    category: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    translatedTitle: z.string().trim().min(1).optional()
  });
  ```

#### API 與資料庫同步更新
* `documents` 資料表本已擁有 `translated_title: text("translated_title")` 欄位。
* 當接收到 `translatedTitle` 時：
  1. 更新 `documents.translatedTitle` 欄位。
  2. 同步更新 `documents.documentAst.translatedTitle`，確保 Document AST JSON 物件與獨立欄位保持一致。

#### 前端 Web UI
* 在 `apps/web/src/components/reader/EditMetadataModal.tsx` 增加「譯文標題（自訂標題）」輸入框，提供使用者隨時微調標題並儲存。

---

### 3. `/retry` 重新翻譯時保留使用者既有分類與標籤

#### 設計理念與機制延續
* 在先前的架構中，`/retry` 就已經將 `existingDocumentId: doc.id` 存入 `job.options`，以保證重新翻譯後 Document ID 不變、網址保持穩定。
* 此機制應全面延伸至使用者自訂之元資料：
  ```typescript
  // 在 POST /v1/translation-jobs/:id/retry 時讀取舊文檔資料
  const doc = input.db.select({
    id: documents.id,
    category: documents.category,
    tags: documents.tags,
    translatedTitle: documents.translatedTitle
  }).from(documents).where(eq(documents.jobId, job.id)).get();

  const updatedOptions = {
    ...currentOptions,
    ...(doc?.id ? {
      existingDocumentId: doc.id,
      preservedCategory: doc.category,
      preservedTags: parseTags(doc.tags),
      preservedTranslatedTitle: doc.translatedTitle
    } : {}),
    // ...
  };
  ```

#### Worker (`process-job.ts`) 流程調整
* 當 Job 重試執行時，Worker 檢查 `job.options` 是否含有 `preservedCategory` 或 `preservedTags`：
  1. 若有保留值，則跳過 AI 的 `provider.classify()`，直接套用使用者先前設定的分類與標籤。
  2. 若有保留之 `preservedTranslatedTitle`，且使用者有自訂需求，可優先保留或作為選項提供。
  3. 若為全新工作（無保留值），維持現有 AI 自動分類行為。

---

## 三、效益評估與改動範圍

| 改動項目 | 影響模組 | 風險等級 | 預期效益 |
| :--- | :--- | :---: | :--- |
| **GET jobs 支援查詢與解除 30 筆上限** | `apps/api` (routes/jobs.ts)<br>`apps/web` (hooks/useRecentJobs.ts) | 🟢 低 | 歷史文章不遺失，大幅改善長久閱讀歸檔體驗。 |
| **PATCH documents 支援 translatedTitle** | `packages/core`<br>`apps/api`<br>`apps/web` (EditMetadataModal) | 🟢 低 | 使用者可隨意修正機器翻譯之生硬標題或去除垃圾綴字。 |
| **Retry 保留 category、tags 與標題** | `apps/api` (routes/jobs.ts)<br>`apps/api` (worker/process-job.ts) | 🟢 極低 | 徹底防範重新翻譯時手動資料遭洗掉（Data Loss）的嚴重體驗問題。 |

---

## 四、實作與驗證步驟規劃

1. **Core 套件更新**：更新 `updateDocumentMetadataSchema`。
2. **API 路由更新**：
   - 擴充 `POST /v1/translation-jobs/:id/retry` 的 options 保留邏輯。
   - 擴充 `PATCH /v1/documents/:id` 的標題更新與 AST 同步邏輯。
   - 擴充 `GET /v1/translation-jobs` 支援 query params 與彈性 limit。
3. **Worker 邏輯更新**：在 `processJob` 中優先採用 preserved metadata。
4. **前端介面調整**：
   - `EditMetadataModal.tsx` 新增標題輸入框與表單處理。
   - 測試確認標題、標籤與分類在保存後立即反應於閱讀器與文章庫。
5. **自動化測試擴充**：
   - 在 `jobs.test.ts` 新增 PATCH 標題測試案例。
   - 新增 Retry 驗證測試，確保分類與標籤在重新翻譯後完好保存。
