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
};

export type FeedSource = {
  key: string;
  name: string;
  category: string;
  description: string;
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

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function issueDate(value: string) {
  const date = new Date(`${value}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("en", {
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
  saved,
  onSave,
}: {
  item: FeedItem;
  index: number;
  saved: boolean;
  onSave: (id: string) => void;
}) {
  return (
    <article className="story-row">
      <span className="story-number">{String(index + 1).padStart(2, "0")}</span>
      <div className="story-copy">
        <a href={item.url} target="_blank" rel="noreferrer" className="story-title">
          {item.title}
        </a>
        <div className="story-meta">
          <SourcePill sourceKey={item.sourceKey} name={item.source} />
          <span>{shortDate(item.publishedAt)}</span>
          {item.metric ? <span>{item.metric}</span> : null}
        </div>
      </div>
      <button
        type="button"
        className={`save-button${saved ? " is-saved" : ""}`}
        onClick={() => onSave(item.id)}
        aria-label={saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
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

    const configuredEndpoint = process.env.NEXT_PUBLIC_REFRESH_ENDPOINT?.trim();
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    const endpoint = configuredEndpoint
      || (localHosts.has(window.location.hostname)
        ? "http://127.0.0.1:8787/refresh"
        : "");

    if (!endpoint) {
      setRefreshStatus("error");
      setRefreshMessage("This hosted copy needs a refresh service endpoint");
      return;
    }

    setRefreshStatus("loading");
    setRefreshMessage("Scanning every source now…");

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
          : `Refresh failed (${response.status})`;
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
      setRefreshMessage(`${nextFeed.items.length} signals updated just now`);
    } catch (error) {
      setRefreshStatus("error");
      setRefreshMessage(error instanceof Error ? error.message : "Refresh failed");
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
              ? `${item.title} ${item.source} ${item.category}`
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

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Infomap home">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span>INFOMAP</span>
        </a>
        <nav className="main-nav" aria-label="Primary navigation">
          <button
            type="button"
            className={view === "today" ? "is-active" : ""}
            onClick={() => setView("today")}
          >
            Today
          </button>
          <button
            type="button"
            className={view === "sources" ? "is-active" : ""}
            onClick={() => setView("sources")}
          >
            Sources
          </button>
        </nav>
        <div className="topbar-actions">
          <button
            type="button"
            className={`refresh-button status-${refreshStatus}`}
            onClick={refreshFeed}
            disabled={refreshStatus === "loading"}
            aria-label="Scan all sources for the latest information"
            title={refreshMessage}
          >
            <span className="refresh-icon" aria-hidden="true">↻</span>
            <span>
              {refreshStatus === "loading"
                ? "Scanning…"
                : refreshStatus === "success"
                  ? "Updated"
                  : refreshStatus === "error"
                    ? "Try again"
                    : "Update now"}
            </span>
          </button>
          <span className="sr-only" role="status" aria-live="polite">
            {refreshMessage}
          </span>
          <div className="theme-picker" role="group" aria-label="Choose color theme">
            <span className="theme-picker-label">Theme</span>
            {THEMES.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`theme-swatch${theme === option.id ? " is-active" : ""}`}
                data-theme-option={option.id}
                onClick={() => chooseTheme(option.id)}
                aria-label={`Use ${option.label} theme`}
                aria-pressed={theme === option.id}
                title={option.label}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="edition-meta">
            <span className="live-dot" aria-hidden="true" />
            Daily · {currentFeed.issueNumber}
          </div>
        </div>
      </header>

      <section className="masthead" id="top">
        <div>
          <p className="eyebrow">DAILY AI, TECHNOLOGY & MARKET SIGNALS</p>
          <h1>What matters,<br />without the noise.</h1>
        </div>
        <div className="masthead-note">
          <p>{issueDate(currentFeed.issueDate)}</p>
          <p>
            A source-aware scan across builders, researchers, analysts,
            institutions, and the technology press. Updated once every day.
          </p>
          <div className="masthead-stats">
            <span><strong>{currentFeed.items.length}</strong> signals</span>
            <span><strong>{currentFeed.sources.length}</strong> sources</span>
          </div>
        </div>
      </section>

      {view === "today" && lead ? (
        <section className="briefing-section" aria-labelledby="today-heading">
          <div className="section-heading">
            <div>
              <span className="section-index">01</span>
              <h2 id="today-heading">Today&apos;s Ten</h2>
            </div>
            <p>Ranked by source position, freshness, and signal quality.</p>
          </div>

          <div className="top-stories-layout">
            <article className="lead-story">
              <div className="lead-kicker">
                <span>01 / Lead signal</span>
                <span className="score-chip">{Math.round(lead.score)} score</span>
              </div>
              <a href={lead.url} target="_blank" rel="noreferrer">
                <h3>{lead.title}</h3>
              </a>
              {lead.summary ? <p className="lead-summary">{lead.summary}</p> : null}
              <div className="lead-footer">
                <div>
                  <SourcePill sourceKey={lead.sourceKey} name={lead.source} />
                  <span>{shortDate(lead.publishedAt)}</span>
                </div>
                <a href={lead.url} target="_blank" rel="noreferrer" className="read-link">
                  Open signal ↗
                </a>
              </div>
            </article>

            <div className="ranked-list">
              {remaining.map((item, index) => (
                <StoryLink
                  key={item.id}
                  item={item}
                  index={index + 1}
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
            <h2 id="sources-heading">Source desks</h2>
          </div>
          <p>Native rankings and newest published work, kept in context.</p>
        </div>

        <div className="source-toolbar">
          <div className="source-tabs" aria-label="Filter sources">
            <button
              type="button"
              className={activeSource === "all" ? "is-active" : ""}
              onClick={() => setActiveSource("all")}
            >
              All sources
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
            <span className="sr-only">Search stories</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter signals…"
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
                    <p>{source.category}</p>
                  </div>
                </div>
                <a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open ${source.name}`}>
                  ↗
                </a>
              </header>
              <p className="source-description">{source.description}</p>
              <ol className="source-list">
                {source.items.map((item) => (
                  <li key={item.id}>
                    <span>{String(item.rank).padStart(2, "0")}</span>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleSaved(item.id)}
                      className={saved.includes(item.id) ? "is-saved" : ""}
                      aria-label={saved.includes(item.id) ? `Remove ${item.title} from saved` : `Save ${item.title}`}
                    >
                      {saved.includes(item.id) ? "★" : "☆"}
                    </button>
                  </li>
                ))}
              </ol>
              <footer>
                <span>{source.count} collected</span>
                <span className={`status-${source.status}`}>
                  {source.status === "ok" ? "Current" : source.status}
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
        <p>Built for one focused scan a day. Original titles, original sources.</p>
        <p>Generated {new Date(currentFeed.generatedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })} SGT</p>
      </footer>
    </main>
  );
}
