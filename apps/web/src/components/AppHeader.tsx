import { ArrowLeft, ExternalLink, Menu, Plus } from "lucide-react";
import type { Article } from "../types";

type AppHeaderProps = {
  article?: Article;
  showOriginal: boolean;
  onShowOriginalChange: (value: boolean) => void;
  onOpenSidebar: () => void;
  onNewTranslation: () => void;
};

export function AppHeader({ article, showOriginal, onShowOriginalChange, onOpenSidebar, onNewTranslation }: AppHeaderProps) {
  const menuButton = (
    <button
      onClick={onOpenSidebar}
      className="lg:hidden p-1.5 -ml-1 rounded text-[#73786e] hover:text-[#1a1d18]"
      title="展開側邊欄"
    >
      <Menu className="w-4 h-4" strokeWidth={1.5} />
    </button>
  );

  return (
    <header className="h-12 border-b border-[#ded8cb] bg-[#f6f3eb]/90 backdrop-blur-md z-20 shrink-0 px-4 lg:px-6 flex items-center justify-between">
      {article ? (
        <>
          {/* Left: Back + Article Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {menuButton}
            <button
              onClick={onNewTranslation}
              className="flex items-center gap-1 text-xs text-[#73786e] hover:text-[#1a1d18] px-2 py-1 rounded-md hover:bg-[#eee8de] transition-colors cursor-pointer shrink-0"
              title="返回工作台"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
              <span>返回</span>
            </button>
            <div className="h-3.5 w-px bg-[#ded8cb] shrink-0" />
            <h1
              className="text-sm font-semibold text-[#1a1d18] truncate max-w-xs sm:max-w-md lg:max-w-xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {article.translatedTitle ?? article.title}
            </h1>
            {article.siteName && (
              <span className="hidden md:inline text-xs text-[#8a8e84] shrink-0">
                · {article.siteName}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <label className="flex items-center gap-1.5 text-xs text-[#54584f] cursor-pointer select-none px-2.5 py-1 rounded-md hover:bg-[#eee8de] transition-colors">
              <input
                type="checkbox"
                checked={showOriginal}
                onChange={(e) => onShowOriginalChange(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#c2411e] cursor-pointer rounded"
              />
              <span>原文對照</span>
            </label>

            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[#54584f] hover:text-[#1a1d18] px-2.5 py-1 rounded-md hover:bg-[#eee8de] transition-colors"
            >
              <span>原網站</span>
              <ExternalLink className="w-3 h-3 text-[#8a8e84]" strokeWidth={1.5} />
            </a>

            <button
              onClick={onNewTranslation}
              className="flex items-center gap-1 text-xs font-medium text-white bg-[#1a1d18] hover:bg-[#2d322b] px-3 py-1 rounded-md shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#c2411e]" strokeWidth={2} />
              <span>新文章</span>
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Home Header */}
          <div className="flex items-center gap-2">
            {menuButton}
            <span className="text-sm font-semibold text-[#1a1d18]">新文章翻譯</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#73786e]">
            <span className="hidden sm:inline font-mono text-[11px] text-[#8a8e84]">
              按 <kbd className="px-1.5 py-0.5 rounded bg-[#eee8de] border border-[#ded8cb] text-[#585c54] font-mono text-[10px]">⌘N</kbd> 隨時新建翻譯
            </span>
          </div>
        </>
      )}
    </header>
  );
}
