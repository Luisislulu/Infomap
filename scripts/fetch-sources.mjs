import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(projectRoot, "public", "data");
const archiveRoot = path.join(dataRoot, "archive");
const latestPath = path.join(dataRoot, "latest.json");
const now = new Date();

const SOURCE_DEFINITIONS = [
  {
    key: "github",
    name: "GitHub Trending",
    category: "Open source",
    description: "Repositories gaining the most attention from developers today.",
    url: "https://github.com/trending",
    weight: 10,
  },
  {
    key: "hacker-news",
    name: "Hacker News",
    category: "Community",
    description: "The strongest technology discussions from the Hacker News front page.",
    url: "https://news.ycombinator.com/",
    weight: 9,
  },
  {
    key: "hugging-face",
    name: "Hugging Face Papers",
    category: "Research",
    description: "AI papers selected and discussed by the Hugging Face research community.",
    url: "https://huggingface.co/papers",
    weight: 8,
  },
  {
    key: "alpha-xiv",
    name: "alphaXiv",
    category: "Research discovery",
    description: "Trending research papers ranked by attention and discussion on alphaXiv.",
    url: "https://www.alphaxiv.org/",
    weight: 8,
  },
  {
    key: "techmeme",
    name: "Techmeme",
    category: "Technology news",
    description: "Important technology events clustered from reporting across the web.",
    url: "https://www.techmeme.com/",
    weight: 8,
  },
  {
    key: "stratechery",
    name: "Stratechery",
    category: "Strategy",
    description: "Technology strategy and business analysis by Ben Thompson.",
    url: "https://stratechery.com/",
    weight: 7,
  },
  {
    key: "interconnects",
    name: "Interconnects",
    category: "Frontier AI",
    description: "Models, training methods, and the trajectory of the open AI ecosystem.",
    url: "https://www.interconnects.ai/",
    weight: 7,
  },
  {
    key: "latent-space",
    name: "Latent Space",
    category: "AI engineering",
    description: "Agents, models, infrastructure, and the people building the AI stack.",
    url: "https://www.latent.space/",
    weight: 6,
  },
  {
    key: "simon-willison",
    name: "Simon Willison",
    category: "Applied AI",
    description: "Practical notes on LLMs, developer tools, data, and software craft.",
    url: "https://simonwillison.net/",
    weight: 7,
  },
];

const RSS_SOURCES = [
  ["techmeme", "https://www.techmeme.com/feed.xml"],
  ["stratechery", "https://stratechery.com/feed/"],
  ["interconnects", "https://www.interconnects.ai/feed"],
  ["latent-space", "https://www.latent.space/feed"],
  ["simon-willison", "https://simonwillison.net/atom/everything/"],
];

const entityMap = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
};

function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => entityMap[name.toLowerCase()] ?? match);
}

function cleanText(value = "") {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(sourceKey, value) {
  const hash = createHash("sha1").update(value).digest("hex").slice(0, 12);
  return `${sourceKey}-${hash}`;
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "ref",
      "source",
    ].forEach((key) => url.searchParams.delete(key));
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function normalizeTitle(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
      "user-agent": "InfomapDaily/0.1 (+https://github.com/)",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function getTag(block, names) {
  for (const name of names) {
    const pattern = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i");
    const match = block.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return "";
}

function getLink(block) {
  const rssLink = block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
  if (rssLink) return cleanText(rssLink[1]);
  const atomLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return atomLink ? decodeEntities(atomLink[1]) : "";
}

function parseRss(sourceKey, xml) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => match[0]);
  return blocks.slice(0, 10).flatMap((block, index) => {
    const title = getTag(block, ["title"]);
    const url = getLink(block);
    if (!title || !url) return [];
    const published = getTag(block, ["pubDate", "published", "updated", "dc:date"]);
    return [
      makeItem({
        sourceKey,
        title,
        url,
        publishedAt: published || now.toISOString(),
        rank: index + 1,
      }),
    ];
  });
}

function sourceDefinition(sourceKey) {
  const source = SOURCE_DEFINITIONS.find((entry) => entry.key === sourceKey);
  if (!source) throw new Error(`Unknown source: ${sourceKey}`);
  return source;
}

function makeItem({ sourceKey, title, url, publishedAt, rank, metric, summary }) {
  const source = sourceDefinition(sourceKey);
  const normalizedUrl = canonicalUrl(url);
  return {
    id: makeId(sourceKey, normalizedUrl || title),
    title: cleanText(title),
    url: normalizedUrl,
    source: source.name,
    sourceKey,
    category: source.category,
    publishedAt: new Date(publishedAt || now).toISOString(),
    rank,
    score: 0,
    ...(metric ? { metric } : {}),
    ...(summary ? { summary: cleanText(summary).slice(0, 280) } : {}),
  };
}

async function fetchHackerNews() {
  const ids = JSON.parse(await fetchText("https://hacker-news.firebaseio.com/v0/topstories.json"));
  const stories = await Promise.all(
    ids.slice(0, 20).map(async (id) => {
      const text = await fetchText(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      return JSON.parse(text);
    }),
  );
  return stories
    .filter((story) => story?.title && !story.deleted && !story.dead)
    .slice(0, 10)
    .map((story, index) =>
      makeItem({
        sourceKey: "hacker-news",
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        publishedAt: new Date(story.time * 1000),
        rank: index + 1,
        metric: `${story.score ?? 0} pts · ${story.descendants ?? 0} comments`,
      }),
    );
}

async function fetchGithubTrending() {
  const html = await fetchText("https://github.com/trending?since=daily");
  const articles = html.split(/<article\b[^>]*class=["'][^"']*Box-row[^"']*["'][^>]*>/i).slice(1);
  return articles.slice(0, 10).flatMap((article, index) => {
    const heading = article.match(/<h2[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!heading) return [];
    const href = heading[1];
    const title = cleanText(heading[2]).replace(/\s*\/\s*/, " / ");
    const description = article.match(/<p[^>]*class=["'][^"']*col-9[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    const language = article.match(/itemprop=["']programmingLanguage["'][^>]*>([\s\S]*?)<\/span>/i);
    const starsToday = article.match(/([\d,.kK]+)\s+stars?\s+today/i);
    const metric = [
      language ? cleanText(language[1]) : "",
      starsToday ? `${starsToday[1]} stars today` : "Trending today",
    ]
      .filter(Boolean)
      .join(" · ");
    return [
      makeItem({
        sourceKey: "github",
        title,
        url: `https://github.com${href}`,
        publishedAt: now,
        rank: index + 1,
        metric,
        summary: description ? cleanText(description[1]) : undefined,
      }),
    ];
  });
}

async function fetchHuggingFace() {
  const rows = JSON.parse(await fetchText("https://huggingface.co/api/daily_papers?limit=20"));
  return rows.slice(0, 10).flatMap((row, index) => {
    const paper = row.paper ?? row;
    const id = paper.id ?? row.id;
    const title = paper.title ?? row.title;
    if (!id || !title) return [];
    const upvotes = paper.upvotes ?? row.upvotes;
    return [
      makeItem({
        sourceKey: "hugging-face",
        title,
        url: `https://huggingface.co/papers/${id}`,
        publishedAt: paper.submittedOnDailyAt ?? row.publishedAt ?? paper.publishedAt ?? now,
        rank: index + 1,
        metric: typeof upvotes === "number" ? `${upvotes} upvotes` : "Daily paper",
        summary: paper.ai_summary ?? row.summary ?? paper.summary,
      }),
    ];
  });
}

async function fetchAlphaXiv() {
  const html = await fetchText("https://www.alphaxiv.org/");
  const documents = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        return [JSON.parse(match[1])];
      } catch {
        return [];
      }
    });
  const itemList = documents
    .flatMap((document) => document["@graph"] ?? [document])
    .find((entry) => entry?.["@type"] === "ItemList" && Array.isArray(entry.itemListElement));

  if (!itemList) throw new Error("Trending Papers JSON-LD was not found");

  return itemList.itemListElement.slice(0, 10).flatMap((entry, index) => {
    const paper = entry.item ?? entry;
    const title = paper.headline ?? paper.name;
    const url = paper.url;
    if (!title || !url) return [];

    const interactions = Array.isArray(paper.interactionStatistic) ? paper.interactionStatistic : [];
    const interactionCount = (type) =>
      interactions.find((interaction) => interaction?.interactionType?.["@type"] === type)
        ?.userInteractionCount;
    const views = interactionCount("ViewAction");
    const votes = interactionCount("LikeAction");
    const metric = [
      Number.isFinite(votes) ? `${votes} votes` : "",
      Number.isFinite(views) ? `${views} views` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    return [
      makeItem({
        sourceKey: "alpha-xiv",
        title,
        url,
        publishedAt: paper.datePublished ?? paper.dateModified ?? now,
        rank: Number.isFinite(entry.position) ? entry.position : index + 1,
        metric: metric || "Trending paper",
        summary: paper.description,
      }),
    ];
  });
}

async function fetchRssSource(sourceKey, url) {
  return parseRss(sourceKey, await fetchText(url));
}

function scoreItem(item) {
  const source = sourceDefinition(item.sourceKey);
  const publishedTime = new Date(item.publishedAt).getTime();
  const ageHours = Number.isFinite(publishedTime)
    ? Math.max(0, (now.getTime() - publishedTime) / 3_600_000)
    : 168;
  const freshness = Math.max(0, 18 - Math.log2(ageHours + 1) * 3.4);
  const nativeRank = Math.max(0, 24 - (item.rank - 1) * 2.2);
  const metricBoost = /stars today|pts|upvotes|votes|views/i.test(item.metric ?? "") ? 4 : 0;
  return Math.round((48 + source.weight * 2.2 + freshness + nativeRank + metricBoost) * 10) / 10;
}

function deduplicate(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  return items.filter((item) => {
    const url = `${item.sourceKey}:${canonicalUrl(item.url)}`;
    const title = `${item.sourceKey}:${normalizeTitle(item.title)}`;
    if (seenUrls.has(url) || seenTitles.has(title)) return false;
    seenUrls.add(url);
    seenTitles.add(title);
    return true;
  });
}

function selectTopTen(items) {
  const sorted = [...items].sort((a, b) => b.score - a.score || a.rank - b.rank);
  const sourceCounts = new Map();
  const seenTitles = new Set();
  const selected = [];
  for (const item of sorted) {
    const title = normalizeTitle(item.title);
    if (seenTitles.has(title)) continue;
    if ((sourceCounts.get(item.sourceKey) ?? 0) >= 2) continue;
    selected.push(item.id);
    seenTitles.add(title);
    sourceCounts.set(item.sourceKey, (sourceCounts.get(item.sourceKey) ?? 0) + 1);
    if (selected.length === 10) break;
  }
  return selected;
}

function singaporeDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(latestPath, "utf8"));
  } catch {
    return { items: [], sources: [] };
  }
}

async function pruneArchives() {
  const files = (await readdir(archiveRoot)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
  const excess = files.slice(0, Math.max(0, files.length - 30));
  await Promise.all(excess.map((file) => unlink(path.join(archiveRoot, file))));
}

async function main() {
  await mkdir(archiveRoot, { recursive: true });
  const previous = await readPrevious();
  const tasks = [
    ["github", fetchGithubTrending],
    ["hacker-news", fetchHackerNews],
    ["hugging-face", fetchHuggingFace],
    ["alpha-xiv", fetchAlphaXiv],
    ...RSS_SOURCES.map(([key, url]) => [key, () => fetchRssSource(key, url)]),
  ];

  const results = await Promise.allSettled(tasks.map(([, task]) => task()));
  const errors = [];
  const statuses = new Map();
  const collected = [];

  results.forEach((result, index) => {
    const sourceKey = tasks[index][0];
    if (result.status === "fulfilled" && result.value.length) {
      statuses.set(sourceKey, "ok");
      collected.push(...result.value);
      return;
    }
    const message = result.status === "rejected" ? result.reason?.message ?? String(result.reason) : "No items returned";
    errors.push(`${sourceKey}: ${message}`);
    const fallback = previous.items.filter((item) => item.sourceKey === sourceKey).slice(0, 10);
    if (fallback.length) {
      statuses.set(sourceKey, "stale");
      collected.push(...fallback);
    } else {
      statuses.set(sourceKey, "error");
    }
  });

  const items = deduplicate(collected)
    .map((item) => ({ ...item, score: scoreItem(item) }))
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.rank - b.rank);
  const issueDate = singaporeDate(now);
  const sources = SOURCE_DEFINITIONS.map((source) => ({
    key: source.key,
    name: source.name,
    category: source.category,
    description: source.description,
    url: source.url,
    count: items.filter((item) => item.sourceKey === source.key).length,
    status: statuses.get(source.key) ?? "error",
  }));
  const output = {
    generatedAt: now.toISOString(),
    issueDate,
    issueNumber: issueDate.replaceAll("-", "."),
    sources,
    items,
    topTen: selectTopTen(items),
    errors,
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  await writeFile(latestPath, serialized);
  await writeFile(path.join(archiveRoot, `${issueDate}.json`), serialized);
  await pruneArchives();
  process.stdout.write(`Infomap collected ${items.length} signals from ${sources.filter((source) => source.status !== "error").length} sources.\n`);
  if (errors.length) process.stdout.write(`Warnings: ${errors.join(" | ")}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
