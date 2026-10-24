import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { Sidebar } from "./components/Sidebar";
import { ArticleLibrary } from "./components/home/ArticleLibrary";
import { HomeView } from "./components/home/HomeView";
import { TranslateConsole } from "./components/home/TranslateConsole";
import { ArticleReader } from "./components/reader/ArticleReader";
import { EditMetadataModal } from "./components/reader/EditMetadataModal";
import { BrowserTab } from "./components/settings/BrowserTab";
import { EngineTab } from "./components/settings/EngineTab";
import { GeneralTab } from "./components/settings/GeneralTab";
import { SettingsModal } from "./components/settings/SettingsModal";
import { StorageTab } from "./components/settings/StorageTab";
import { useAssetStorage } from "./hooks/useAssetStorage";
import { useBrowserProfile } from "./hooks/useBrowserProfile";
import { useRecentJobs } from "./hooks/useRecentJobs";
import { useTranslationJob } from "./hooks/useTranslationJob";
import { errorMessage } from "./lib/api";
import type { BrowserMode, ReaderLayout, RecentJob, SettingsTab } from "./types";

export function App() {
  // Translation preferences
  const [url, setUrl] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("zh-TW");
  const [browserMode, setBrowserMode] = useState<BrowserMode>("desktop");
  const [showOriginal, setShowOriginal] = useState(true);
  const [readerLayout, setReaderLayout] = useState<ReaderLayout>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("wct_reader_layout");
      if (saved === "side-by-side" || saved === "stacked") return saved;
    }
    return "stacked";
  });

  function handleSetReaderLayout(layout: ReaderLayout) {
    setReaderLayout(layout);
    try {
      localStorage.setItem("wct_reader_layout", layout);
    } catch {
      // ignore
    }
  }

  // Layout
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("wct_sidebar_open");
      if (saved !== null) return saved === "true";
      return window.innerWidth >= 1024;
    }
    return true;
  });

  function handleSetSidebarOpen(open: boolean) {
    setSidebarOpen(open);
    try {
      localStorage.setItem("wct_sidebar_open", String(open));
    } catch {
      // ignore
    }
  }

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditMetadata, setShowEditMetadata] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const urlInputRef = useRef<HTMLInputElement>(null);

  const recent = useRecentJobs();
  const translation = useTranslationJob(recent.refreshJobs);
  const browserProfile = useBrowserProfile();
  const assets = useAssetStorage();

  const recentTags = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const job of recent.recentJobs) {
      if (job.tags) {
        for (const tag of job.tags) {
          const trimmed = tag.trim();
          if (trimmed && !seen.has(trimmed.toLowerCase())) {
            seen.add(trimmed.toLowerCase());
            list.push(trimmed);
          }
        }
      }
    }
    return list;
  }, [recent.recentJobs]);

  const { refreshAssetStats } = assets;
  const { refreshProfile } = browserProfile;
  useEffect(() => {
    if (showSettingsModal) {
      void refreshAssetStats();
      void refreshProfile().catch(() => undefined);
    }
  }, [showSettingsModal, refreshAssetStats, refreshProfile]);

  function handleSubmit() {
    void translation.submit({
      url,
      targetLanguage,
      browserMode,
      useBrowserProfile: browserProfile.useProfile,
      imageStorageMode: assets.imageStorageMode
    });
  }

  async function openRecentJob(job: RecentJob) {
    try {
      setUrl(job.sourceUrl);
      if (job.targetLanguage) {
        setTargetLanguage(job.targetLanguage);
      }
      if (typeof job.useBrowserProfile === "boolean") {
        browserProfile.setUseProfile(job.useBrowserProfile);
      }
      if (job.options?.browserMode) {
        setBrowserMode(job.options.browserMode);
      }
      if (await translation.openJob(job)) {
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
          setSidebarOpen(false);
        }
      }
    } catch (reason) {
      recent.setRecentError(errorMessage(reason, "無法開啟文章"));
    }
  }

  async function handleRetryJob(targetJobId?: string) {
    const id = targetJobId ?? translation.jobId;
    if (!id) return;
    try {
      const targetJob = recent.recentJobs.find((j) => j.id === id);
      if (targetJob) {
        setUrl(targetJob.sourceUrl);
      }
      await translation.retryJob(id, {
        targetLanguage,
        useBrowserProfile: browserProfile.useProfile,
        browserMode,
        imageStorageMode: assets.imageStorageMode
      });
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    } catch (reason) {
      recent.setRecentError(errorMessage(reason, "重試失敗"));
    }
  }

  async function handleDeleteJob(jobId: string) {
    try {
      const deletedJob = recent.recentJobs.find((j) => j.id === jobId);
      await recent.deleteJob(jobId);
      const currentDoc = new URLSearchParams(window.location.search).get("document");
      const isCurrentJob =
        translation.jobId === jobId ||
        translation.selectedJobId === jobId ||
        (deletedJob?.documentId && deletedJob.documentId === currentDoc);
      if (isCurrentJob) {
        handleNewTranslation();
      }
    } catch (reason) {
      recent.setRecentError(errorMessage(reason, "無法刪除文章紀錄"));
    }
  }

  function handleNewTranslation() {
    translation.reset();
    setUrl("");
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    setTimeout(() => {
      urlInputRef.current?.focus();
    }, 50);
  }

  function openSettings(tab?: SettingsTab) {
    if (tab) setSettingsTab(tab);
    setShowSettingsModal(true);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showSettingsModal) {
        setShowSettingsModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSettingsModal]);

  const { article } = translation;
  const currentDocParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("document") : null;
  const activeDocId =
    currentDocParam ??
    recent.recentJobs.find((j) => article && j.sourceUrl === article.sourceUrl)?.documentId;
  const currentJobId =
    translation.selectedJobId ??
    translation.jobId ??
    recent.recentJobs.find(
      (j) =>
        (currentDocParam && j.documentId === currentDocParam) ||
        (article && j.sourceUrl === article.sourceUrl)
    )?.id;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f6f3eb] text-[#1a1d18]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => handleSetSidebarOpen(false)}
        onNewTranslation={handleNewTranslation}
        jobs={recent.recentJobs}
        recentError={recent.recentError}
        onRefreshJobs={() => void recent.refreshJobs()}
        onOpenJob={(job) => void openRecentJob(job)}
        onRetryJob={(jobId) => void handleRetryJob(jobId)}
        onDeleteJob={(jobId) => void handleDeleteJob(jobId)}
        activeJobId={translation.jobId}
        status={translation.status}
        selectedJobId={translation.selectedJobId}
        article={article}
        imageStorageMode={assets.imageStorageMode}
        profileStatus={browserProfile.profile?.status}
        onOpenSettings={() => openSettings()}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f6f3eb]">
        <AppHeader
          article={article}
          showOriginal={showOriginal}
          onShowOriginalChange={setShowOriginal}
          readerLayout={readerLayout}
          onReaderLayoutChange={handleSetReaderLayout}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => handleSetSidebarOpen(true)}
          onNewTranslation={handleNewTranslation}
          onRetryTranslation={currentJobId ? () => void handleRetryJob(currentJobId) : undefined}
          onEditMetadata={activeDocId ? () => setShowEditMetadata(true) : undefined}
          onDeleteArticle={currentJobId ? () => void handleDeleteJob(currentJobId) : undefined}
        />

        {/* Workspace Canvas (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-12 lg:py-12 flex flex-col">
          {!article ? (
            <HomeView
              library={
                <ArticleLibrary
                  jobs={recent.recentJobs}
                  onOpenJob={openRecentJob}
                  onDeleteJob={recent.deleteJob}
                />
              }
            >
              <TranslateConsole
                url={url}
                onUrlChange={setUrl}
                urlInputRef={urlInputRef}
                onSubmit={handleSubmit}
                status={translation.status}
                jobId={translation.jobId}
                error={translation.error}
                errorCode={translation.errorCode}
                onRetry={() => translation.jobId ? void handleRetryJob() : handleSubmit()}
                targetLanguage={targetLanguage}
                onTargetLanguageChange={setTargetLanguage}
                browserMode={browserMode}
                onBrowserModeChange={setBrowserMode}
                useBrowserProfile={browserProfile.useProfile}
                onUseBrowserProfileChange={browserProfile.setUseProfile}
                profileStatus={browserProfile.profile?.status}
                onOpenBrowserSettings={() => openSettings("browser")}
              />
            </HomeView>
          ) : (
            <ArticleReader
              article={article}
              showOriginal={showOriginal}
              layout={readerLayout}
              recentTags={recentTags}
              onNewTranslation={handleNewTranslation}
              onRetry={currentJobId ? () => void handleRetryJob(currentJobId) : undefined}
              onUpdateMetadata={
                activeDocId
                  ? async (metadata) => {
                      await translation.updateMetadata(activeDocId, metadata);
                    }
                  : undefined
              }
              onEditMetadata={activeDocId ? () => setShowEditMetadata(true) : undefined}
            />
          )}
        </div>
      </main>

      {/* Edit Category & Tags Modal */}
      {showEditMetadata && activeDocId && article && (
        <EditMetadataModal
          initialCategory={article.category}
          initialTags={article.tags}
          recentTags={recentTags}
          onSave={async (metadata) => {
            await translation.updateMetadata(activeDocId, metadata);
          }}
          onClose={() => setShowEditMetadata(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          tab={settingsTab}
          onTabChange={setSettingsTab}
          onClose={() => setShowSettingsModal(false)}
          imageStorageMode={assets.imageStorageMode}
          profileStatus={browserProfile.profile?.status}
        >
          {settingsTab === "general" && (
            <GeneralTab
              targetLanguage={targetLanguage}
              onTargetLanguageChange={setTargetLanguage}
              showOriginal={showOriginal}
              onShowOriginalChange={setShowOriginal}
              readerLayout={readerLayout}
              onReaderLayoutChange={handleSetReaderLayout}
              browserMode={browserMode}
              onBrowserModeChange={setBrowserMode}
            />
          )}
          {settingsTab === "storage" && (
            <StorageTab
              imageStorageMode={assets.imageStorageMode}
              onImageStorageModeChange={assets.setImageStorageMode}
              assetStats={assets.assetStats}
              isLoadingStats={assets.isLoadingStats}
              isClearingCache={assets.isClearingCache}
              onRefreshStats={() => void assets.refreshAssetStats()}
              onClearCache={() => void assets.clearAssetCache()}
            />
          )}
          {settingsTab === "browser" && (
            <BrowserTab
              profile={browserProfile.profile}
              isLoginOpen={browserProfile.isLoginOpen}
              profileError={browserProfile.profileError}
              loginUrl={browserProfile.loginUrl}
              onLoginUrlChange={browserProfile.setLoginUrl}
              fallbackUrl={url}
              onOpenLogin={() => void browserProfile.openLogin(url, browserMode)}
              onCompleteLogin={() => void browserProfile.completeLogin()}
              onResetProfile={() => void browserProfile.resetProfile()}
            />
          )}
          {settingsTab === "engine" && <EngineTab />}
        </SettingsModal>
      )}
    </div>
  );
}
