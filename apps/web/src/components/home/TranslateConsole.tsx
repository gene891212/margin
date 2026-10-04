import type { FormEvent, Ref } from "react";
import { AlertCircle, ArrowRight, ChevronDown, Globe, Laptop, RefreshCw, Smartphone } from "lucide-react";
import { LANGUAGE_OPTIONS, pipelineSteps, statusLabels } from "../../constants";
import type { BrowserMode, BrowserProfile, JobStatus } from "../../types";

type TranslateConsoleProps = {
  url: string;
  onUrlChange: (value: string) => void;
  urlInputRef: Ref<HTMLInputElement>;
  /** Called on submit when the URL is non-empty. */
  onSubmit: () => void;
  status: JobStatus;
  jobId?: string;
  error?: string;
  targetLanguage: string;
  onTargetLanguageChange: (value: string) => void;
  browserMode: BrowserMode;
  onBrowserModeChange: (mode: BrowserMode) => void;
  useBrowserProfile: boolean;
  onUseBrowserProfileChange: (value: boolean) => void;
  profileStatus?: BrowserProfile["status"];
  onOpenBrowserSettings: () => void;
};

export function TranslateConsole({
  url,
  onUrlChange,
  urlInputRef,
  onSubmit,
  status,
  jobId,
  error,
  targetLanguage,
  onTargetLanguageChange,
  browserMode,
  onBrowserModeChange,
  useBrowserProfile,
  onUseBrowserProfileChange,
  profileStatus,
  onOpenBrowserSettings
}: TranslateConsoleProps) {
  const isIdle = ["idle", "failed", "completed"].includes(status);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    onSubmit();
  }

  return (
    <div className="doppel-shell">
      <form onSubmit={handleSubmit} className="doppel-core p-6 sm:p-7 space-y-6">
        {/* Primary URL Input */}
        <div className="space-y-2">
          <label htmlFor="source-url" className="text-xs font-bold uppercase tracking-wider text-[#585c54] flex items-center justify-between">
            <span>輸入文章網址</span>
            <span className="text-[11px] font-normal text-[#888c83]">支援長篇文章、專題報導、論文與付費牆頁面</span>
          </label>

          <div className="flex items-center gap-3 p-1.5 rounded-xl border border-[#ded8cb] bg-[#fbf9f4] focus-within:border-[#c2411e] focus-within:ring-2 focus-within:ring-[#c2411e]/10 transition-all">
            <div className="pl-3 text-[#888c83]">
              <Globe className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <input
              id="source-url"
              ref={urlInputRef}
              type="url"
              required
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/article..."
              disabled={!isIdle}
              className="flex-1 min-w-0 bg-transparent py-2.5 text-sm sm:text-base text-[#1a1d18] placeholder-[#a2a69d] focus:outline-none"
            />

            <button
              type="submit"
              disabled={!isIdle || !url.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#c2411e] hover:bg-[#d94f26] disabled:opacity-40 disabled:hover:bg-[#c2411e] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer shrink-0"
            >
              {!isIdle ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2} />
                  <span>處理中</span>
                </>
              ) : (
                <>
                  <span>開始翻譯</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Options Bar (Segmented Controls) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#ded8cb]/80 text-xs">
          {/* Target Language */}
          <div className="space-y-1.5">
            <label className="h-5 flex items-center text-[11px] font-bold text-[#585c54] uppercase tracking-wider">
              目標語言
            </label>
            <div className="relative flex items-center">
              <select
                value={targetLanguage}
                onChange={(e) => onTargetLanguageChange(e.target.value)}
                className="appearance-none w-full h-[42px] pl-3.5 pr-8 rounded-xl border border-[#ded8cb] bg-[#fbf9f4] text-[#1a1d18] text-xs font-medium focus:border-[#c2411e] focus:outline-none transition-colors cursor-pointer"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 w-4 h-4 text-[#888c83]" strokeWidth={1.5} />
            </div>
          </div>

          {/* Browser Mode */}
          <div className="space-y-1.5">
            <label className="h-5 flex items-center text-[11px] font-bold text-[#585c54] uppercase tracking-wider">
              載入瀏覽器型態
            </label>
            <div className="w-full h-[42px] p-1 rounded-xl border border-[#ded8cb] bg-[#fbf9f4] flex items-center">
              {(
                [
                  { mode: "desktop", label: "桌面版", Icon: Laptop },
                  { mode: "mobile", label: "手機版", Icon: Smartphone }
                ] as const
              ).map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onBrowserModeChange(mode)}
                  className={`flex-1 h-full flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                    browserMode === mode
                      ? "bg-[#fffefb] text-[#1a1d18] font-semibold shadow-xs border border-[#ded8cb]"
                      : "text-[#585c54] hover:text-[#1a1d18]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Browser Profile Selector */}
          <div className="space-y-1.5">
            <label className="h-5 flex items-center justify-between text-[11px] font-bold text-[#585c54] uppercase tracking-wider">
              <span>載入身分</span>
              {profileStatus !== "ready" && (
                <button
                  type="button"
                  onClick={onOpenBrowserSettings}
                  className="text-[#c2411e] hover:underline cursor-pointer"
                >
                  設定登入環境
                </button>
              )}
            </label>
            <div className="relative flex items-center">
              <select
                value={useBrowserProfile ? "profile" : "guest"}
                onChange={(e) => onUseBrowserProfileChange(e.target.value === "profile")}
                className="appearance-none w-full h-[42px] pl-3.5 pr-8 rounded-xl border border-[#ded8cb] bg-[#fbf9f4] text-[#1a1d18] text-xs font-medium focus:border-[#c2411e] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="guest">匿名訪客模式 (預設)</option>
                <option value="profile" disabled={profileStatus !== "ready"}>
                  本機登入環境 {profileStatus === "ready" ? "(已就緒)" : "(需先登入)"}
                </option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 w-4 h-4 text-[#888c83]" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Active Translation Pipeline Stage Tracker */}
        {status !== "idle" && <PipelineProgress status={status} jobId={jobId} />}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  );
}

function PipelineProgress({ status, jobId }: { status: Exclude<JobStatus, "idle">; jobId?: string }) {
  const currentIndex = pipelineSteps.indexOf(status as (typeof pipelineSteps)[number]);

  return (
    <div className="pt-4 border-t border-[#ded8cb]/80">
      <div className="p-4 rounded-xl bg-[#eee8de]/70 border border-[#ded7ca] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === "completed"
                  ? "bg-[#55824e]"
                  : status === "failed"
                  ? "bg-[#a42f20]"
                  : "bg-[#c2411e] animate-pulse-subtle"
              }`}
            />
            <span className="text-xs font-bold text-[#1a1d18]">
              {status === "completed" ? "翻譯已完成，自動進入閱讀模式..." : statusLabels[status]}
            </span>
          </div>
          {jobId && (
            <span className="text-[10px] font-mono text-[#73786e]">
              JOB #{jobId.slice(0, 8)}
            </span>
          )}
        </div>

        {/* Visual Progress Steps */}
        {status !== "failed" && (
          <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
            {pipelineSteps.slice(0, 4).map((stepKey, idx) => {
              const isPassed = currentIndex >= idx;
              const isCurrent = status === stepKey;

              return (
                <div
                  key={stepKey}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? "bg-[#fffefb] border-[#c2411e] text-[#c2411e] font-bold shadow-xs"
                      : isPassed
                      ? "bg-[#ded8cb]/50 border-transparent text-[#55824e]"
                      : "bg-transparent border-[#ded8cb]/60 text-[#8a8e84]"
                  }`}
                >
                  <span>{idx + 1}. {statusLabels[stepKey]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
