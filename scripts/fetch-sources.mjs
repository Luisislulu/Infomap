import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addChineseTranslations } from "./translate-items.mjs";

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
    categoryZh: "开源",
    description: "Repositories gaining the most attention from developers today.",
    descriptionZh: "今天最受开发者关注的开源项目。",
    url: "https://github.com/trending",
    weight: 10,
  },
  {
    key: "hacker-news",
    name: "Hacker News",
    category: "Community",
    categoryZh: "技术社区",
    description: "The strongest technology discussions from the Hacker News front page.",
    descriptionZh: "Hacker News 首页最值得关注的技术讨论。",
    url: "https://news.ycombinator.com/",
    weight: 9,
  },
  {
    key: "hugging-face",
    name: "Hugging Face Papers",
    category: "Research",
    categoryZh: "研究",
    description: "AI papers selected and discussed by the Hugging Face research community.",
    descriptionZh: "Hugging Face 研究社区关注和讨论的 AI 论文。",
    url: "https://huggingface.co/papers",
    weight: 8,
  },
  {
    key: "alpha-xiv",
    name: "alphaXiv",
    category: "Research discovery",
    categoryZh: "研究发现",
    description: "Trending research papers ranked by attention and discussion on alphaXiv.",
    descriptionZh: "按关注度和讨论热度排序的前沿研究论文。",
    url: "https://www.alphaxiv.org/",
    weight: 8,
  },
  {
    key: "techmeme",
    name: "Techmeme",
    category: "Technology news",
    categoryZh: "科技新闻",
    description: "Important technology events clustered from reporting across the web.",
    descriptionZh: "从全网报道中聚合的重要科技事件。",
    url: "https://www.techmeme.com/",
    weight: 8,
  },
  {
    key: "techcrunch",
    name: "TechCrunch",
    category: "Startups & venture",
    categoryZh: "创业与风投",
    description: "Startup funding, venture capital, products, and the companies shaping technology markets.",
    descriptionZh: "创业融资、风险投资、产品以及塑造科技市场的公司。",
    url: "https://techcrunch.com/",
    weight: 7,
  },
  {
    key: "semi-analysis",
    name: "SemiAnalysis",
    category: "AI infrastructure",
    categoryZh: "AI 基础设施",
    description: "Deep research on semiconductors, AI systems, datacenters, and the economics of compute.",
    descriptionZh: "半导体、AI 系统、数据中心与算力经济的深度研究。",
    url: "https://semianalysis.com/",
    weight: 9,
  },
  {
    key: "stratechery",
    name: "Stratechery",
    category: "Strategy",
    categoryZh: "科技战略",
    description: "Technology strategy and business analysis by Ben Thompson.",
    descriptionZh: "Ben Thompson 撰写的科技战略与商业分析。",
    url: "https://stratechery.com/",
    weight: 7,
  },
  {
    key: "goldman-sachs",
    name: "Goldman Sachs Research",
    category: "Capital markets",
    categoryZh: "资本市场",
    description: "Research on global markets, macroeconomics, industries, and investment themes.",
    descriptionZh: "全球市场、宏观经济、行业与投资主题研究。",
    url: "https://www.goldmansachs.com/insights/goldman-sachs-research",
    weight: 8,
  },
  {
    key: "mckinsey-mgi",
    name: "McKinsey MGI",
    category: "Business & economics",
    categoryZh: "商业与经济",
    description: "Research on productivity, capital, technology, labor, and global economic shifts.",
    descriptionZh: "生产率、资本、技术、劳动力与全球经济变化研究。",
    url: "https://www.mckinsey.com/mgi/our-research/all-research",
    weight: 8,
  },
  {
    key: "apollo-daily-spark",
    name: "Apollo Daily Spark",
    category: "Macro & markets",
    categoryZh: "宏观与市场",
    description: "Daily, chart-led analysis of the US economy, inflation, credit, and capital markets.",
    descriptionZh: "以图表呈现美国经济、通胀、信贷和资本市场的每日分析。",
    url: "https://www.apollo.com/institutional/insights-news/insights/daily-spark",
    weight: 9,
  },
  {
    key: "blackrock-bii",
    name: "BlackRock Investment Institute",
    category: "Investment strategy",
    categoryZh: "投资策略",
    description: "Portfolio views and research on markets, macroeconomics, geopolitics, and long-run themes.",
    descriptionZh: "市场、宏观经济、地缘政治与长期主题的投资观点。",
    url: "https://www.blackrock.com/corporate/insights/blackrock-investment-institute/publications",
    weight: 8,
  },
  {
    key: "imf-blog",
    name: "IMF Blog",
    category: "Global macro",
    categoryZh: "全球宏观",
    description: "Policy analysis on the global economy, financial stability, fiscal affairs, and development.",
    descriptionZh: "全球经济、金融稳定、财政与发展议题的政策分析。",
    url: "https://www.imf.org/en/Blogs",
    weight: 8,
  },
  {
    key: "interconnects",
    name: "Interconnects",
    category: "Frontier AI",
    categoryZh: "前沿 AI",
    description: "Models, training methods, and the trajectory of the open AI ecosystem.",
    descriptionZh: "模型、训练方法与开放 AI 生态的发展方向。",
    url: "https://www.interconnects.ai/",
    weight: 7,
  },
  {
    key: "latent-space",
    name: "Latent Space",
    category: "AI engineering",
    categoryZh: "AI 工程",
    description: "Agents, models, infrastructure, and the people building the AI stack.",
    descriptionZh: "智能体、模型、基础设施以及构建 AI 技术栈的人。",
    url: "https://www.latent.space/",
    weight: 6,
  },
  {
    key: "simon-willison",
    name: "Simon Willison",
    category: "Applied AI",
    categoryZh: "应用 AI",
    description: "Practical notes on LLMs, developer tools, data, and software craft.",
    descriptionZh: "关于大模型、开发工具、数据与软件实践的实用笔记。",
    url: "https://simonwillison.net/",
    weight: 7,
  },
];

const RSS_SOURCES = [
  ["techmeme", "https://www.techmeme.com/feed.xml"],
  ["techcrunch", "https://techcrunch.com/feed/"],
  ["semi-analysis", "https://newsletter.semianalysis.com/feed"],
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

async function fetchTextUnchecked(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/html;q=0.9, */*;q=0.8",
      "user-agent": "InfomapDaily/0.1 (+https://github.com/)",
    },
    signal: AbortSignal.timeout(25_000),
  });
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

function parseRss(sourceKey, xml, predicate = () => true) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)]
    .map((match) => match[0])
    .filter(predicate);
  return blocks.slice(0, 10).flatMap((block, index) => {
    const title = getTag(block, ["title"]);
    const url = getLink(block);
    if (!title || !url) return [];
    const published = getTag(block, ["pubDate", "published", "updated", "dc:date"]);
    const summary = getTag(block, ["description", "summary", "content:encoded"]);
    return [
      makeItem({
        sourceKey,
        title,
        url,
        publishedAt: published || now.toISOString(),
        rank: index + 1,
        summary: summary || undefined,
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

async function fetchGoldmanSachs() {
  const rows = JSON.parse(await fetchText("https://www.goldmansachs.com/feeds/insights.json"));
  return rows
    .filter((row) => row.path?.startsWith("/insights/goldman-sachs-research/"))
    .sort(
      (a, b) =>
        new Date(b.cmsPageProps?.publishDate ?? 0).getTime() -
        new Date(a.cmsPageProps?.publishDate ?? 0).getTime(),
    )
    .slice(0, 10)
    .flatMap((row, index) => {
      if (!row.title || !row.path) return [];
      const topic = row.cmsPageProps?.primaryTopic?.[0]?.title;
      return [
        makeItem({
          sourceKey: "goldman-sachs",
          title: row.title,
          url: `https://www.goldmansachs.com${row.path}`,
          publishedAt: row.cmsPageProps?.publishDate ?? now,
          rank: index + 1,
          metric: topic || "Goldman Sachs Research",
          summary: row.description,
        }),
      ];
    });
}

async function fetchMckinseyMgi() {
  const xml = await fetchText("https://www.mckinsey.com/insights/rss");
  return parseRss("mckinsey-mgi", xml, (block) =>
    /\/mgi\/our-research\/|McKinsey Global Institute|MGI Research/i.test(block),
  ).map((item) => ({ ...item, metric: "MGI research" }));
}

async function fetchApolloDailySpark() {
  const html = await fetchText(
    "https://www.apollo.com/institutional/insights-news/insights/daily-spark",
  );
  const seen = new Set();
  const details = [...html.matchAll(/data-itemDetails=(["'])([\s\S]*?)\1/gi)]
    .flatMap((match) => {
      try {
        return [JSON.parse(decodeEntities(match[2]))];
      } catch {
        return [];
      }
    })
    .filter((detail) => {
      const key = detail.blogId ?? detail.detailLink;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.blogDate ?? 0).getTime() - new Date(a.blogDate ?? 0).getTime())
    .slice(0, 10);

  if (!details.length) throw new Error("Daily Spark article data was not found");

  return details.flatMap((detail, index) => {
    if (!detail.title || !detail.detailLink) return [];
    return [
      makeItem({
        sourceKey: "apollo-daily-spark",
        title: detail.title,
        url: new URL(detail.detailLink, "https://www.apollo.com").toString(),
        publishedAt: detail.blogDate ?? now,
        rank: index + 1,
        metric: cleanText(detail.eyebrowText) || "Daily macro",
        summary: detail.description,
      }),
    ];
  });
}

function htmlAttribute(block, name) {
  const match = block.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function htmlMeta(html, name) {
  const match = html.match(
    new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, "i"),
  );
  return match ? decodeEntities(match[1]) : "";
}

async function fetchBlackRockBii() {
  const [html, weeklyHtml] = await Promise.all([
    fetchText(
      "https://www.blackrock.com/corporate/insights/blackrock-investment-institute/publications",
    ),
    fetchText(
      "https://www.blackrock.com/corporate/insights/blackrock-investment-institute/publications/weekly-commentary",
    ),
  ]);
  const weeklyUrl =
    "https://www.blackrock.com/corporate/insights/blackrock-investment-institute/publications/weekly-commentary";
  const weekly = {
    title: htmlMeta(weeklyHtml, "articleTitle"),
    publishedAt: htmlMeta(weeklyHtml, "publicationDate"),
    summary: htmlMeta(weeklyHtml, "pageSummary"),
  };
  const cards = [
    ...html.matchAll(/<li\b[^>]*class=["'][^"']*article-cntnr[^"']*["'][\s\S]*?<\/li>/gi),
  ].map((match) => match[0]);

  const items = cards.flatMap((card) => {
    const linkTag = card.match(/<a\b[^>]*class=["'][^"']*article-wrapper-link[^"']*["'][^>]*>/i)?.[0];
    const url = linkTag ? htmlAttribute(linkTag, "href") : "";
    const listedTitle = linkTag ? htmlAttribute(linkTag, "title") : "";
    const published = card.match(
      /<div\b[^>]*class=["'][^"']*attribution-text\s+date[^"']*["'][\s\S]*?<span>([\s\S]*?)<\/span>/i,
    )?.[1];
    const description = card.match(
      /<div\b[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1];
    const topics = htmlAttribute(card, "data-topics");
    const isWeekly = canonicalUrl(url) === canonicalUrl(weeklyUrl);
    const title = isWeekly && weekly.title ? weekly.title : listedTitle;
    if (!title || !url) return [];
    return [
      {
        title,
        url,
        publishedAt: isWeekly && weekly.publishedAt ? weekly.publishedAt : cleanText(published),
        metric: topics.split(",")[0] || "BII research",
        summary: isWeekly && weekly.summary ? weekly.summary : cleanText(description),
      },
    ];
  });

  if (!items.length) throw new Error("BlackRock Investment Institute publications were not found");

  return items.slice(0, 10).map((item, index) =>
    makeItem({
      sourceKey: "blackrock-bii",
      ...item,
      publishedAt: item.publishedAt || now,
      rank: index + 1,
    }),
  );
}

function sitecoreValue(field) {
  return field?.jsonValue?.value ?? field?.value ?? "";
}

function sitecoreDate(value) {
  const compact = String(value).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`
    : value;
}

function normalizeImfBlog(entry) {
  const fields = entry?.fields ?? entry;
  const title = sitecoreValue(fields?.Title);
  const publishedAt = sitecoreDate(sitecoreValue(fields?.PublicationDate));
  const rawUrl =
    (typeof entry?.url === "string" ? entry.url : entry?.url?.url ?? entry?.url?.path) ??
    fields?.url?.url ??
    fields?.url?.path;
  const summary = sitecoreValue(fields?.Subtitle) || sitecoreValue(fields?.SubTitle);
  const topic =
    entry?.topic?.targetItem?.title?.value ??
    fields?.topic?.targetItem?.title?.value ??
    fields?.BlogTopic?.fields?.TopicTitle?.value ??
    fields?.BlogTopic?.targetItem?.TopicTitle?.value ??
    "IMF Blog";
  if (!title || !publishedAt || !rawUrl) return null;
  return {
    title,
    publishedAt,
    url: new URL(rawUrl, "https://www.imf.org").toString(),
    metric: topic,
    summary,
  };
}

async function fetchImfBlog() {
  const marker = await fetchTextUnchecked(
    "https://www.imf.org/_next/data/infomap-daily/en/Blogs.json",
  );
  const buildId = marker.match(/"buildId":"([^"]+)"/)?.[1];
  if (!buildId) throw new Error("Current IMF site build ID was not found");

  const [landing, authors] = await Promise.all([
    fetchText(`https://www.imf.org/_next/data/${buildId}/en/Blogs.json`).then(JSON.parse),
    fetchText(`https://www.imf.org/_next/data/${buildId}/en/Blogs/authors.json`).then(JSON.parse),
  ]);
  const landingComponents = Object.values(landing.pageProps?.componentProps ?? {});
  const rawEntries = landingComponents.flatMap((component) => [
    ...(component?.fields?.FeaturedHeroContent ? [component.fields.FeaturedHeroContent] : []),
    ...(component?.blogs ?? []),
    ...(component?.blog ? [component.blog] : []),
    ...(component?.featuredBlog ? [component.featuredBlog] : []),
    ...(component?.firstRowBlogs ?? []),
    ...(component?.secondRowBlogs ?? []),
  ]);
  const authorEntries = Object.values(authors.pageProps?.componentProps ?? {}).flatMap(
    (component) => component?.blogs?.search?.results ?? [],
  );
  const seen = new Set();
  const items = [...authorEntries, ...rawEntries]
    .map(normalizeImfBlog)
    .filter(Boolean)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .filter((item) => {
      const url = canonicalUrl(item.url);
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 10);

  if (!items.length) throw new Error("IMF Blog article data was not found");

  return items.map((item, index) =>
    makeItem({
      sourceKey: "imf-blog",
      ...item,
      rank: index + 1,
    }),
  );
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
  return items.filter((item) => {
    const url = `${item.sourceKey}:${canonicalUrl(item.url)}`;
    if (seenUrls.has(url)) return false;
    seenUrls.add(url);
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
    ["goldman-sachs", fetchGoldmanSachs],
    ["mckinsey-mgi", fetchMckinseyMgi],
    ["apollo-daily-spark", fetchApolloDailySpark],
    ["blackrock-bii", fetchBlackRockBii],
    ["imf-blog", fetchImfBlog],
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

  const scoredItems = deduplicate(collected)
    .map((item) => ({ ...item, score: scoreItem(item) }))
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.rank - b.rank);
  const { items, warnings: translationWarnings } = await addChineseTranslations(scoredItems, {
    previousItems: previous.items,
  });
  const issueDate = singaporeDate(now);
  const sources = SOURCE_DEFINITIONS.map((source) => ({
    key: source.key,
    name: source.name,
    category: source.category,
    categoryZh: source.categoryZh,
    description: source.description,
    descriptionZh: source.descriptionZh,
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
  if (translationWarnings.length) {
    process.stdout.write(`Translation warnings: ${translationWarnings.join(" | ")}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
