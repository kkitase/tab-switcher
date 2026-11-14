// タブを使った順の記録（タブ ID の配列）と、一覧用の並べ替え

/** id を先頭に移した新しい配列を返す */
export function moveToFront(ids, id) {
  return [id, ...ids.filter((x) => x !== id)];
}

/** id を取り除いた新しい配列を返す */
export function removeId(ids, id) {
  return ids.filter((x) => x !== id);
}

/**
 * 記録にあるタブを記録順に並べ、記録にないタブをウィンドウ ID、タブの並び順の順で後ろに付ける。
 * tabs の各要素は { tabId, windowId, index, title, url }。
 */
export function orderTabs(tabs, mruIds) {
  const byId = new Map(tabs.map((t) => [t.tabId, t]));
  const seen = new Set();
  const ordered = [];
  for (const id of mruIds) {
    const t = byId.get(id);
    if (t && !seen.has(id)) {
      ordered.push(t);
      seen.add(id);
    }
  }
  const rest = tabs
    .filter((t) => !seen.has(t.tabId))
    .sort((a, b) => a.windowId - b.windowId || a.index - b.index);
  return [...ordered, ...rest];
}
