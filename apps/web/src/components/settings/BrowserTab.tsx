import { Trash2 } from "lucide-react";
import type { BrowserProfile } from "../../types";
import { SettingLabel, SettingsCard } from "./SettingsCard";

type BrowserTabProps = {
  profile: BrowserProfile | null;
  isLoginOpen: boolean;
  profileError?: string;
  loginUrl: string;
  onLoginUrlChange: (value: string) => void;
  /** Shown as the login URL placeholder; usually the article URL currently entered. */
  fallbackUrl: string;
  onOpenLogin: () => void;
  onCompleteLogin: () => void;
  onResetProfile: () => void;
};

export function BrowserTab({
  profile,
  isLoginOpen,
  profileError,
  loginUrl,
  onLoginUrlChange,
  fallbackUrl,
  onOpenLogin,
  onCompleteLogin,
  onResetProfile
}: BrowserTabProps) {
  return (
    <>
      {/* Card 1: Browser Profile Status */}
      <SettingsCard className="space-y-4">
        <div className="flex items-center justify-between">
          <SettingLabel
            title="本機 Chromium 登入環境"
            description={
              <>
                狀態：
                {profile?.status === "ready" ? (
                  <span className="text-[#3b6d36] font-semibold">可使用 (已授權)</span>
                ) : profile?.status === "reauth_required" ? (
                  <span className="text-[#a42f20] font-semibold">需要重新登入</span>
                ) : (
                  <span className="text-[#c2411e] font-medium">尚未登入</span>
                )}
                {profile?.lastUsedAt && ` · 上次使用：${new Date(profile.lastUsedAt).toLocaleDateString()}`}
              </>
            }
          />

          <div className="flex items-center gap-2">
            {isLoginOpen ? (
              <button
                type="button"
                onClick={onCompleteLogin}
                className="px-3.5 py-1.5 rounded-lg bg-[#3b6d36] hover:bg-[#2f572b] text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                完成登入
              </button>
            ) : (
              <button
                type="button"
                disabled={profile?.busy}
                onClick={onOpenLogin}
                className="px-3.5 py-1.5 rounded-lg bg-[#1a1d18] hover:bg-[#2d322b] text-white text-xs font-medium disabled:opacity-40 cursor-pointer shadow-xs"
              >
                開啟視窗登入
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-[#585c54] leading-relaxed pt-1">
          在彈出的視窗中登入付費會員或學術期刊網站（如 Bloomberg、Nature、Medium），登入狀態將安全保存在本機，供翻譯時直接載入已解鎖內容。
        </p>

        {isLoginOpen && (
          <p className="text-[11px] text-[#c2411e] leading-relaxed bg-[#c2411e]/10 p-2.5 rounded-lg border border-[#c2411e]/20">
            Chromium 瀏覽器已在背景啟動。請在彈出的視窗中完成登入，完成後點擊上方「完成登入」以保存授權憑證。
          </p>
        )}

        {profileError && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {profileError}
          </div>
        )}
      </SettingsCard>

      {/* Card 2: Login URL Input */}
      <SettingsCard className="space-y-2">
        <label className="text-xs font-bold text-[#1a1d18]">
          登入目標網址 (留空時使用當前輸入的文章網址)
        </label>
        <input
          type="url"
          value={loginUrl}
          onChange={(e) => onLoginUrlChange(e.target.value)}
          placeholder={fallbackUrl || "https://example.com/login"}
          className="w-full px-3 py-2 text-xs rounded-lg border border-[#ded8cb] bg-[#fbf9f4] focus:outline-none focus:border-[#c2411e]"
        />
      </SettingsCard>

      {/* Card 3: Reset */}
      <SettingsCard className="flex items-center justify-between">
        <SettingLabel title="清除環境與憑證" description="重設 Chromium 本機使用者目錄，清除所有已保存的 Cookies 與 Session" />

        <button
          type="button"
          onClick={onResetProfile}
          className="px-3 py-1.5 text-xs text-[#a42f20] hover:text-[#7f2418] hover:bg-rose-50 rounded-lg border border-rose-200 flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>清除環境</span>
        </button>
      </SettingsCard>
    </>
  );
}
