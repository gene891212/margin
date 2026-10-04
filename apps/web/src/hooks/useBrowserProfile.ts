import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import type { BrowserMode, BrowserProfile } from "../types";

export function useBrowserProfile() {
  const [profile, setProfile] = useState<BrowserProfile | null>(null);
  /** Whether new translation jobs should load pages with the saved login profile. */
  const [useProfile, setUseProfile] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [profileError, setProfileError] = useState<string>();

  const refreshProfile = useCallback(async () => {
    const result = await api<{ profile: BrowserProfile }>("/v1/browser-profile");
    setProfile(result.profile);
    setIsLoginOpen(result.profile.busy);
  }, []);

  useEffect(() => {
    void refreshProfile().catch(() => undefined);
  }, [refreshProfile]);

  /** Opens a headed Chromium window. Falls back to `fallbackUrl` when no login URL was entered. */
  async function openLogin(fallbackUrl: string, browserMode: BrowserMode) {
    setProfileError(undefined);
    try {
      const candidate = loginUrl || fallbackUrl;
      if (!candidate) throw new Error("請先輸入登入網址或文章網址");
      await api("/v1/browser-profile/open-login", {
        method: "POST",
        body: JSON.stringify({ loginUrl: candidate, browserMode })
      });
      setIsLoginOpen(true);
      await refreshProfile();
    } catch (reason) {
      setProfileError(errorMessage(reason, "無法開啟登入瀏覽器"));
    }
  }

  async function completeLogin() {
    setProfileError(undefined);
    try {
      await api("/v1/browser-profile/complete-login", { method: "POST" });
      setIsLoginOpen(false);
      setUseProfile(true);
      await refreshProfile();
    } catch (reason) {
      setProfileError(errorMessage(reason, "無法完成登入"));
    }
  }

  async function resetProfile() {
    if (!window.confirm("確定清除本機登入環境與所有網站的登入資料（Cookies）嗎？")) return;
    setProfileError(undefined);
    try {
      await api("/v1/browser-profile", { method: "DELETE" });
      setUseProfile(false);
      setIsLoginOpen(false);
      await refreshProfile();
    } catch (reason) {
      setProfileError(errorMessage(reason, "無法重置登入環境"));
    }
  }

  return {
    profile,
    useProfile,
    setUseProfile,
    loginUrl,
    setLoginUrl,
    isLoginOpen,
    profileError,
    refreshProfile,
    openLogin,
    completeLogin,
    resetProfile
  };
}
