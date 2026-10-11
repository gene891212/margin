# 多提供者翻譯架構規劃（Multi-Provider Architecture）

本文件記錄 Margin 支援多翻譯模型與提供者（Multi-Provider）的架構設計，分為**「階段一：自用輕量版（OpenAI-Compatible）」**與**「階段二：完整產品化版（Vercel AI SDK + Web UI 設定）」**。

---

## 核心設計理念與現狀

Margin 目前採用 `TranslationProvider` 介面（Adapter / Strategy Pattern），核心要求為**保證段落 ID 與結構 100% 對齊（`assertCompleteTranslation`）**，並保護行內標記（`<x id="...">`、`<br/>`）。

```typescript
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
```

---

## 階段一：自用輕量版（OpenAI-Compatible 統一適配）

### 1. 核心策略
在個人本機使用情境下，優先追求**零新依賴、最小修改、最大通用性**。

利用絕大多數模型提供者對 **OpenAI 相容協議（`/v1/chat/completions`）** 的原生支援：
* **OpenAI**：官方端點 `https://api.openai.com/v1`
* **Ollama**：本機端點 `http://localhost:11434/v1`
* **Google Gemini**：官方 OpenAI 相容端點 `https://generativelanguage.googleapis.com/v1beta/openai`
* **DeepSeek / Groq / OpenRouter**：直接支援 OpenAI 標準協議

### 2. 環境變數配置（`.env`）

```dotenv
# 翻譯提供者設定
TRANSLATION_PROVIDER=openai-compatible

# API 端點（預設為 OpenAI，亦可填入 Ollama 或 Gemini）
# 範例 1 (OpenAI): https://api.openai.com/v1
# 範例 2 (Ollama): http://127.0.0.1:11434/v1
# 範例 3 (Gemini): https://generativelanguage.googleapis.com/v1beta/openai
OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
OPENAI_COMPATIBLE_API_KEY=your-api-key-here
OPENAI_COMPATIBLE_MODEL=gpt-4o-mini
```

### 3. API 協定調整重點
* 將目前 OpenAI 專用的 `/v1/responses` 調整為標準 `/v1/chat/completions`。
* 請求帶入 `response_format: { type: "json_object" }` 或 `json_schema`。
* 提示詞保留原有的防幻覺與 `<x id="...">` 標籤保護指令。

---

## 階段二：完整產品化版（開放他人使用 / 終端用戶）

面向其他開發者或一般使用者時，軟體需消除「手動拼湊 Base URL」與「修改 `.env` 重啟」的摩擦力。

### 1. 架構圖

```
                 [ Web UI 前端 ]
          (設定彈窗 Settings Modal / 模型下拉選單)
                        │
                        ▼ (REST API: /v1/settings, /v1/translation-jobs)
                 [ Margin API 後端 ]
                        │
                        ▼
            [ TranslationProviderFactory ]
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   [ Vercel AI SDK Provider ]    [ DeepL Provider ]
  (ai + @ai-sdk/openai, google)   (原生 XML 標籤保護)
         │
  ┌──────┼──────┐
  ▼      ▼      ▼
OpenAI Gemini Ollama (本地)
```

### 2. 前端設定體驗（UX 設計）

在 Web UI 加入「設定（Settings）」彈窗，支援本機持久化儲存（SQLite 或 Browser Storage）：

1. **Google Gemini**：
   * 欄位：僅需輸入 `Google API Key`。
   * 模型選單：`gemini-1.5-flash`（高性價比）、`gemini-1.5-pro`。
2. **OpenAI**：
   * 欄位：僅需輸入 `OpenAI API Key`。
   * 模型選單：`gpt-4o-mini`、`gpt-4o`。
3. **Ollama（本地離線免費用戶）**：
   * 狀態偵測：自動發送 `GET http://127.0.0.1:11434/api/tags` 檢查是否運行。
   * 模型選單：自動列出使用者本地已安裝的模型（推薦 `qwen2.5:14b` 或 `llama3.1:8b`）。
4. **自訂 / OpenAI 相容（進階用戶）**：
   * 欄位：Base URL、API Key、Model Name。
5. **DeepL（高品質傳統翻譯）**：
   * 欄位：`DeepL Auth Key`（Free / Pro）。

### 3. 技術棧導入：Vercel AI SDK (`ai`)

引進 Vercel AI SDK 簡化模型整合與結構化輸出保證：

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/google ollama-ai-provider
```

#### 優勢：
* **`generateObject` + Zod Schema**：一體化解決 OpenAI Strict JSON、Gemini `responseSchema` 與 Claude Tool Calling 的協議差異。
* **統一錯誤抽象**：將 RateLimit、無效金鑰、連線超時等各家私有錯誤標準化，方便 UI 呈現友善提示。

### 4. 針對本地 Ollama 模型的優化方針

在網頁翻譯與結構化輸出情境下，本地小模型相較雲端大模型較為脆弱，需進行以下防護：

1. **模型推薦**：
   * 首選 **`qwen2.5:7b` / `qwen2.5:14b`**（中英翻譯流暢度與 JSON Schema 遵從率最高）。
   * 次選 **`llama3.1:8b`**。
2. **Context Window（上下文長度）擴增**：
   * 預設 2048/4096 tokens 在長文章容易截斷。
   * 需提醒或透過 Ollama API 設定 `num_ctx >= 16384`。
3. **動態超時控制**：
   * 本地純 CPU 或低階 GPU 運算較慢，針對 Ollama 自動將逾時時間由 60 秒放寬至 180~300 秒。
4. **失敗退避與分段（Chunking Fallback）**：
   * 當本地模型無法一次吐出 50+ 個 segments 時，自動觸發自適應分段（Chunking Strategy）分批送出並合併。

---

## 遷移與實作路徑（Roadmap）

1. **[當前執行]** 實作 OpenAI-Compatible 通用 Provider：
   * 支援 `.env` 配置 `OPENAI_COMPATIBLE_BASE_URL`、`OPENAI_COMPATIBLE_API_KEY`、`OPENAI_COMPATIBLE_MODEL`。
   * 驗證 OpenAI、Gemini（經 OpenAI 相容層）及本機 Ollama 的文章翻譯。
2. **[後續演進]** 資料庫加入 settings 表格，支援於 Web UI 即時修改 Provider 配置。
3. **[後續演進]** 引入 Vercel AI SDK，封裝標準品牌選單與 DeepL Adapter。
