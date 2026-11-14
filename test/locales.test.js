import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const load = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const en = JSON.parse(load("../_locales/en/messages.json"));
const ja = JSON.parse(load("../_locales/ja/messages.json"));
const manifest = JSON.parse(load("../manifest.json"));

test("en と ja のメッセージの項目がそろっている", () => {
  assert.deepEqual(Object.keys(ja).sort(), Object.keys(en).sort());
});

test("manifest で使うメッセージが、すべての言語で定義されている", () => {
  const keys = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]);
  assert.ok(keys.length > 0);
  for (const key of keys) {
    assert.ok(en[key]?.message, `en に ${key} がない`);
    assert.ok(ja[key]?.message, `ja に ${key} がない`);
  }
});

test("一覧の画面で使うメッセージが、すべての言語で定義されている", () => {
  const source = load("../switcher.js");
  const keys = [...source.matchAll(/getMessage\("(\w+)"\)/g)].map((m) => m[1]);
  assert.ok(keys.length > 0);
  for (const key of keys) {
    assert.ok(en[key]?.message, `en に ${key} がない`);
    assert.ok(ja[key]?.message, `ja に ${key} がない`);
  }
});

test("既定の言語が英語で、概要がストアの上限（132 文字）に収まる", () => {
  assert.equal(manifest.default_locale, "en");
  for (const messages of [en, ja]) {
    assert.ok(messages.extDescription.message.length <= 132);
  }
});
