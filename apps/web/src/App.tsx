import { type FormEvent, useEffect, useState, useRef } from "react";
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Globe,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  ShieldCheck,
  ChevronRight,
  Sliders,
  Menu,
  X,
  Trash2,
  FileText,
  CornerDownLeft,
  Laptop,
  Smartphone,
  Search,
  Check,
  ChevronDown,
  MoreHorizontal,
  Settings,
  HardDrive,
  Sparkles,
  Database
} from "lucide-react";

type InlineNode =
  | { type: "text"; text: string }
  | { type: "break" }
  | { type: "link" | "strong" | "emphasis" | "inline-code"; id: string; href?: string; children: InlineNode[] };

type InlineContainer = { inline: InlineNode[]; translatedInline?: InlineNode[] };
type DocumentNode = InlineContainer & {
  id: string;
  type: "heading" | "paragraph" | "blockquote" | "list" | "image" | "code" | "table" | "divider";
  level?: number;
  ordered?: boolean;
  items?: InlineContainer[];
  rows?: InlineContainer[][];
  src?: string;
  alt?: string;
  code?: string;
};
type Article = {
  title: string;
  translatedTitle?: string;
  byline?: string | null;
  siteName?: string | null;
  sourceUrl: string;
  translationProvider?: string | null;
  nodes: DocumentNode[];
};
type JobStatus = "idle" | "queued" | "fetching" | "extracting" | "translating" | "completed" | "failed";
type RecentJob = {
  id: string;
  sourceUrl: string;
  status: Exclude<JobStatus, "idle">;
  error: string | null;
  documentId: string | null;
  title: string | null;
  translatedTitle: string | null;
  provider: string | null;
  createdAt: string;
};
type BrowserProfile = {
  status: "new" | "ready" | "reauth_required";
  busy: boolean;
  createdAt?: string;
  lastUsedAt?: string | null;
};

const statusLabels: Record<Exclude<JobStatus, "idle">, string> = {
  queued: "排隊準備中",
  fetching: "載入網頁",
  extracting: "辨識正文",
  translating: "翻譯整篇文章",
  completed: "翻譯完成",
  failed: "處理失敗"
};

const pipelineSteps: Exclude<JobStatus, "idle" | "failed">[] = [
  "queued",
  "fetching",
  "extracting",
  "translating",
  "completed"
];

function InlineView({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "text") return <span key={index}>{node.text}</span>;
        if (node.type === "break") return <br key={index} />;
        const content = <InlineView nodes={node.children} />;
        if (node.type === "link")
          return (
            <a
              key={node.id}
              href={node.href}
              target="_blank"
              rel="noreferrer"
              className="text-[#c2411e] underline decoration-[#c2411e]/40 underline-offset-2 hover:decoration-[#c2411e]"
            >
              {content}
            </a>
          );
        if (node.type === "strong") return <strong key={node.id} className="font-bold text-[#111410]">{content}</strong>;
        if (node.type === "emphasis") return <em key={node.id}>{content}</em>;
        return (
          <code key={node.id} className="bg-[#ede8dd] px-1.5 py-0.5 rounded text-[0.88em] font-mono text-[#8f2d13]">
            {content}
          </code>
        );
      })}
    </>
  );
}

function Bilingual({ content, showOriginal }: { content: InlineContainer; showOriginal: boolean }) {
  return (
    <>
      <InlineView nodes={content.translatedInline ?? content.inline} />
      {showOriginal && content.translatedInline && (
        <span className="source-text">
          <InlineView nodes={content.inline} />
        </span>
      )}
    </>
  );
}

function getProxiedImageUrl(src?: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("/")) return src;
  return `/v1/image-proxy?url=${encodeURIComponent(src)}`;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function ArticleNode({ node, showOriginal }: { node: DocumentNode; showOriginal: boolean }) {
  if (node.type === "image")
    return node.src ? (
      <figure className="my-8 flex flex-col items-center">
        <a
          href={node.src}
          target="_blank"
          rel="noreferrer"
          className="block max-w-full group cursor-zoom-in"
          title="點擊查看完整原圖"
        >
          <img
            src={getProxiedImageUrl(node.src)}
            alt={node.alt ?? ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="rounded-lg max-w-full h-auto mx-auto object-contain border border-[#ded8cb] shadow-xs group-hover:shadow-md transition-shadow"
            onError={(e) => {
              if (node.src && e.currentTarget.src !== node.src) {
                e.currentTarget.src = node.src;
              }
            }}
          />
        </a>
        {node.alt && (
          <figcaption className="text-xs text-[#70756b] mt-2.5 text-center font-sans max-w-xl">
            {node.alt}
          </figcaption>
        )}
      </figure>
    ) : null;
  if (node.type === "divider") return <hr className="my-8 border-t border-[#ded8cb]" />;
  if (node.type === "code")
    return (
      <pre>
        <code>{node.code}</code>
      </pre>
    );
  if (node.type === "list") {
    const List = node.ordered ? "ol" : "ul";
    return (
      <List className={`pl-6 space-y-2 mb-6 ${node.ordered ? "list-decimal" : "list-disc"}`}>
        {node.items?.map((item, index) => (
          <li key={index}>
            <Bilingual content={item} showOriginal={showOriginal} />
          </li>
        ))}
      </List>
    );
  }
  if (node.type === "table")
    return (
      <div className="overflow-x-auto my-6 border border-[#ded8cb] rounded-lg bg-[#fbf9f4]">
        <table>
          <tbody>
            {node.rows?.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>
                    <Bilingual content={cell} showOriginal={showOriginal} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  const content = <Bilingual content={node} showOriginal={showOriginal} />;
  if (node.type === "heading") {
    const Heading = `h${Math.min(Math.max(node.level ?? 2, 2), 4)}` as "h2" | "h3" | "h4";
    return <Heading>{content}</Heading>;
  }
  if (node.type === "blockquote") return <blockquote>{content}</blockquote>;
  return <p>{content}</p>;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options?.body ? { "content-type": "application/json" } : {}), ...options?.headers }
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `HTTP ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export function App() {
  const [url, setUrl] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("zh-TW");
  const [browserMode, setBrowserMode] = useState<"desktop" | "mobile">("desktop");
  const [useBrowserProfile, setUseBrowserProfile] = useState(false);
  const [profile, setProfile] = useState<BrowserProfile | null>(null);
  const [loginUrl, setLoginUrl] = useState("");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string>();
  const [article, setArticle] = useState<Article>();
  const [error, setError] = useState<string>();
  const [profileError, setProfileError] = useState<string>();
  const [showOriginal, setShowOriginal] = useState(true);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [recentError, setRecentError] = useState<string>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "storage" | "browser" | "engine">("general");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [imageStorageMode, setImageStorageMode] = useState<"local" | "proxy">(() => {
    const saved = localStorage.getItem("wct_image_storage_mode");
    return saved === "proxy" ? "proxy" : "local";
  });
  const [assetStats, setAssetStats] = useState<{ count: number; totalBytes: number } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>();

  const urlInputRef = useRef<HTMLInputElement>(null);

  function handleImageStorageModeChange(mode: "local" | "proxy") {
    setImageStorageMode(mode);
    localStorage.setItem("wct_image_storage_mode", mode);
  }

  async function refreshAssetStats() {
    setIsLoadingStats(true);
    try {
      const stats = await api<{ count: number; totalBytes: number }>("/v1/assets/stats");
      setAssetStats(stats);
    } catch {
      // ignore
    } finally {
      setIsLoadingStats(false);
    }
  }

  async function handleClearAssetCache() {
    if (!window.confirm("確定清空所有已下載至本地的圖片資產快取嗎？\n（已翻譯文章的圖片在重新瀏覽時將透過線上代理動態載入）")) return;
    setIsClearingCache(true);
    try {
      await api("/v1/assets", { method: "DELETE" });
      await refreshAssetStats();
    } catch (e) {
      alert("清空快取失敗：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsClearingCache(false);
    }
  }

  async function refreshProfile() {
    const result = await api<{ profile: BrowserProfile }>("/v1/browser-profile");
    setProfile(result.profile);
    setIsLoginOpen(result.profile.busy);
  }

  async function refreshJobs() {
    const result = await api<{ jobs: RecentJob[] }>("/v1/translation-jobs");
    setRecentJobs(result.jobs);
    setRecentError(undefined);
  }

  async function loadDocument(id: string, isActive: () => boolean = () => true) {
    const result = await api<{ document: Article }>(`/v1/documents/${id}`);
    if (!isActive()) return;
    setArticle(result.document);
    setStatus("completed");
    window.history.replaceState({}, "", `?document=${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    void refreshProfile().catch(() => undefined);
    void refreshJobs().catch(() => setRecentError("目前無法載入文章紀錄"));
    void refreshAssetStats().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (showSettingsModal) {
      void refreshAssetStats();
      void refreshProfile();
    }
  }, [showSettingsModal]);

  useEffect(() => {
    const selectedDocument = new URLSearchParams(window.location.search).get("document");
    if (!selectedDocument) return;
    void loadDocument(selectedDocument).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!jobId || ["completed", "failed"].includes(status)) return;
    let active = true;
    let inFlight = false;
    const timer = window.setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const job = await api<{ status: JobStatus; error?: string; documentId?: string }>(`/v1/translation-jobs/${jobId}`);
        if (!active) return;
        if (job.status === "completed") {
          await refreshJobs().catch(() => undefined);
          if (!active) return;
          setStatus("completed");
          if (job.documentId) {
            await loadDocument(job.documentId);
          }
        } else if (job.status === "failed") {
          setStatus("failed");
          setError(job.error ?? "無法處理這個頁面");
          void refreshJobs().catch(() => undefined);
        } else {
          setStatus(job.status);
        }
      } catch (reason) {
        if (!active) return;
        setStatus("failed");
        setError(reason instanceof Error ? reason.message : "無法取得工作狀態");
      } finally {
        inFlight = false;
      }
    }, 1200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId, status]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setError(undefined);
    setArticle(undefined);
    setStatus("queued");
    try {
      const job = await api<{ jobId: string }>("/v1/translation-jobs", {
        method: "POST",
        body: JSON.stringify({
          source: { type: "url", url },
          targetLanguage,
          browserMode,
          useBrowserProfile,
          imageStorageMode
        })
      });
      setJobId(job.jobId);
      setSelectedJobId(job.jobId);
      void refreshJobs().catch(() => undefined);
    } catch (reason) {
      setStatus("failed");
      setError(reason instanceof Error ? reason.message : "無法建立工作");
    }
  }

  async function openRecentJob(job: RecentJob) {
    setError(undefined);
    setSelectedJobId(job.id);
    if (job.documentId) {
      try {
        await loadDocument(job.documentId);
        setSidebarOpen(false);
      } catch (reason) {
        setRecentError(reason instanceof Error ? reason.message : "無法開啟文章");
      }
      return;
    }
    if (job.status !== "failed") {
      setJobId(job.id);
      setStatus(job.status);
      setArticle(undefined);
      setSidebarOpen(false);
    }
  }

  async function openLogin() {
    setProfileError(undefined);
    try {
      const candidate = loginUrl || url;
      if (!candidate) throw new Error("請先輸入登入網址或文章網址");
      await api("/v1/browser-profile/open-login", {
        method: "POST",
        body: JSON.stringify({ loginUrl: candidate, browserMode })
      });
      setIsLoginOpen(true);
      await refreshProfile();
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "無法開啟登入瀏覽器");
    }
  }

  async function completeLogin() {
    setProfileError(undefined);
    try {
      await api("/v1/browser-profile/complete-login", { method: "POST" });
      setIsLoginOpen(false);
      setUseBrowserProfile(true);
      await refreshProfile();
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "無法完成登入");
    }
  }

  async function resetProfile() {
    if (!window.confirm("確定清除本機登入環境與所有網站的登入資料（Cookies）嗎？")) return;
    setProfileError(undefined);
    try {
      await api("/v1/browser-profile", { method: "DELETE" });
      setUseBrowserProfile(false);
      setIsLoginOpen(false);
      await refreshProfile();
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "無法重置登入環境");
    }
  }

  function handleNewTranslation() {
    setArticle(undefined);
    setJobId(undefined);
    setSelectedJobId(undefined);
    setStatus("idle");
    setUrl("");
    setError(undefined);
    window.history.replaceState({}, "", window.location.pathname);
    setSidebarOpen(false);
    setTimeout(() => {
      urlInputRef.current?.focus();
    }, 50);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "n" || e.key.toLowerCase() === "k")) {
        e.preventDefault();
        handleNewTranslation();
      } else if (e.key === "Escape" && showSettingsModal) {
        setShowSettingsModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSettingsModal]);

  const filteredJobs = recentJobs.filter((j) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      (j.translatedTitle && j.translatedTitle.toLowerCase().includes(query)) ||
      (j.title && j.title.toLowerCase().includes(query)) ||
      j.sourceUrl.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f6f3eb] text-[#1a1d18]">
      {/* ============================================================ */}
      {/* 1. LEFT SIDEBAR (Linear / Claude Dashboard Style)            */}
      {/* ============================================================ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 lg:w-72 flex flex-col border-r border-[#ded8cb] bg-[#faf8f5] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand Masthead (Claude Style) */}
        <div className="px-4 py-3.5 flex items-center justify-between">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNewTranslation();
            }}
            className="flex items-baseline gap-1 group"
          >
            <span
              className="text-xl font-bold tracking-tight text-[#1a1d18]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Margin<span className="text-[#c2411e]">.</span>
            </span>
          </a>

          <div className="flex items-center gap-1">
            <button
              onClick={handleNewTranslation}
              className="p-1.5 rounded-md text-[#73786e] hover:text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer"
              title="新文章翻譯 (⌘N)"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-md text-[#73786e] hover:text-[#1a1d18] hover:bg-[#efebe2]"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Primary Action Button (Claude "+ New" Row) */}
        <div className="px-3 pb-2">
          <button
            onClick={handleNewTranslation}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-medium">
              <Plus className="w-4 h-4 text-[#73786e]" strokeWidth={2} />
              <span>新文章翻譯</span>
            </div>
            <kbd className="text-[10px] font-mono text-[#8a8e84] px-1.5 py-0.5 rounded bg-[#eee8de]/70 border border-[#ded8cb]/60">
              ⌘N
            </kbd>
          </button>
        </div>

        {/* Search Bar for Past Jobs (Discreet) */}
        <div className="px-3 py-1">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#8a8e84]" strokeWidth={1.5} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="搜尋歷史紀錄..."
              className="w-full pl-8 pr-6 py-1.5 text-xs bg-[#efece4]/70 hover:bg-[#efece4] focus:bg-white placeholder-[#8a8e84] text-[#1a1d18] rounded-md border border-transparent focus:border-[#ded8cb] focus:outline-none transition-colors"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter("")}
                className="absolute right-2 text-xs text-[#8a8e84] hover:text-[#1a1d18]"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Recent Jobs Feed (Scrollable, Flat Claude List Style) */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="flex items-center justify-between px-2 pt-2 pb-1.5">
            <span className="text-xs text-[#8a8e84] font-medium">
              近期文章
            </span>
            <button
              onClick={() => void refreshJobs()}
              title="重新整理紀錄"
              className="text-[#8a8e84] hover:text-[#1a1d18] p-1 rounded transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>

          {recentError && (
            <div className="p-2 text-xs text-[#a42f20] bg-rose-50 border border-rose-200 rounded-md mb-2">
              {recentError}
            </div>
          )}

          {filteredJobs.length === 0 && !recentError ? (
            <div className="px-3 py-8 text-center text-xs text-[#8a8e84]">
              {searchFilter ? "找不到符合的文章" : "尚無文章紀錄"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredJobs.map((job) => {
                const isActiveJob = job.id === jobId && ["queued", "fetching", "extracting", "translating"].includes(status);
                const isSelected =
                  job.id === selectedJobId ||
                  (Boolean(article) && (
                    (job.documentId && job.documentId === new URLSearchParams(window.location.search).get("document")) ||
                    (job.sourceUrl && article?.sourceUrl && job.sourceUrl === article.sourceUrl)
                  ));

                const titleText = job.translatedTitle ?? job.title ?? job.sourceUrl;

                return (
                  <button
                    key={job.id}
                    onClick={() => void openRecentJob(job)}
                    disabled={job.status === "failed"}
                    title={titleText}
                    className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[13px] transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#e5e0d4] text-[#1a1d18] font-medium"
                        : "text-[#4a4e46] hover:bg-[#efebe2] hover:text-[#1a1d18]"
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">
                      {titleText}
                    </span>

                    <span className="shrink-0 flex items-center gap-1.5 text-xs">
                      {isActiveJob ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c2411e] animate-ping" />
                      ) : isSelected ? (
                        <MoreHorizontal className="w-3.5 h-3.5 text-[#73786e] opacity-70 group-hover:opacity-100" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer: Settings Button (Claude Style) */}
        <div className="p-2 border-t border-[#ded8cb]/80 bg-[#faf8f5]">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-[#efebe2] text-xs text-[#54584f] hover:text-[#1a1d18] transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-[#73786e] group-hover:rotate-45 transition-transform duration-300" strokeWidth={1.5} />
              <span className="font-medium">系統設定</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="bg-[#eee9df] text-[#54584f] px-1.5 py-0.5 rounded font-mono">
                {imageStorageMode === "local" ? "本地儲存" : "即時代理"}
              </span>
              {profile?.status === "ready" && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#3b6d36]" title="付費牆環境已就緒" />
              )}
            </div>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* ============================================================ */}
      {/* 2. RIGHT MAIN WORKSPACE (Focused Reading / Translation Canvas)*/}
      {/* ============================================================ */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f6f3eb]">
        {/* Compact Single-Tier Header (Claude Style) */}
        <header className="h-12 border-b border-[#ded8cb] bg-[#f6f3eb]/90 backdrop-blur-md z-20 shrink-0 px-4 lg:px-6 flex items-center justify-between">
          {article ? (
            <>
              {/* Left: Back + Article Title */}
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-1.5 -ml-1 rounded text-[#73786e] hover:text-[#1a1d18]"
                  title="展開側邊欄"
                >
                  <Menu className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={handleNewTranslation}
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
                    onChange={(e) => setShowOriginal(e.target.checked)}
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
                  onClick={handleNewTranslation}
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
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-1.5 -ml-1 rounded text-[#73786e] hover:text-[#1a1d18]"
                  title="展開側邊欄"
                >
                  <Menu className="w-4 h-4" strokeWidth={1.5} />
                </button>
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

        {/* Workspace Canvas (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-12 lg:py-12">
          {!article ? (
            /* ============================================================ */
            /* VIEW A: TRANSLATION INPUT CONSOLE & DASHBOARD WORKSPACE      */
            /* ============================================================ */
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

              {/* Double-Bezel (Doppelrand) Translation Console */}
              <div className="doppel-shell">
                <form onSubmit={submit} className="doppel-core p-6 sm:p-7 space-y-6">
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
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/article..."
                        disabled={!["idle", "failed", "completed"].includes(status)}
                        className="flex-1 min-w-0 bg-transparent py-2.5 text-sm sm:text-base text-[#1a1d18] placeholder-[#a2a69d] focus:outline-none"
                      />

                      <button
                        type="submit"
                        disabled={!["idle", "failed", "completed"].includes(status) || !url.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#c2411e] hover:bg-[#d94f26] disabled:opacity-40 disabled:hover:bg-[#c2411e] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer shrink-0"
                      >
                        {status !== "idle" && status !== "completed" && status !== "failed" ? (
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
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          className="appearance-none w-full h-[42px] pl-3.5 pr-8 rounded-xl border border-[#ded8cb] bg-[#fbf9f4] text-[#1a1d18] text-xs font-medium focus:border-[#c2411e] focus:outline-none transition-colors cursor-pointer"
                        >
                          <option value="zh-TW">繁體中文 (台灣)</option>
                          <option value="zh-CN">簡體中文</option>
                          <option value="en">English</option>
                          <option value="ja">日本語</option>
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
                        <button
                          type="button"
                          onClick={() => setBrowserMode("desktop")}
                          className={`flex-1 h-full flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                            browserMode === "desktop"
                              ? "bg-[#fffefb] text-[#1a1d18] font-semibold shadow-xs border border-[#ded8cb]"
                              : "text-[#585c54] hover:text-[#1a1d18]"
                          }`}
                        >
                          <Laptop className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span>桌面版</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBrowserMode("mobile")}
                          className={`flex-1 h-full flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                            browserMode === "mobile"
                              ? "bg-[#fffefb] text-[#1a1d18] font-semibold shadow-xs border border-[#ded8cb]"
                              : "text-[#585c54] hover:text-[#1a1d18]"
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span>手機版</span>
                        </button>
                      </div>
                    </div>

                    {/* Browser Profile Selector */}
                    <div className="space-y-1.5">
                      <label className="h-5 flex items-center justify-between text-[11px] font-bold text-[#585c54] uppercase tracking-wider">
                        <span>載入身分</span>
                        {profile?.status !== "ready" && (
                          <button
                            type="button"
                            onClick={() => {
                              setSettingsTab("browser");
                              setShowSettingsModal(true);
                            }}
                            className="text-[#c2411e] hover:underline cursor-pointer"
                          >
                            設定登入環境
                          </button>
                        )}
                      </label>
                      <div className="relative flex items-center">
                        <select
                          value={useBrowserProfile ? "profile" : "guest"}
                          onChange={(e) => setUseBrowserProfile(e.target.value === "profile")}
                          className="appearance-none w-full h-[42px] pl-3.5 pr-8 rounded-xl border border-[#ded8cb] bg-[#fbf9f4] text-[#1a1d18] text-xs font-medium focus:border-[#c2411e] focus:outline-none transition-colors cursor-pointer"
                        >
                          <option value="guest">匿名訪客模式 (預設)</option>
                          <option value="profile" disabled={profile?.status !== "ready"}>
                            本機登入環境 {profile?.status === "ready" ? "(已就緒)" : "(需先登入)"}
                          </option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 w-4 h-4 text-[#888c83]" strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>

                  {/* Active Translation Pipeline Stage Tracker */}
                  {status !== "idle" && (
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
                              {status === "completed"
                                ? "翻譯已完成，自動進入閱讀模式..."
                                : statusLabels[status as Exclude<JobStatus, "idle">]}
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
                              const stepIndex = pipelineSteps.indexOf(stepKey);
                              const currentIndex = pipelineSteps.indexOf(status as any);
                              const isPassed = currentIndex >= stepIndex;
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
                  )}

                  {error && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{error}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* Three Editorial Core Guarantees (Refined Promise Grid) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#ded8cb]">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#888c83] font-bold">
                    PRESERVED STRUCTURE
                  </span>
                  <h3 className="text-base font-bold text-[#1a1d18]" style={{ fontFamily: "var(--font-serif)" }}>
                    完整保留文稿排版
                  </h3>
                  <p className="text-xs text-[#585c54] leading-relaxed">
                    自動辨識正文層級，徹底剃除惱人廣告與側邊干擾，保留表格、代碼區塊與原文圖片參照。
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#888c83] font-bold">
                    BILINGUAL ALIGNMENT
                  </span>
                  <h3 className="text-base font-bold text-[#1a1d18]" style={{ fontFamily: "var(--font-serif)" }}>
                    段落級雙語對照
                  </h3>
                  <p className="text-xs text-[#585c54] leading-relaxed">
                    中英對照並行研讀。對專業術語或譯法存疑時，可即刻展開原文句子，保證理解零偏差。
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#888c83] font-bold">
                    HEADLESS ENGINE
                  </span>
                  <h3 className="text-base font-bold text-[#1a1d18]" style={{ fontFamily: "var(--font-serif)" }}>
                    無畏現代複雜網頁
                  </h3>
                  <p className="text-xs text-[#585c54] leading-relaxed">
                    結合真實 Chromium 瀏覽器驅動與付費牆登入狀態保存，SPA 單頁動態內容與訂閱會員文章皆能順暢解析。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* VIEW B: EDITORIAL LUXURY BILINGUAL READING ROOM              */
            /* ============================================================ */
            <article className="max-w-3xl mx-auto py-6">
              {/* Reading Header */}
              <header className="pb-8 mb-10 border-b border-[#ded8cb]">
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#73786e] mb-4">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#ded8cb] font-semibold text-[#1a1d18] tracking-wide">
                    {article.siteName ?? "原站文章"}
                  </span>
                  {article.byline && <span>作者：{article.byline}</span>}
                  {article.translationProvider === "mock" && (
                    <span className="text-[11px] font-mono text-[#c2411e] bg-[#c2411e]/10 px-2 py-0.5 rounded">
                      Mock 示範翻譯
                    </span>
                  )}
                </div>

                <h1
                  className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[#111410] tracking-tight leading-[1.18]"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {article.translatedTitle ?? article.title}
                </h1>

                {showOriginal && article.translatedTitle && article.title && (
                  <p className="mt-3 text-sm sm:text-base text-[#6b7067] font-normal leading-relaxed" style={{ fontFamily: "var(--font-serif)" }}>
                    {article.title}
                  </p>
                )}

                <div className="mt-6 flex items-center justify-between text-xs text-[#73786e]">
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#c2411e] hover:underline"
                  >
                    <span>原始發佈網址</span>
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </a>

                  <span className="text-[11px] font-mono text-[#888c83]">
                    {article.nodes.length} 個文稿段落節點
                  </span>
                </div>
              </header>

              {/* Main Document Body */}
              <div className="editorial-reader">
                {article.nodes.map((node) => (
                  <ArticleNode key={node.id} node={node} showOriginal={showOriginal} />
                ))}
              </div>

              {/* Reader Bottom Navigation Bar */}
              <div className="mt-16 pt-8 border-t border-[#ded8cb] flex items-center justify-between text-xs text-[#73786e]">
                <button
                  onClick={handleNewTranslation}
                  className="font-semibold text-[#c2411e] hover:text-[#d94f26] flex items-center gap-1.5 cursor-pointer"
                >
                  <span>← 返回工作台翻譯新文章</span>
                </button>

                <a
                  href="#top"
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="hover:text-[#1a1d18] transition-colors"
                >
                  回到文章頂部 ↑
                </a>
              </div>
            </article>
          )}
        </div>
      </main>

      {/* ============================================================ */}
      {/* 3. INTEGRATED SETTINGS MODAL (Claude Two-Column Design)     */}
      {/* ============================================================ */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-xs">
          <div className="w-full max-w-4xl h-[620px] max-h-[90vh] bg-[#faf8f5] rounded-2xl border border-[#ded8cb] shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* ---------------------------------------------------- */}
            {/* LEFT SIDEBAR: Nav + Search (Claude Settings Style) */}
            {/* ---------------------------------------------------- */}
            <aside className="w-full md:w-60 lg:w-64 shrink-0 border-b md:border-b-0 md:border-r border-[#ded8cb] bg-[#f5f2ea]/80 p-3.5 flex flex-col">
              {/* Search Input */}
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#8a8e84]" strokeWidth={1.7} />
                <input
                  type="text"
                  value={settingsSearch}
                  onChange={(e) => setSettingsSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#fbf9f4] hover:bg-white focus:bg-white text-[#1a1d18] placeholder-[#8a8e84] rounded-lg border border-[#ded8cb] focus:border-[#c2411e] focus:outline-none transition-colors"
                />
                {settingsSearch && (
                  <button
                    onClick={() => setSettingsSearch("")}
                    className="absolute right-2 top-1.5 text-xs text-[#8a8e84] hover:text-[#1a1d18] p-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Navigation Categories */}
              <div className="space-y-4 flex-1 overflow-y-auto">
                {/* Category 1: Settings */}
                <div>
                  <div className="px-2 pb-1.5 text-[11px] font-semibold text-[#8a8e84] tracking-wide">
                    Settings
                  </div>
                  <div className="space-y-0.5">
                    {/* General */}
                    {(settingsSearch === "" || "general 一般 偏好 語言 渲染 雙語".includes(settingsSearch.toLowerCase())) && (
                      <button
                        type="button"
                        onClick={() => setSettingsTab("general")}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                          settingsTab === "general"
                            ? "bg-[#fffefb] text-[#1a1d18] font-semibold border border-[#ded8cb] shadow-2xs"
                            : "text-[#54584f] hover:bg-[#eae5da]/70 hover:text-[#1a1d18] border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Settings className={`w-4 h-4 shrink-0 ${settingsTab === "general" ? "text-[#c2411e]" : "text-[#73786e]"}`} strokeWidth={1.6} />
                          <span className="truncate">General</span>
                        </div>
                      </button>
                    )}

                    {/* Storage & Assets */}
                    {(settingsSearch === "" || "storage 圖片 資產 儲存 下載 代理 proxy 快取 cache assets".includes(settingsSearch.toLowerCase())) && (
                      <button
                        type="button"
                        onClick={() => setSettingsTab("storage")}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                          settingsTab === "storage"
                            ? "bg-[#fffefb] text-[#1a1d18] font-semibold border border-[#ded8cb] shadow-2xs"
                            : "text-[#54584f] hover:bg-[#eae5da]/70 hover:text-[#1a1d18] border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <HardDrive className={`w-4 h-4 shrink-0 ${settingsTab === "storage" ? "text-[#c2411e]" : "text-[#73786e]"}`} strokeWidth={1.6} />
                          <span className="truncate">Storage & Assets</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#73786e] shrink-0">
                          {imageStorageMode === "local" ? "本地" : "代理"}
                        </span>
                      </button>
                    )}

                    {/* Paywall & Browser */}
                    {(settingsSearch === "" || "browser 付費牆 瀏覽器 登入 cookie profile chromium 帳號 會員".includes(settingsSearch.toLowerCase())) && (
                      <button
                        type="button"
                        onClick={() => setSettingsTab("browser")}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                          settingsTab === "browser"
                            ? "bg-[#fffefb] text-[#1a1d18] font-semibold border border-[#ded8cb] shadow-2xs"
                            : "text-[#54584f] hover:bg-[#eae5da]/70 hover:text-[#1a1d18] border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ShieldCheck className={`w-4 h-4 shrink-0 ${settingsTab === "browser" ? "text-[#c2411e]" : "text-[#73786e]"}`} strokeWidth={1.6} />
                          <span className="truncate">Paywall & Browser</span>
                        </div>
                        {profile?.status === "ready" ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3b6d36] shrink-0" title="已就緒" />
                        ) : profile?.status === "reauth_required" ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#a42f20] shrink-0" title="需重新登入" />
                        ) : null}
                      </button>
                    )}
                  </div>
                </div>

                {/* Category 2: System */}
                <div>
                  <div className="px-2 pb-1.5 text-[11px] font-semibold text-[#8a8e84] tracking-wide">
                    System
                  </div>
                  <div className="space-y-0.5">
                    {/* AI Engine */}
                    {(settingsSearch === "" || "engine ai 引擎 模型 openai gpt 規格 翻譯".includes(settingsSearch.toLowerCase())) && (
                      <button
                        type="button"
                        onClick={() => setSettingsTab("engine")}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                          settingsTab === "engine"
                            ? "bg-[#fffefb] text-[#1a1d18] font-semibold border border-[#ded8cb] shadow-2xs"
                            : "text-[#54584f] hover:bg-[#eae5da]/70 hover:text-[#1a1d18] border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Sparkles className={`w-4 h-4 shrink-0 ${settingsTab === "engine" ? "text-[#c2411e]" : "text-[#73786e]"}`} strokeWidth={1.6} />
                          <span className="truncate">AI Engine & Specs</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            {/* ---------------------------------------------------- */}
            {/* RIGHT CONTENT PANE: Settings Detail Cards            */}
            {/* ---------------------------------------------------- */}
            <section className="flex-1 flex flex-col overflow-hidden bg-[#faf8f5]">
              {/* Header with Title and Close Button (Top right X) */}
              <div className="px-6 sm:px-8 py-4 border-b border-[#ded8cb]/70 flex items-center justify-between shrink-0 bg-[#faf8f5]">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#1a1d18]" style={{ fontFamily: "var(--font-serif)" }}>
                    {settingsTab === "general" && "General Preferences"}
                    {settingsTab === "storage" && "Image Storage & Assets"}
                    {settingsTab === "browser" && "Paywall & Browser Environment"}
                    {settingsTab === "engine" && "AI Engine & Architecture"}
                  </h3>
                  <p className="text-[11px] text-[#73786e] mt-0.5">
                    {settingsTab === "general" && "全域目標語言、視窗模擬與雙語對照閱讀模式"}
                    {settingsTab === "storage" && "文章圖片下載保存策略、伺服器離線快取管理"}
                    {settingsTab === "browser" && "本機專屬 Chromium 付費會員登入與解鎖狀態管理"}
                    {settingsTab === "engine" && "AI 轉譯模型、上下文連貫度與本機資料庫規格"}
                  </p>
                </div>

                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1.5 rounded-lg text-[#73786e] hover:text-[#1a1d18] hover:bg-[#ded8cb]/40 transition-colors cursor-pointer"
                  title="關閉設定 (Esc)"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-5">
                {/* 1. General Tab */}
                {settingsTab === "general" && (
                  <>
                    {/* Card 1: Language */}
                    <div className="bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#1a1d18]">全域目標語言</div>
                          <div className="text-[11px] text-[#73786e] mt-0.5">
                            新增翻譯任務時的預設目標語言
                          </div>
                        </div>
                        <div className="relative">
                          <select
                            value={targetLanguage}
                            onChange={(e) => setTargetLanguage(e.target.value)}
                            className="appearance-none px-3.5 pr-8 py-1.5 text-xs rounded-lg border border-[#ded8cb] bg-[#fbf9f4] text-[#1a1d18] font-medium focus:outline-none focus:border-[#c2411e] cursor-pointer"
                          >
                            <option value="zh-TW">繁體中文 (台灣)</option>
                            <option value="zh-CN">簡體中文</option>
                            <option value="en">English</option>
                            <option value="ja">日本語</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 w-3.5 h-3.5 text-[#888c83]" strokeWidth={1.5} />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#ded8cb]/60 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#1a1d18]">預設顯示雙語對照</div>
                          <div className="text-[11px] text-[#73786e] mt-0.5">
                            在翻譯文字下方同步並列呈現原文段落
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowOriginal(!showOriginal)}
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
                    </div>

                    {/* Card 2: Viewport Mode */}
                    <div className="bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs space-y-3">
                      <div>
                        <div className="text-xs font-bold text-[#1a1d18]">瀏覽器渲染視窗模擬</div>
                        <div className="text-[11px] text-[#73786e] mt-0.5">
                          決定文章爬蟲載入網頁時模擬的 Viewport 與 User-Agent
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setBrowserMode("desktop")}
                          className={`p-3 rounded-lg border flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                            browserMode === "desktop"
                              ? "border-[#c2411e] bg-[#fbf8f2]"
                              : "border-[#ded8cb] hover:bg-[#fbf9f4]"
                          }`}
                        >
                          <Laptop className={`w-4 h-4 ${browserMode === "desktop" ? "text-[#c2411e]" : "text-[#73786e]"}`} />
                          <div>
                            <div className="text-xs font-semibold text-[#1a1d18]">桌面版 (Desktop)</div>
                            <div className="text-[10px] text-[#73786e]">適合標準新聞、部落格與長篇文章</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBrowserMode("mobile")}
                          className={`p-3 rounded-lg border flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                            browserMode === "mobile"
                              ? "border-[#c2411e] bg-[#fbf8f2]"
                              : "border-[#ded8cb] hover:bg-[#fbf9f4]"
                          }`}
                        >
                          <Smartphone className={`w-4 h-4 ${browserMode === "mobile" ? "text-[#c2411e]" : "text-[#73786e]"}`} />
                          <div>
                            <div className="text-xs font-semibold text-[#1a1d18]">行動版 (Mobile)</div>
                            <div className="text-[10px] text-[#73786e]">精簡廣告與複雜側欄干擾</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 2. Storage Tab */}
                {settingsTab === "storage" && (
                  <>
                    {/* Card 1: Storage Strategy Selection */}
                    <div className="bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs space-y-4">
                      <div>
                        <div className="text-xs font-bold text-[#1a1d18]">圖片儲存策略</div>
                        <div className="text-[11px] text-[#73786e] mt-0.5">
                          決定文章辨識正文時圖片的保存與傳輸方式。切換後將自動應用於後續新任務。
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Local */}
                        <div
                          onClick={() => handleImageStorageModeChange("local")}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                            imageStorageMode === "local"
                              ? "border-[#c2411e] bg-[#fbf8f2] shadow-xs"
                              : "border-[#ded8cb] bg-[#faf8f5] hover:border-[#cbcaa0]"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#1a1d18]">本地下載儲存</span>
                                <span className="text-[10px] bg-[#3b6d36]/10 text-[#3b6d36] font-semibold px-1.5 py-0.5 rounded">
                                  預設 / 推薦
                                </span>
                              </div>
                              {imageStorageMode === "local" && (
                                <Check className="w-4 h-4 text-[#c2411e]" strokeWidth={2.5} />
                              )}
                            </div>
                            <p className="text-[11px] text-[#585c54] leading-relaxed">
                              原圖自動下載並持久化儲存於伺服器目錄（<code className="text-[#8f2d13]">data/assets</code>）。
                            </p>
                            <ul className="text-[10px] text-[#73786e] space-y-1 pt-1 list-disc pl-3.5">
                              <li>避開防盜鏈（403）與跨來源 CORP 封鎖</li>
                              <li>原網頁下線或改版仍可完整離線封存閱讀</li>
                              <li>大幅加快二次開啟時的載入速度</li>
                            </ul>
                          </div>
                        </div>

                        {/* Proxy */}
                        <div
                          onClick={() => handleImageStorageModeChange("proxy")}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                            imageStorageMode === "proxy"
                              ? "border-[#c2411e] bg-[#fbf8f2] shadow-xs"
                              : "border-[#ded8cb] bg-[#faf8f5] hover:border-[#cbcaa0]"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#1a1d18]">即時線上代理</span>
                                <span className="text-[10px] bg-[#73786e]/10 text-[#54584f] font-mono px-1.5 py-0.5 rounded">
                                  節省硬碟
                                </span>
                              </div>
                              {imageStorageMode === "proxy" && (
                                <Check className="w-4 h-4 text-[#c2411e]" strokeWidth={2.5} />
                              )}
                            </div>
                            <p className="text-[11px] text-[#585c54] leading-relaxed">
                              不儲存任何圖片檔案，閱讀時透過伺服器代理即時轉發。
                            </p>
                            <ul className="text-[10px] text-[#73786e] space-y-1 pt-1 list-disc pl-3.5">
                              <li>完全不佔用本機硬碟空間</li>
                              <li>仍可解決瀏覽器 CORP 跨來源安全性封鎖</li>
                              <li>若原站刪除圖片或加強驗證，未來可能失效</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Cache & Directory Management */}
                    <div className="bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#1a1d18]">本機圖片儲存庫狀態</div>
                          <div className="text-[11px] text-[#73786e] mt-0.5">
                            已封存之靜態圖片資源統計
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void refreshAssetStats()}
                          disabled={isLoadingStats}
                          className="text-[11px] text-[#73786e] hover:text-[#1a1d18] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoadingStats ? "animate-spin" : ""}`} strokeWidth={1.5} />
                          <span>重新整理容量</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-[#faf8f5] p-3 rounded-lg border border-[#ded8cb]/60">
                          <div className="text-[10px] text-[#73786e]">已封存圖片數量</div>
                          <div className="text-sm font-bold text-[#1a1d18] mt-0.5">
                            {assetStats ? `${assetStats.count} 張` : "計算中..."}
                          </div>
                        </div>
                        <div className="bg-[#faf8f5] p-3 rounded-lg border border-[#ded8cb]/60">
                          <div className="text-[10px] text-[#73786e]">磁碟佔用空間</div>
                          <div className="text-sm font-bold text-[#1a1d18] mt-0.5">
                            {assetStats ? formatBytes(assetStats.totalBytes) : "計算中..."}
                          </div>
                        </div>
                        <div className="bg-[#faf8f5] p-3 rounded-lg border border-[#ded8cb]/60 col-span-2 sm:col-span-1">
                          <div className="text-[10px] text-[#73786e]">本機目錄</div>
                          <div className="text-xs font-mono text-[#54584f] mt-0.5 truncate">
                            data/assets
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <span className="text-[11px] text-[#73786e]">
                          清空快取不會影響文章文字內容；若清空，文章圖片在瀏覽時將透過線上代理嘗試載入。
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleClearAssetCache()}
                          disabled={isClearingCache || !assetStats || assetStats.count === 0}
                          className="shrink-0 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 bg-rose-50/60 hover:bg-rose-100 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isClearingCache ? "清除中..." : "清空圖片快取"}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 3. Browser Tab */}
                {settingsTab === "browser" && (
                  <>
                    {/* Card 1: Browser Profile Status */}
                    <div className="bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#1a1d18]">本機 Chromium 登入環境</div>
                          <div className="text-[11px] text-[#73786e] mt-0.5">
                            狀態：
                            {profile?.status === "ready" ? (
                              <span className="text-[#3b6d36] font-semibold">可使用 (已授權)</span>
                            ) : profile?.status === "reauth_required" ? (
                              <span className="text-[#a42f20] font-semibold">需要重新登入</span>
                            ) : (
                              <span className="text-[#c2411e] font-medium">尚未登入</span>
                            )}
                            {profile?.lastUsedAt && ` · 上次使用：${new Date(profile.lastUsedAt).toLocaleDateString()}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isLoginOpen ? (
                            <button
                              type="button"
                              onClick={() => void completeLogin()}
                              className="px-3.5 py-1.5 rounded-lg bg-[#3b6d36] hover:bg-[#2f572b] text-white text-xs font-semibold cursor-pointer shadow-xs"
                            >
                              完成登入
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={profile?.busy}
                              onClick={() => void openLogin()}
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
                    </div>

                    {/* Card 2: Login URL Input */}
                    <div className="bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs space-y-2">
                      <label className="text-xs font-bold text-[#1a1d18]">
                        登入目標網址 (留空時使用當前輸入的文章網址)
                      </label>
                      <input
                        type="url"
                        value={loginUrl}
                        onChange={(e) => setLoginUrl(e.target.value)}
                        placeholder={url || "https://example.com/login"}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#ded8cb] bg-[#fbf9f4] focus:outline-none focus:border-[#c2411e]"
                      />
                    </div>

                    {/* Card 3: Reset */}
                    <div className="bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#1a1d18]">清除環境與憑證</div>
                        <div className="text-[11px] text-[#73786e] mt-0.5">
                          重設 Chromium 本機使用者目錄，清除所有已保存的 Cookies 與 Session
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void resetProfile()}
                        className="px-3 py-1.5 text-xs text-[#a42f20] hover:text-[#7f2418] hover:bg-rose-50 rounded-lg border border-rose-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>清除環境</span>
                      </button>
                    </div>
                  </>
                )}

                {/* 4. Engine Tab */}
                {settingsTab === "engine" && (
                  <>
                    {/* Card 1: AI Provider */}
                    <div className="bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs space-y-3">
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
                    </div>

                    {/* Card 2: System Specs */}
                    <div className="bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs space-y-3">
                      <div className="text-xs font-bold text-[#1a1d18]">系統架構與規格</div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 rounded-lg bg-[#faf8f5] border border-[#ded8cb]/60">
                          <div className="text-[10px] text-[#73786e]">本機資料庫</div>
                          <div className="font-mono text-xs text-[#1a1d18] mt-0.5">SQLite (Drizzle ORM)</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#faf8f5] border border-[#ded8cb]/60">
                          <div className="text-[10px] text-[#73786e]">網頁爬取引擎</div>
                          <div className="font-mono text-xs text-[#1a1d18] mt-0.5">Playwright (Chromium)</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#faf8f5] border border-[#ded8cb]/60">
                          <div className="text-[10px] text-[#73786e]">文章抽取與辨識</div>
                          <div className="font-mono text-xs text-[#1a1d18] mt-0.5">Mozilla Readability</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#faf8f5] border border-[#ded8cb]/60">
                          <div className="text-[10px] text-[#73786e]">後端伺服器</div>
                          <div className="font-mono text-xs text-[#1a1d18] mt-0.5">Fastify v5 (Node.js)</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
