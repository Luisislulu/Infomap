import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("exports the Infomap dashboard", async () => {
  const html = await readFile(new URL("out/index.html", root), "utf8");
  assert.match(html, /<title>Infomap — Daily AI &amp; Technology Signals<\/title>/i);
  assert.match(html, /INFOMAP/);
  assert.match(html, /Today(?:&#x27;|')s Ten/);
  assert.match(html, /Source desks/);
  assert.match(html, /Use Mono minimal theme/);
  assert.match(html, /Use Noir black theme/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships current, source-aware data", async () => {
  const data = JSON.parse(await readFile(new URL("public/data/latest.json", root), "utf8"));
  assert.ok(Array.isArray(data.sources));
  assert.ok(Array.isArray(data.items));
  assert.ok(Array.isArray(data.topTen));
  assert.ok(data.sources.length >= 6);
  assert.ok(data.sources.some((source) => source.key === "alpha-xiv"));
  assert.ok(data.items.length >= 20);
  assert.ok(data.topTen.length === 10);
  assert.ok(data.items.every((item) => item.title && item.url && item.sourceKey));
});
