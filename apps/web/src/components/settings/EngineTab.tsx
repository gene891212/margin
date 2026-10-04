import { SettingsCard } from "./SettingsCard";

const SYSTEM_SPECS = [
  { label: "本機資料庫", value: "SQLite (Drizzle ORM)" },
  { label: "網頁爬取引擎", value: "Playwright (Chromium)" },
  { label: "文章抽取與辨識", value: "Mozilla Readability" },
  { label: "後端伺服器", value: "Fastify v5 (Node.js)" }
];

export function EngineTab() {
  return (
    <>
      {/* Card 1: AI Provider */}
      <SettingsCard className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-[#1a1d18]">AI 轉譯模型服務</div>
          <span className="text-[11px] bg-[#3b6d36]/10 text-[#3b6d36] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b6d36]" />
            運作正常
          </span>
        </div>
        <div className="p-3 rounded-lg bg-[#faf8f5] border border-[#ded8cb]/60 font-mono text-xs text-[#1a1d18]">
          OpenAI gpt-4o-mini
        </div>
        <ul className="text-[11px] text-[#73786e] space-y-1.5 list-disc pl-4 pt-1">
          <li>全篇語境感知（Full Document Context）：翻譯時傳遞文章大綱與前後段落，確保專有名詞與語氣連貫</li>
          <li>排版結構忠實保留：標題級別（H1-H4）、列表編號、代碼區塊與表格結構</li>
          <li>雙語對照映射：行內樣式（粗體、斜體、超連結）保留原始節點對應關係</li>
        </ul>
      </SettingsCard>

      {/* Card 2: System Specs */}
      <SettingsCard className="space-y-3">
        <div className="text-xs font-bold text-[#1a1d18]">系統架構與規格</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {SYSTEM_SPECS.map((spec) => (
            <div key={spec.label} className="p-2.5 rounded-lg bg-[#faf8f5] border border-[#ded8cb]/60">
              <div className="text-[10px] text-[#73786e]">{spec.label}</div>
              <div className="font-mono text-xs text-[#1a1d18] mt-0.5">{spec.value}</div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}
