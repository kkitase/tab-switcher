// タブを使った順の記録、ショートカットの受け取り、一覧の表示、タブの切り替え
import { moveToFront, orderTabs, removeId } from "./lib/order.js";
import { pageKey } from "./lib/page.js";

// 使った順の記録はメモリ上のものを正とし、一覧を出すときに書き込みの完了を待たない。
// storage.session には、service worker が止まって起き直したときの復元用に書き出しておく。
let mru = [];
const mruLoaded = chrome.storage.session
  .get("mru")
  .then(({ mru: saved = [] }) => {
    mru = saved;
  })
  .catch((error) => console.error("使った順の記録を読み込めませんでした", error));

async function updateMru(change) {
  // 読み込み前に届いたイベントも、届いた順に読み込み後の記録へ反映される
  await mruLoaded;
  mru = change(mru);
  chrome.storage.session
    .set({ mru })
    .catch((error) => console.error("使った順の記録を保存できませんでした", error));
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateMru((ids) => moveToFront(ids, tabId));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  updateMru((ids) => removeId(ids, tabId));
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) updateMru((ids) => moveToFront(ids, tab.id));
  } catch {
    // フォーカス直後にウィンドウが閉じられた場合など。記録しないだけでよい
  }
});

// 一覧の状態。
// pending: Option+Q で開き始めてから、一覧の画面がつながるまで。この間に押された回数と Option の離しを覚える
// session: 一覧の画面がつながってから閉じるまで。受け付けた画面の port を持つ
// どちらにも当たらない画面（ほかのサイトに埋め込まれた switcher.html など）からの接続や依頼は受け付けない。
const PENDING_TIMEOUT_MS = 2000;
let pending = null;
let session = null;

function isPendingActive() {
  return pending !== null && Date.now() - pending.startedAt < PENDING_TIMEOUT_MS;
}

function isSessionSender(sender) {
  return (
    session !== null &&
    sender.documentId !== undefined &&
    sender.documentId === session.port.sender.documentId
  );
}

async function getOrderedTabs(sourceTabId) {
  await mruLoaded;
  // 一覧用の専用ウィンドウ（type: "popup"）のタブは含めない
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  // Option+Q を押したタブを必ず先頭にする（専用ウィンドウではフォーカスが一覧側に移っているため）
  const ids = sourceTabId !== undefined ? moveToFront(mru, sourceTabId) : mru;
  const items = tabs.map((t) => ({
    tabId: t.id,
    windowId: t.windowId,
    index: t.index,
    title: t.title || t.url || "",
    url: t.url || "",
  }));
  return orderTabs(items, ids);
}

async function activateTab(tabId, windowId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(windowId, { focused: true });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // content.js から: iframe の準備ができる前に Option が離された
  if (message?.type === "alt-released") {
    if (session && session.port.sender.tab?.id === sender.tab?.id) {
      session.port.postMessage({ type: "alt-released" });
    } else if (isPendingActive() && pending.sourceTabId === sender.tab?.id) {
      pending.altReleased = true;
    }
    return false;
  }
  if (!isSessionSender(sender)) return false;
  if (message?.type === "getTabs") {
    getOrderedTabs(session.sourceTabId).then(sendResponse);
    return true;
  }
  if (message?.type === "activate") {
    activateTab(message.tabId, message.windowId).then(sendResponse);
    return true;
  }
  return false;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "switcher") return;
  // 受け付けるのは、開き始めた直後の一覧だけ。
  // ページに重ねた一覧は Option+Q を押したタブの中の iframe、専用ウィンドウの一覧は最上位のフレーム
  const fromSourceTab = port.sender.tab?.id === pending?.sourceTabId && port.sender.frameId !== 0;
  const fromSwitcherWindow = port.sender.frameId === 0;
  if (!isPendingActive() || !(fromSourceTab || fromSwitcherWindow)) {
    port.disconnect();
    return;
  }
  session = { port, sourceTabId: pending.sourceTabId };
  port.onDisconnect.addListener(() => {
    if (session?.port === port) session = null;
  });
  // 準備中に押された回数と Option の離しをまとめて渡す
  port.postMessage({ type: "ready", nexts: pending.nexts, altReleased: pending.altReleased });
  pending = null;
});

const SWITCHER_WINDOW_SIZE = { width: 680, height: 520 };

// ページに差し込めないときは、今のウィンドウの中央に一覧だけの小さなウィンドウを開く
async function openSwitcherWindow(windowId) {
  const url = chrome.runtime.getURL("switcher.html?window=1");
  const { width, height } = SWITCHER_WINDOW_SIZE;
  try {
    const base =
      windowId !== undefined ? await chrome.windows.get(windowId) : await chrome.windows.getLastFocused();
    await chrome.windows.create({
      url,
      type: "popup",
      focused: true,
      width,
      height,
      left: Math.round(base.left + (base.width - width) / 2),
      top: Math.round(base.top + (base.height - height) / 2),
    });
  } catch {
    // ウィンドウが画面の端にあり、中央の位置が画面外にはみ出す場合など。位置を指定せずに開き直す
    await chrome.windows.create({ url, type: "popup", focused: true, width, height });
  }
}

// 差し込めないとわかったページ（プロトコルとホスト）。2 回目からは差し込みを試さず、すぐに専用ウィンドウを開く
const unscriptablePages = new Set();

async function openSwitcher(tab) {
  pending = { startedAt: Date.now(), sourceTabId: tab?.id, nexts: 0, altReleased: false };
  const key = pageKey(tab?.url || tab?.pendingUrl);
  if (tab?.id !== undefined && key && !unscriptablePages.has(key)) {
    try {
      // injectImmediately で差し込みまでの時間を縮め、すばやく押して離したときの取りこぼしを減らす
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
        injectImmediately: true,
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__tabSwitcherOpen(),
        injectImmediately: true,
      });
      return;
    } catch (error) {
      // Chrome ウェブストアや、管理ポリシー（ExtensionSettings）で拡張機能の操作が禁止されたページなど。
      // 想定内なので、エラーではなく情報として残し、専用ウィンドウで開く
      const message = error?.message ?? "";
      if (message.includes("cannot be scripted")) unscriptablePages.add(key);
      console.info("ページに差し込めないため、専用ウィンドウで開きます", tab.url, message);
    }
  }
  try {
    await openSwitcherWindow(tab?.windowId);
  } catch (error) {
    pending = null;
    console.error("一覧を開けませんでした", error);
  }
}

chrome.commands.onCommand.addListener((_command, tab) => {
  // 一覧が開いていれば次へ進める。専用ウィンドウにフォーカスがあるときは、tab がその一覧自身のタブになる
  if (session && session.port.sender.tab?.id === tab?.id) {
    session.port.postMessage({ type: "next" });
    return;
  }
  // 開いている途中なら、押された回数だけ覚えておく（二重に開かない）
  if (isPendingActive()) {
    pending.nexts += 1;
    return;
  }
  // 別のタブに取り残された一覧があれば閉じてから、新しく開く
  try {
    session?.port.postMessage({ type: "close" });
  } catch {
    // すでに切れている port。閉じる相手がいないだけなので無視する
  }
  session = null;
  openSwitcher(tab);
});
