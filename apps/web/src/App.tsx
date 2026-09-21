import { type FormEvent, useEffect, useState } from "react";

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
  nodes: DocumentNode[];
};
type JobStatus = "idle" | "queued" | "fetching" | "extracting" | "translating" | "completed" | "failed";
type Profile = {
  id: string;
  name: string;
  status: "new" | "ready" | "reauth_required";
  hosts: string[];
  busy: boolean;
};

const statusLabels: Record<Exclude<JobStatus, "idle">, string> = {
  queued: "等待處理", fetching: "載入網頁", extracting: "辨識正文",
  translating: "翻譯整篇文章", completed: "完成", failed: "處理失敗"
};

function InlineView({ nodes }: { nodes: InlineNode[] }) {
  return <>{nodes.map((node, index) => {
    if (node.type === "text") return <span key={index}>{node.text}</span>;
    if (node.type === "break") return <br key={index} />;
    const content = <InlineView nodes={node.children} />;
    if (node.type === "link") return <a key={node.id} href={node.href} target="_blank" rel="noreferrer">{content}</a>;
    if (node.type === "strong") return <strong key={node.id}>{content}</strong>;
    if (node.type === "emphasis") return <em key={node.id}>{content}</em>;
    return <code key={node.id}>{content}</code>;
  })}</>;
}

function Bilingual({ content, showOriginal }: { content: InlineContainer; showOriginal: boolean }) {
  return <>
    <InlineView nodes={content.translatedInline ?? content.inline} />
    {showOriginal && content.translatedInline && <span className="source-text"><InlineView nodes={content.inline} /></span>}
  </>;
}

function ArticleNode({ node, showOriginal }: { node: DocumentNode; showOriginal: boolean }) {
  if (node.type === "image") return node.src
    ? <figure><img src={node.src} alt={node.alt ?? ""} loading="lazy" /></figure> : null;
  if (node.type === "divider") return <hr />;
  if (node.type === "code") return <pre><code>{node.code}</code></pre>;
  if (node.type === "list") {
    const List = node.ordered ? "ol" : "ul";
    return <List>{node.items?.map((item, index) => <li key={index}><Bilingual content={item} showOriginal={showOriginal} /></li>)}</List>;
  }
  if (node.type === "table") return <div className="table-scroll"><table><tbody>
    {node.rows?.map((row, rowIndex) => <tr key={rowIndex}>
      {row.map((cell, cellIndex) => <td key={cellIndex}><Bilingual content={cell} showOriginal={showOriginal} /></td>)}
    </tr>)}
  </tbody></table></div>;
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
    const body = await response.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `HTTP ${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export function App() {
  const [url, setUrl] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("zh-TW");
  const [profileId, setProfileId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [loginOpenId, setLoginOpenId] = useState("");
  const [status, setStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string>();
  const [article, setArticle] = useState<Article>();
  const [error, setError] = useState<string>();
  const [profileError, setProfileError] = useState<string>();
  const [showOriginal, setShowOriginal] = useState(true);

  async function refreshProfiles() {
    const result = await api<{ profiles: Profile[] }>("/v1/browser-profiles");
    setProfiles(result.profiles);
  }

  useEffect(() => { void refreshProfiles().catch(() => undefined); }, []);

  useEffect(() => {
    const selectedDocument = new URLSearchParams(window.location.search).get("document");
    if (!selectedDocument) return;
    void api<{ document: Article }>(`/v1/documents/${selectedDocument}`)
      .then((result) => { setArticle(result.document); setStatus("completed"); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!jobId || ["completed", "failed"].includes(status)) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const job = await api<{ status: JobStatus; error?: string; documentId?: string }>(`/v1/translation-jobs/${jobId}`);
        if (!active) return;
        setStatus(job.status);
        if (job.status === "failed") setError(job.error ?? "無法處理這個頁面");
        if (job.status === "completed" && job.documentId) {
          const result = await api<{ document: Article }>(`/v1/documents/${job.documentId}`);
          if (!active) return;
          setArticle(result.document);
          window.history.replaceState({}, "", `?document=${job.documentId}`);
        }
      } catch (reason) {
        if (!active) return;
        setStatus("failed");
        setError(reason instanceof Error ? reason.message : "無法取得工作狀態");
      }
    }, 1_200);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, status]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setArticle(undefined);
    setStatus("queued");
    try {
      const job = await api<{ jobId: string }>("/v1/translation-jobs", {
        method: "POST",
        body: JSON.stringify({
          source: { type: "url", url },
          targetLanguage,
          ...(profileId ? { browserProfileId: profileId } : {})
        })
      });
      setJobId(job.jobId);
    } catch (reason) {
      setStatus("failed");
      setError(reason instanceof Error ? reason.message : "無法建立工作");
    }
  }

  async function createProfile(event: FormEvent) {
    event.preventDefault();
    setProfileError(undefined);
    try {
      await api<Profile>("/v1/browser-profiles", {
        method: "POST", body: JSON.stringify({ name: newProfileName, loginUrl })
      });
      setNewProfileName("");
      await refreshProfiles();
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "無法建立 Profile");
    }
  }

  async function openLogin(id: string) {
    setProfileError(undefined);
    try {
      const profile = profiles.find((item) => item.id === id);
      const candidate = loginUrl || url;
      const requestedUrl = candidate && profile?.hosts.includes(new URL(candidate).hostname.toLowerCase())
        ? candidate
        : `https://${profile?.hosts[0] ?? ""}`;
      await api(`/v1/browser-profiles/${id}/open-login`, {
        method: "POST", body: JSON.stringify({ loginUrl: requestedUrl })
      });
      setLoginOpenId(id);
      await refreshProfiles();
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "無法開啟登入瀏覽器");
    }
  }

  async function completeLogin(id: string) {
    setProfileError(undefined);
    try {
      await api(`/v1/browser-profiles/${id}/complete-login`, { method: "POST" });
      setLoginOpenId("");
      setProfileId(id);
      await refreshProfiles();
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "無法完成登入");
    }
  }

  async function deleteProfile(id: string) {
    if (!window.confirm("確定永久刪除此 Profile 及其登入資料嗎？")) return;
    setProfileError(undefined);
    try {
      await api(`/v1/browser-profiles/${id}`, { method: "DELETE" });
      if (profileId === id) setProfileId("");
      await refreshProfiles();
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "無法刪除 Profile");
    }
  }

  return <main className={article ? "app reading" : "app"}>
    <header className="masthead">
      <a className="brand" href="/">Margin<span>.</span></a>
      <span className="tagline">保留文章脈絡的網頁翻譯</span>
    </header>

    {!article ? <section className="hero">
      <div className="eyebrow">READ BEYOND LANGUAGE</div>
      <h1>把文章留下，<br />只讓語言改變。</h1>
      <p className="intro">貼上一個文章網址。我們會辨識正文、保留內容層級，並產生舒適的雙語閱讀版本。</p>
      <form onSubmit={submit}>
        <label htmlFor="source-url">文章網址</label>
        <div className="url-input">
          <input id="source-url" type="url" required placeholder="https://example.com/article"
            value={url} onChange={(event) => setUrl(event.target.value)}
            disabled={!['idle', 'failed', 'completed'].includes(status)} />
          <button type="submit" disabled={!['idle', 'failed', 'completed'].includes(status)}>開始翻譯 →</button>
        </div>
        <div className="options-row">
          <label>目標語言
            <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </label>
          <label>載入方式
            <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
              <option value="">匿名模式</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id} disabled={profile.status !== "ready"}>
                {profile.name}{profile.status !== "ready" ? "（需登入）" : ""}
              </option>)}
            </select>
          </label>
        </div>
      </form>
      {status !== "idle" && status !== "failed" && <div className="progress" role="status">
        <span className="progress-dot" />{statusLabels[status]}
      </div>}
      {error && <div className="error" role="alert">{error}</div>}

      <section className="profiles-section" aria-labelledby="profiles-heading">
        <div className="section-heading"><h2 id="profiles-heading">登入瀏覽器</h2><span>每個 Profile 獨立保存登入狀態，直到你手動刪除。</span></div>
        <form className="profile-form" onSubmit={createProfile}>
          <label>Profile 名稱<input required value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} placeholder="例如：工作文章" /></label>
          <label>登入網址<input type="url" required value={loginUrl} onChange={(event) => setLoginUrl(event.target.value)} placeholder="https://example.com/login" /></label>
          <button type="submit">建立 Profile</button>
        </form>
        {profileError && <div className="error" role="alert">{profileError}</div>}
        {profiles.length > 0 && <div className="profile-list">{profiles.map((profile) => <div className="profile-row" key={profile.id}>
          <div><strong>{profile.name}</strong><small>{profile.hosts.join(", ")} · {profile.status === "ready" ? "可使用" : profile.status === "reauth_required" ? "需要重新登入" : "尚未登入"}</small></div>
          <div className="profile-actions">
            {loginOpenId === profile.id
              ? <button type="button" onClick={() => void completeLogin(profile.id)}>完成登入</button>
              : <button type="button" disabled={profile.busy} onClick={() => void openLogin(profile.id)}>開啟登入視窗</button>}
            <button type="button" className="danger-link" onClick={() => void deleteProfile(profile.id)}>刪除</button>
          </div>
        </div>)}</div>}
        {loginOpenId && <p className="help-text">請在彈出的 Chromium 視窗自行登入，完成後回到這裡按「完成登入」。</p>}
      </section>
    </section> : <article className="reader">
      <div className="reader-tools">
        <button className="back" onClick={() => { setJobId(undefined); setArticle(undefined); setStatus("idle"); setUrl(""); window.history.replaceState({}, "", "/"); }}>← 新文章</button>
        <label className="toggle"><input type="checkbox" checked={showOriginal} onChange={(event) => setShowOriginal(event.target.checked)} /><span />顯示原文</label>
      </div>
      <header className="article-header">
        <div className="article-meta">{article.siteName ?? "ARTICLE"}{article.byline ? ` · ${article.byline}` : ""}</div>
        <h1>{article.translatedTitle ?? article.title}</h1>
        {showOriginal && <div className="original-title">{article.title}</div>}
        <a href={article.sourceUrl} target="_blank" rel="noreferrer">查看原始網頁 ↗</a>
      </header>
      <div className="article-body">{article.nodes.map((node) => <ArticleNode key={node.id} node={node} showOriginal={showOriginal} />)}</div>
    </article>}
  </main>;
}
