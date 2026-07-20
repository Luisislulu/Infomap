"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type FeedItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceKey: string;
  category: string;
  publishedAt: string;
  rank: number;
  score: number;
  metric?: string;
  summary?: string;
  titleZh?: string;
  summaryZh?: string;
};

export type FeedSource = {
  key: string;
  name: string;
  category: string;
  categoryZh?: string;
  description: string;
  descriptionZh?: string;
  url: string;
  count: number;
  status: "ok" | "stale" | "error";
};

export type FeedData = {
  generatedAt: string;
  issueDate: string;
  issueNumber: string;
  sources: FeedSource[];
  items: FeedItem[];
  topTen: string[];
  errors: string[];
};

type View = "today" | "sources";
type Language = "original" | "zh";
type RefreshStatus = "idle" | "loading" | "success" | "error";
type ThemeName =
  | "signal"
  | "ocean"
  | "ember"
  | "violet"
  | "forest"
  | "rose"
  | "mono"
  | "noir";

const THEMES: { id: ThemeName; label: string }[] = [
  { id: "signal", label: "Signal lime" },
  { id: "ocean", label: "Ocean blue" },
  { id: "ember", label: "Ember orange" },
  { id: "violet", label: "Studio violet" },
  { id: "forest", label: "Forest green" },
  { id: "rose", label: "Editorial rose" },
  { id: "mono", label: "Mono minimal" },
  { id: "noir", label: "Noir black" },
];

const COPY = {
  original: {
    home: "Infomap home",
    primaryNav: "Primary navigation",
    today: "Today",
    sources: "Sources",
    language: "Language",
    original: "Original",
    chinese: "Chinese",
    updateAria: "Scan all sources for the latest information",
    refreshDefault: "Scan every source for the latest signals",
    refreshUnavailable: "This hosted copy needs a refresh service endpoint",
    refreshScanning: "Scanning every source now…",
    refreshFailed: "Refresh failed",
    scanning: "Scanning…",
    updated: "Updated",
    tryAgain: "Try again",
    updateNow: "Update now",
    themeAria: "Choose color theme",
    theme: "Theme",
    useTheme: "Use",
    themeSuffix: "theme",
    daily: "Daily",
    eyebrow: "DAILY AI, TECHNOLOGY & MARKET SIGNALS",
    headlineOne: "What matters,",
    headlineTwo: "without the noise.",
    intro: "A source-aware scan across builders, researchers, analysts, institutions, and the technology press. Updated once every day.",
    signals: "signals",
    sourceCount: "sources",
    todayTen: "Today's Ten",
    ranking: "Ranked by source position, freshness, and signal quality.",
    leadSignal: "Lead signal",
    score: "score",
    openSignal: "Open signal",
    sourceDesks: "Source desks",
    sourceIntro: "Native rankings and newest published work, kept in context.",
    filterSources: "Filter sources",
    allSources: "All sources",
    searchStories: "Search stories",
    filterSignals: "Filter signals…",
    open: "Open",
    save: "Save",
    remove: "Remove",
    fromSaved: "from saved",
    collected: "collected",
    current: "Current",
    stale: "Stale",
    error: "Error",
    recent: "Recent",
    footer: "Built for one focused scan a day. Original titles, original sources.",
    generated: "Generated",
    timeZone: "SGT",
  },
  zh: {
    home: "Infomap 首页",
    primaryNav: "主导航",
    today: "今日",
    sources: "来源",
    language: "语言",
    original: "原文",
    chinese: "中文",
    updateAria: "扫描所有来源的最新信息",
    refreshDefault: "扫描所有来源的最新信息",
    refreshUnavailable: "公网页面需要云端刷新接口",
    refreshScanning: "正在扫描全部信息源…",
    refreshFailed: "更新失败",
    scanning: "扫描中…",
    updated: "已更新",
    tryAgain: "重试",
    updateNow: "立即更新",
    themeAria: "选择主题颜色",
    theme: "主题",
    useTheme: "使用",
    themeSuffix: "主题",
    daily: "每日",
    eyebrow: "每日 AI、科技与市场信号",
    headlineOne: "重要信息，",
    headlineTwo: "去掉噪音。",
    intro: "从开发者、研究人员、分析师、机构与科技媒体中，筛选值得关注的每日信号。",
    signals: "条信息",
    sourceCount: "个来源",
    todayTen: "今日十条",
    ranking: "根据来源排名、时效性与信号质量综合排序。",
    leadSignal: "首要信号",
    score: "分",
    openSignal: "查看原文",
    sourceDesks: "信息源",
    sourceIntro: "保留各来源原生排名与最新发布内容。",
    filterSources: "筛选信息源",
    allSources: "全部来源",
    searchStories: "搜索信息",
    filterSignals: "筛选信息…",
    open: "打开",
    save: "收藏",
    remove: "取消收藏",
    fromSaved: "",
    collected: "条已采集",
    current: "已更新",
    stale: "暂未更新",
    error: "异常",
    recent: "最近",
    footer: "每天一次专注浏览。保留原始来源，中文辅助阅读。",
    generated: "生成于",
    timeZone: "新加坡时间",
  },
} as const;

function localizedTitle(item: FeedItem, language: Language) {
  return language === "zh" && item.titleZh ? item.titleZh : item.title;
}

function localizedSummary(item: FeedItem, language: Language) {
  return language === "zh" && item.summaryZh ? item.summaryZh : item.summary;
}

function shortDate(value: string, language: Language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return COPY[language].recent;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function issueDate(value: string, language: Language) {
  const date = new Date(`${value}T12:00:00+08:00`);
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function SourcePill({ sourceKey, name }: { sourceKey: string; name: string }) {
  return (
    <span className="source-pill" data-source={sourceKey}>
      <span className="source-dot" aria-hidden="true" />
      {name}
    </span>
  );
}

function StoryLink({
  item,
  index,
  language,
  saved,
  onSave,
}: {
  item: FeedItem;
  index: number;
  language: Language;
  saved: boolean;
  onSave: (id: string) => void;
}) {
  const copy = COPY[language];
  const title = localizedTitle(item, language);
  return (
    <article className="story-row">
      <span className="story-number">{String(index + 1).padStart(2, "0")}</span>
      <div className="story-copy">
        <a href={item.url} target="_blank" rel="noreferrer" className="story-title">
          {title}
        </a>
        <div className="story-meta">
          <SourcePill sourceKey={item.sourceKey} name={item.source} />
          <span>{shortDate(item.publishedAt, language)}</span>
          {item.metric ? <span>{item.metric}</span> : null}
        </div>
      </div>
      <button
        type="button"
        className={`save-button${saved ? " is-saved" : ""}`}
        onClick={() => onSave(item.id)}
        aria-label={saved
          ? `${copy.remove} ${title} ${copy.fromSaved}`.trim()
          : `${copy.save} ${title}`}
        aria-pressed={saved}
      >
        {saved ? "★" : "☆"}
      </button>
    </article>
  );
}

export function Dashboard({ feed }: { feed: FeedData }) {
  const [currentFeed, setCurrentFeed] = useState(feed);
  const [view, setView] = useState<View>("today");
  const [language, setLanguage] = useState<Language>("original");
  const [query, setQuery] = useState("");
  const [activeSource, setActiveSource] = useState("all");
  const [saved, setSaved] = useState<string[]>([]);
  const [theme, setTheme] = useState<ThemeName>("signal");
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");
  const [refreshMessage, setRefreshMessage] = useState("Scan every source for the latest signals");
  const themeHydrated = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("infomap:saved");
        if (stored) setSaved(JSON.parse(stored));
      } catch {
        setSaved([]);
      }
      const storedTheme = window.localStorage.getItem("infomap:theme");
      const nextTheme = THEMES.some((option) => option.id === storedTheme)
        ? (storedTheme as ThemeName)
        : "signal";
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      const storedLanguage = window.localStorage.getItem("infomap:language");
      const nextLanguage: Language = storedLanguage === "zh" ? "zh" : "original";
      setLanguage(nextLanguage);
      setRefreshMessage(COPY[nextLanguage].refreshDefault);
      document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
      document.documentElement.dataset.language = nextLanguage;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!themeHydrated.current) {
      themeHydrated.current = true;
      return;
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function chooseTheme(nextTheme: ThemeName) {
    setTheme(nextTheme);
    window.localStorage.setItem("infomap:theme", nextTheme);
  }

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setRefreshStatus("idle");
    setRefreshMessage(COPY[nextLanguage].refreshDefault);
    window.localStorage.setItem("infomap:language", nextLanguage);
    document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.language = nextLanguage;
  }

  function toggleSaved(id: string) {
    setSaved((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      window.localStorage.setItem("infomap:saved", JSON.stringify(next));
      return next;
    });
  }

  async function refreshFeed() {
    if (refreshStatus === "loading") return;
    const copy = COPY[language];

    const configuredEndpoint = process.env.NEXT_PUBLIC_REFRESH_ENDPOINT?.trim();
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    const endpoint = configuredEndpoint
      || (localHosts.has(window.location.hostname)
        ? "http://127.0.0.1:8787/refresh"
        : "");

    if (!endpoint) {
      setRefreshStatus("error");
      setRefreshMessage(copy.refreshUnavailable);
      return;
    }

    setRefreshStatus("loading");
    setRefreshMessage(copy.refreshScanning);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload && typeof payload.error === "string"
          ? payload.error
          : `${copy.refreshFailed} (${response.status})`;
        throw new Error(message);
      }

      if (
        !payload
        || typeof payload.generatedAt !== "string"
        || !Array.isArray(payload.sources)
        || !Array.isArray(payload.items)
        || !Array.isArray(payload.topTen)
      ) {
        throw new Error("Refresh service returned an invalid feed");
      }

      const nextFeed = payload as FeedData;
      setCurrentFeed(nextFeed);
      setActiveSource((current) => (
        current === "all" || nextFeed.sources.some((source) => source.key === current)
          ? current
          : "all"
      ));
      setRefreshStatus("success");
      setRefreshMessage(language === "zh"
        ? `刚刚更新了 ${nextFeed.items.length} 条信息`
        : `${nextFeed.items.length} signals updated just now`);
    } catch (error) {
      setRefreshStatus("error");
      setRefreshMessage(error instanceof Error ? error.message : copy.refreshFailed);
    }
  }

  const topItems = useMemo(() => {
    const byId = new Map(currentFeed.items.map((item) => [item.id, item]));
    return currentFeed.topTen.map((id) => byId.get(id)).filter(Boolean) as FeedItem[];
  }, [currentFeed]);

  const filteredSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return currentFeed.sources
      .filter((source) => activeSource === "all" || source.key === activeSource)
      .map((source) => ({
        ...source,
        items: currentFeed.items
          .filter((item) => item.sourceKey === source.key)
          .filter((item) =>
            normalizedQuery
              ? `${item.title} ${item.titleZh ?? ""} ${item.source} ${item.category}`
                  .toLowerCase()
                  .includes(normalizedQuery)
              : true,
          )
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 10),
      }))
      .filter((source) => source.items.length > 0);
  }, [activeSource, currentFeed, query]);

  const lead = topItems[0];
  const remaining = topItems.slice(1);
  const copy = COPY[language];

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label={copy.home}>
          <span className="brand-mark" aria-hidden="true">I</span>
          <span>INFOMAP</span>
        </a>
        <nav className="main-nav" aria-label={copy.primaryNav}>
          <button
            type="button"
            className={view === "today" ? "is-active" : ""}
            onClick={() => setView("today")}
          >
            {copy.today}
          </button>
          <button
            type="button"
            className={view === "sources" ? "is-active" : ""}
            onClick={() => setView("sources")}
          >
            {copy.sources}
          </button>
        </nav>
        <div className="topbar-actions">
          <div className="language-picker" role="group" aria-label={copy.language}>
            <button
              type="button"
              className={language === "original" ? "is-active" : ""}
              onClick={() => chooseLanguage("original")}
              aria-pressed={language === "original"}
            >
              EN
            </button>
            <button
              type="button"
              className={language === "zh" ? "is-active" : ""}
              onClick={() => chooseLanguage("zh")}
              aria-pressed={language === "zh"}
            >
              中文
            </button>
          </div>
          <button
            type="button"
            className={`refresh-button status-${refreshStatus}`}
            onClick={refreshFeed}
            disabled={refreshStatus === "loading"}
            aria-label={copy.updateAria}
            title={refreshMessage}
          >
            <span className="refresh-icon" aria-hidden="true">↻</span>
            <span>
              {refreshStatus === "loading"
                ? copy.scanning
                : refreshStatus === "success"
                  ? copy.updated
                  : refreshStatus === "error"
                    ? copy.tryAgain
                    : copy.updateNow}
            </span>
          </button>
          <span className="sr-only" role="status" aria-live="polite">
            {refreshMessage}
          </span>
          <div className="theme-picker" role="group" aria-label={copy.themeAria}>
            <span className="theme-picker-label">{copy.theme}</span>
            {THEMES.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`theme-swatch${theme === option.id ? " is-active" : ""}`}
                data-theme-option={option.id}
                onClick={() => chooseTheme(option.id)}
                aria-label={`${copy.useTheme} ${option.label} ${copy.themeSuffix}`}
                aria-pressed={theme === option.id}
                title={option.label}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="edition-meta">
            <span className="live-dot" aria-hidden="true" />
            {copy.daily} · {currentFeed.issueNumber}
          </div>
        </div>
      </header>

      <section className="masthead" id="top">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className={language === "zh" ? "is-chinese" : ""}>
            {copy.headlineOne}<br />{copy.headlineTwo}
          </h1>
        </div>
        <div className="masthead-note">
          <p>{issueDate(currentFeed.issueDate, language)}</p>
          <p>{copy.intro}</p>
          <div className="masthead-stats">
            <span><strong>{currentFeed.items.length}</strong> {copy.signals}</span>
            <span><strong>{currentFeed.sources.length}</strong> {copy.sourceCount}</span>
          </div>
        </div>
      </section>

      {view === "today" && lead ? (
        <section className="briefing-section" aria-labelledby="today-heading">
          <div className="section-heading">
            <div>
              <span className="section-index">01</span>
              <h2 id="today-heading">{copy.todayTen}</h2>
            </div>
            <p>{copy.ranking}</p>
          </div>

          <div className="top-stories-layout">
            <article className="lead-story">
              <div className="lead-kicker">
                <span>01 / {copy.leadSignal}</span>
                <span className="score-chip">{Math.round(lead.score)} {copy.score}</span>
              </div>
              <a href={lead.url} target="_blank" rel="noreferrer">
                <h3>{localizedTitle(lead, language)}</h3>
              </a>
              {localizedSummary(lead, language)
                ? <p className="lead-summary">{localizedSummary(lead, language)}</p>
                : null}
              <div className="lead-footer">
                <div>
                  <SourcePill sourceKey={lead.sourceKey} name={lead.source} />
                  <span>{shortDate(lead.publishedAt, language)}</span>
                </div>
                <a href={lead.url} target="_blank" rel="noreferrer" className="read-link">
                  {copy.openSignal} ↗
                </a>
              </div>
            </article>

            <div className="ranked-list">
              {remaining.map((item, index) => (
                <StoryLink
                  key={item.id}
                  item={item}
                  index={index + 1}
                  language={language}
                  saved={saved.includes(item.id)}
                  onSave={toggleSaved}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="sources-section" aria-labelledby="sources-heading">
        <div className="section-heading source-heading">
          <div>
            <span className="section-index">{view === "today" ? "02" : "01"}</span>
            <h2 id="sources-heading">{copy.sourceDesks}</h2>
          </div>
          <p>{copy.sourceIntro}</p>
        </div>

        <div className="source-toolbar">
          <div className="source-tabs" aria-label={copy.filterSources}>
            <button
              type="button"
              className={activeSource === "all" ? "is-active" : ""}
              onClick={() => setActiveSource("all")}
            >
              {copy.allSources}
            </button>
            {currentFeed.sources.map((source) => (
              <button
                type="button"
                key={source.key}
                className={activeSource === source.key ? "is-active" : ""}
                onClick={() => setActiveSource(source.key)}
              >
                {source.name}
              </button>
            ))}
          </div>
          <label className="search-field">
            <span className="sr-only">{copy.searchStories}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.filterSignals}
            />
            <span aria-hidden="true">⌕</span>
          </label>
        </div>

        <div className="source-grid">
          {filteredSources.map((source) => (
            <section className="source-card" key={source.key} data-source={source.key}>
              <header className="source-card-header">
                <div>
                  <span className="source-monogram" aria-hidden="true">
                    {source.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h3>{source.name}</h3>
                    <p>{language === "zh" && source.categoryZh ? source.categoryZh : source.category}</p>
                  </div>
                </div>
                <a href={source.url} target="_blank" rel="noreferrer" aria-label={`${copy.open} ${source.name}`}>
                  ↗
                </a>
              </header>
              <p className="source-description">
                {language === "zh" && source.descriptionZh ? source.descriptionZh : source.description}
              </p>
              <ol className="source-list">
                {source.items.map((item) => (
                  <li key={item.id}>
                    <span>{String(item.rank).padStart(2, "0")}</span>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {localizedTitle(item, language)}
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleSaved(item.id)}
                      className={saved.includes(item.id) ? "is-saved" : ""}
                      aria-label={saved.includes(item.id)
                        ? `${copy.remove} ${localizedTitle(item, language)} ${copy.fromSaved}`.trim()
                        : `${copy.save} ${localizedTitle(item, language)}`}
                    >
                      {saved.includes(item.id) ? "★" : "☆"}
                    </button>
                  </li>
                ))}
              </ol>
              <footer>
                <span>{source.count} {copy.collected}</span>
                <span className={`status-${source.status}`}>
                  {source.status === "ok"
                    ? copy.current
                    : source.status === "stale"
                      ? copy.stale
                      : copy.error}
                </span>
              </footer>
            </section>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span>INFOMAP</span>
        </div>
        <p>{copy.footer}</p>
        <p>
          {copy.generated} {new Date(currentFeed.generatedAt).toLocaleString(
            language === "zh" ? "zh-CN" : "en-SG",
            { timeZone: "Asia/Singapore" },
          )} {copy.timeZone}
        </p>
      </footer>
    </main>
  );
}
