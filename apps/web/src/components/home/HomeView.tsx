import type { ReactNode } from "react";

const GUARANTEES = [
  {
    eyebrow: "PRESERVED STRUCTURE",
    title: "完整保留文稿排版",
    body: "自動辨識正文層級，徹底剃除惱人廣告與側邊干擾，保留表格、代碼區塊與原文圖片參照。"
  },
  {
    eyebrow: "BILINGUAL ALIGNMENT",
    title: "段落級雙語對照",
    body: "中英對照並行研讀。對專業術語或譯法存疑時，可即刻展開原文句子，保證理解零偏差。"
  },
  {
    eyebrow: "HEADLESS ENGINE",
    title: "無畏現代複雜網頁",
    body: "結合真實 Chromium 瀏覽器驅動與付費牆登入狀態保存，SPA 單頁動態內容與訂閱會員文章皆能順暢解析。"
  }
];

/** Landing workspace: editorial hero, the translation console (children), and feature promises. */
export function HomeView({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Editorial Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#eee8de] border border-[#ded7ca] text-[10px] font-mono uppercase tracking-[0.18em] text-[#c2411e] font-bold">
          <span>CONTEXT-AWARE BILINGUAL TRANSLATOR</span>
        </div>
        <h1
          className="text-4xl sm:text-5xl lg:text-[3.5rem] font-normal tracking-tight text-[#1a1d18] leading-[1.05]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          把文章留下，<br />
          <span className="italic">只讓語言改變。</span>
        </h1>
        <p className="text-base sm:text-lg text-[#585c54] max-w-2xl leading-relaxed" style={{ fontFamily: "var(--font-serif)" }}>
          貼上任何外文文章網址。我們辨識正文、保留內容層級與表格代碼，並生成專注沉浸的雙語閱讀版本。
        </p>
      </div>

      {children}

      {/* Three Editorial Core Guarantees (Refined Promise Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#ded8cb]">
        {GUARANTEES.map((item) => (
          <div key={item.eyebrow} className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#888c83] font-bold">
              {item.eyebrow}
            </span>
            <h3 className="text-base font-bold text-[#1a1d18]" style={{ fontFamily: "var(--font-serif)" }}>
              {item.title}
            </h3>
            <p className="text-xs text-[#585c54] leading-relaxed">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
