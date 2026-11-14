import assert from "node:assert/strict";
import { test } from "node:test";
import { pageKey } from "../lib/page.js";

test("http と https のページはプロトコルとホストを返す", () => {
  assert.equal(pageKey("https://policies.google.com/terms?hl=ja"), "https://policies.google.com");
  assert.equal(pageKey("http://localhost:3000/a"), "http://localhost:3000");
});

test("file のページは file: を返す", () => {
  assert.equal(pageKey("file:///Users/me/a.html"), "file://");
});

test("差し込めない種類のページは null を返す", () => {
  assert.equal(pageKey("chrome://extensions/"), null);
  assert.equal(pageKey("chrome-extension://abc/switcher.html"), null);
  assert.equal(pageKey("about:blank"), null);
  assert.equal(pageKey("view-source:https://example.com/"), null);
});

test("URL が空や不正なら null を返す", () => {
  assert.equal(pageKey(""), null);
  assert.equal(pageKey(undefined), null);
  assert.equal(pageKey("not a url"), null);
});
