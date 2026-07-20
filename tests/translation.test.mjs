import assert from "node:assert/strict";
import test from "node:test";
import { addChineseTranslations } from "../scripts/translate-items.mjs";

test("reuses translations and translates only missing titles", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            translations: [
              { id: "hn-new", titleZh: "新的技术消息" },
              { id: "github-repo", titleZh: "被翻译的仓库名", summaryZh: "代码智能体" },
            ],
          }),
        },
      }],
    }), { status: 200 });
  };
  const items = [
    { id: "hn-old", title: "Existing story", sourceKey: "hacker-news" },
    { id: "hn-new", title: "New technology story", sourceKey: "hacker-news" },
    {
      id: "github-repo",
      title: "openai / codex",
      summary: "Coding agent",
      sourceKey: "github",
    },
  ];

  const result = await addChineseTranslations(items, {
    previousItems: [{
      id: "hn-old",
      title: "Existing story",
      titleZh: "已有消息",
      sourceKey: "hacker-news",
    }],
    token: "test-token",
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].messages.at(-1).content, JSON.stringify([
    { id: "hn-new", title: "New technology story" },
    { id: "github-repo", title: "openai / codex", summary: "Coding agent" },
  ]));
  assert.equal(result.items[0].titleZh, "已有消息");
  assert.equal(result.items[1].titleZh, "新的技术消息");
  assert.equal(result.items[2].titleZh, "openai / codex");
  assert.equal(result.items[2].summaryZh, "代码智能体");
  assert.deepEqual(result.warnings, []);
});

test("falls back cleanly when no model token is available", async () => {
  const result = await addChineseTranslations([
    { id: "one", title: "Original title", sourceKey: "hacker-news" },
  ], { token: "" });

  assert.equal(result.items[0].titleZh, undefined);
  assert.equal(result.warnings.length, 1);
});
