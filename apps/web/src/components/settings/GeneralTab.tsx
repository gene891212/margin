import { ChevronDown, Columns2, Laptop, Rows3, Smartphone } from "lucide-react";
import { LANGUAGE_OPTIONS } from "../../constants";
import type { BrowserMode, ReaderLayout } from "../../types";
import { SettingLabel, SettingsCard } from "./SettingsCard";

type GeneralTabProps = {
  targetLanguage: string;
  onTargetLanguageChange: (value: string) => void;
  showOriginal: boolean;
  onShowOriginalChange: (value: boolean) => void;
  readerLayout: ReaderLayout;
  onReaderLayoutChange: (layout: ReaderLayout) => void;
  browserMode: BrowserMode;
  onBrowserModeChange: (mode: BrowserMode) => void;
};

const BROWSER_MODE_OPTIONS = [
  { mode: "desktop", Icon: Laptop, title: "桌面版 (Desktop)", description: "適合標準新聞、部落格與長篇文章" },
  { mode: "mobile", Icon: Smartphone, title: "行動版 (Mobile)", description: "精簡廣告與複雜側欄干擾" }
] as const;

export function GeneralTab({
  targetLanguage,
  onTargetLanguageChange,
  showOriginal,
  onShowOriginalChange,
  readerLayout,
  onReaderLayoutChange,
  browserMode,
  onBrowserModeChange
}: GeneralTabProps) {
  return (
    <>
      {/* Card 1: Language */}
      <SettingsCard className="space-y-4">
        <div className="flex items-center justify-between">
          <SettingLabel title="全域目標語言" description="新增翻譯任務時的預設目標語言" />
          <div className="relative">
            <select
              value={targetLanguage}
              onChange={(e) => onTargetLanguageChange(e.target.value)}
              className="appearance-none px-3.5 pr-8 py-1.5 text-xs rounded-lg border border-[#ded8cb] bg-[#fbf9f4] text-[#1a1d18] font-medium focus:outline-none focus:border-[#c2411e] cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 w-3.5 h-3.5 text-[#888c83]" strokeWidth={1.5} />
          </div>
        </div>

        <div className="pt-3 border-t border-[#ded8cb]/60 flex items-center justify-between">
          <SettingLabel title="預設顯示雙語對照" description="在翻譯文字下方同步並列呈現原文段落" />
          <button
            type="button"
            onClick={() => onShowOriginalChange(!showOriginal)}
            className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
              showOriginal ? "bg-[#c2411e]" : "bg-[#ded8cb]"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                showOriginal ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="pt-3 border-t border-[#ded8cb]/60 flex items-center justify-between">
          <SettingLabel title="雙語對照排版版型" description="閱讀文章時的預設雙語排列方式" />
          <div className="flex items-center p-0.5 rounded-lg border border-[#ded8cb] bg-[#fbf9f4]">
            <button
              type="button"
              onClick={() => onReaderLayoutChange("stacked")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                readerLayout === "stacked"
                  ? "bg-white text-[#1a1d18] shadow-2xs font-semibold"
                  : "text-[#73786e] hover:text-[#1a1d18]"
              }`}
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span>上下對照</span>
            </button>
            <button
              type="button"
              onClick={() => onReaderLayoutChange("side-by-side")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                readerLayout === "side-by-side"
                  ? "bg-white text-[#1a1d18] shadow-2xs font-semibold"
                  : "text-[#73786e] hover:text-[#1a1d18]"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>左右雙欄</span>
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* Card 2: Viewport Mode */}
      <SettingsCard className="space-y-3">
        <SettingLabel title="瀏覽器渲染視窗模擬" description="決定文章爬蟲載入網頁時模擬的 Viewport 與 User-Agent" />

        <div className="grid grid-cols-2 gap-3 pt-1">
          {BROWSER_MODE_OPTIONS.map(({ mode, Icon, title, description }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onBrowserModeChange(mode)}
              className={`p-3 rounded-lg border flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                browserMode === mode
                  ? "border-[#c2411e] bg-[#fbf8f2]"
                  : "border-[#ded8cb] hover:bg-[#fbf9f4]"
              }`}
            >
              <Icon className={`w-4 h-4 ${browserMode === mode ? "text-[#c2411e]" : "text-[#73786e]"}`} />
              <div>
                <div className="text-xs font-semibold text-[#1a1d18]">{title}</div>
                <div className="text-[10px] text-[#73786e]">{description}</div>
              </div>
            </button>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}
