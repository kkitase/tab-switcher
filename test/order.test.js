import assert from "node:assert/strict";
import { test } from "node:test";
import { moveToFront, orderTabs, removeId } from "../lib/order.js";

const tab = (tabId, windowId, index) => ({
  tabId,
  windowId,
  index,
  title: `タブ ${tabId}`,
  url: `https://example.com/${tabId}`,
});

test("moveToFront は指定した ID を先頭に移し、重複を残さない", () => {
  assert.deepEqual(moveToFront([3, 1, 2], 2), [2, 3, 1]);
  assert.deepEqual(moveToFront([], 5), [5]);
});

test("removeId は指定した ID を取り除く", () => {
  assert.deepEqual(removeId([3, 1, 2], 1), [3, 2]);
  assert.deepEqual(removeId([3], 9), [3]);
});

test("orderTabs は記録順に並べ、記録にないタブを後ろに付ける", () => {
  const tabs = [tab(1, 10, 0), tab(2, 10, 1), tab(3, 20, 0), tab(4, 10, 2)];
  assert.deepEqual(
    orderTabs(tabs, [3, 1]).map((t) => t.tabId),
    [3, 1, 2, 4],
  );
});

test("orderTabs は記録にないタブをウィンドウ ID、タブの並び順の順に並べる", () => {
  const tabs = [tab(5, 20, 0), tab(6, 10, 1), tab(7, 10, 0)];
  assert.deepEqual(
    orderTabs(tabs, []).map((t) => t.tabId),
    [7, 6, 5],
  );
});

test("orderTabs は存在しないタブ ID と重複を無視する", () => {
  const tabs = [tab(1, 10, 0), tab(2, 10, 1)];
  assert.deepEqual(
    orderTabs(tabs, [99, 2, 2, 1]).map((t) => t.tabId),
    [2, 1],
  );
});
