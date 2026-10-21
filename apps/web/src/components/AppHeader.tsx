import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Columns2,
  Copy,
  ExternalLink,
  MoreHorizontal,
  PanelLeftOpen,
  RefreshCw,
  Rows3,
  Tag,
  Trash2
} from "lucide-react";
import type { Article, ReaderLayout } from "../types";

type AppHeaderProps = {
  article?: Article;
  showOriginal: boolean;
  onShowOriginalChange: (value: boolean) => void;
  readerLayout: ReaderLayout;
  onReaderLayoutChange: (layout: ReaderLayout) => void;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  onNewTranslation: () => void;
  onRetryTranslation?: () => void;
  onEditMetadata?: () => void;
  onDeleteArticle?: () => void;
};

export function AppHeader({
  article,
  showOriginal,
  onShowOriginalChange,
  readerLayout,
  onReaderLayoutChange,
  sidebarOpen,
  onOpenSidebar,
  onNewTranslation,
  onRetryTranslation,
  onEditMetadata,
  onDeleteArticle
}: AppHeaderProps) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreMenuOpen]);

  async function handleCopyLink() {
    if (!article?.sourceUrl) return;
    try {
      await navigator.clipboard.writeText(article.sourceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  const menuButton = !sidebarOpen ? (
    <button
      onClick={onOpenSidebar}
      className="p-1.5 -ml-1 rounded-md text-[#73786e] hover:text-[#1a1d18] hover:bg-[#eee8de] transition-colors cursor-pointer"
      title="展開側邊欄"
    >
      <PanelLeftOpen className="w-4 h-4" strokeWidth={1.5} />
    </button>
  ) : null;

  return (
    <header className="h-14 border-b border-[#ded8cb] bg-[#f6f3eb]/90 backdrop-blur-md z-20 shrink-0 px-4 lg:px-6 flex items-center justify-between">
      {article ? (
        <>
          {/* Left: Back + Article Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {menuButton}
            <button
              onClick={onNewTranslation}
              className="p-1.5 rounded-md text-[#73786e] hover:text-[#1a1d18] hover:bg-[#eee8de] transition-colors cursor-pointer shrink-0"
              title="返回工作台"
              aria-label="返回工作台"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
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

            {showOriginal && (
              <div className="flex items-center p-0.5 rounded-lg border border-[#ded8cb] bg-[#efebe2]/60">
                <button
                  type="button"
                  onClick={() => onReaderLayoutChange("stacked")}
                  className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    readerLayout === "stacked"
                      ? "bg-white text-[#1a1d18] shadow-2xs font-semibold"
                      : "text-[#73786e] hover:text-[#1a1d18]"
                  }`}
                  title="上下對照排版"
                >
                  <Rows3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span className="hidden sm:inline text-[11px]">上下</span>
                </button>
                <button
                  type="button"
                  onClick={() => onReaderLayoutChange("side-by-side")}
                  className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    readerLayout === "side-by-side"
                      ? "bg-white text-[#1a1d18] shadow-2xs font-semibold"
                      : "text-[#73786e] hover:text-[#1a1d18]"
                  }`}
                  title="左右對照排版 (寬螢幕雙欄)"
                >
                  <Columns2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span className="hidden sm:inline text-[11px]">左右</span>
                </button>
              </div>
            )}

            {/* More Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  moreMenuOpen
                    ? "bg-[#efebe2] text-[#1a1d18]"
                    : "text-[#73786e] hover:text-[#1a1d18] hover:bg-[#eee8de]"
                }`}
                title="更多操作"
                aria-label="更多操作"
                aria-expanded={moreMenuOpen}
              >
                <MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />
              </button>

              {moreMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#fdfcf8] border border-[#ded8cb] rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {/* Group 1: 文章操作 */}
                  <div className="px-3 pt-1 pb-1 text-[11px] font-semibold text-[#8a8e84]">
                    文章操作
                  </div>

                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMoreMenuOpen(false)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#1a1d18] hover:bg-[#efebe2] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 text-[#73786e]" strokeWidth={1.75} />
                      <span>開啟原始網站</span>
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-[#8a8e84]" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyLink();
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#73786e]" strokeWidth={1.75} />
                      )}
                      <span>{copied ? "已複製連結！" : "複製文章連結"}</span>
                    </span>
                  </button>

                  {onRetryTranslation && (
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onRetryTranslation();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer text-left"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-[#73786e]" strokeWidth={1.75} />
                      <span>重新翻譯</span>
                    </button>
                  )}

                  {/* Group 2: 管理 */}
                  {(onEditMetadata || onDeleteArticle) && (
                    <>
                      <div className="my-1 border-t border-[#ded8cb]" />
                      <div className="px-3 pt-1 pb-1 text-[11px] font-semibold text-[#8a8e84]">
                        管理
                      </div>

                      {onEditMetadata && (
                        <button
                          type="button"
                          onClick={() => {
                            setMoreMenuOpen(false);
                            onEditMetadata();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer text-left"
                        >
                          <Tag className="w-3.5 h-3.5 text-[#73786e]" strokeWidth={1.75} />
                          <span>編輯分類與標籤</span>
                        </button>
                      )}

                      {onDeleteArticle && (
                        <>
                          <div className="my-1 border-t border-[#ded8cb]" />
                          <button
                            type="button"
                            onClick={() => {
                              setMoreMenuOpen(false);
                              if (window.confirm("確定要刪除這篇文章紀錄嗎？此動作無法復原。")) {
                                onDeleteArticle();
                              }
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#c2411e] hover:bg-rose-50 transition-colors cursor-pointer text-left font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#c2411e]" strokeWidth={1.75} />
                            <span>刪除文章</span>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Home Header */
        <div className="flex items-center gap-2">
          {menuButton}
          <span className="text-sm font-semibold text-[#1a1d18]">新文章翻譯</span>
        </div>
      )}
    </header>
  );
}
