// 一覧の画面。オーバーレイ（ページ上の iframe）と専用ウィンドウで共用する
const isWindow = new URLSearchParams(location.search).has("window");

const listEl = document.getElementById("list");
const backdropEl = document.getElementById("backdrop");

let tabs = [];
let selected = 0;
let ready = false;
let loaded = false;
// 一覧の読み込み中に届いた「次へ」の回数
let queuedNexts = 0;
let altReleased = false;
let committing = false;
let closed = false;

// 一覧が開いている間 background とつないでおき、Option+Q の再押下を「次へ」として受け取る。
// background に受け付けられる（ready が届く）まではタブ一覧を読まない
const port = chrome.runtime.connect({ name: "switcher" });
port.onMessage.addListener((message) => {
  if (message?.type === "ready") {
    ready = true;
    if (message.altReleased) altReleased = true;
    loadTabs().then(() => {
      // 準備中と読み込み中に押された Option+Q の回数だけ進める
      const steps = message.nexts + queuedNexts;
      queuedNexts = 0;
      if (steps > 0) move(steps);
      commitIfReleased();
    });
  } else if (message?.type === "next") {
    if (loaded) move(1);
    else queuedNexts += 1;
  } else if (message?.type === "alt-released") {
    altReleased = true;
    commitIfReleased();
  } else if (message?.type === "close") {
    close();
  }
});
// background との接続が切れたら必ず閉じる。
// 受け付けられなかった（ほかのサイトに埋め込まれた、開くのに時間がかかりすぎた）場合と、
// service worker が止まって以後の依頼に応じてもらえなくなった場合
port.onDisconnect.addListener(close);

document.body.classList.toggle("window", isWindow);

function faviconUrl(pageUrl) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", "32");
  return url.toString();
}

function hostOf(url) {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

function render() {
  listEl.replaceChildren();
  if (tabs.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "タブがありません";
    listEl.append(empty);
    return;
  }
  tabs.forEach((tab, i) => {
    const row = document.createElement("li");
    row.className = "row";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(i === selected));

    const icon = document.createElement("img");
    icon.className = "icon";
    icon.src = faviconUrl(tab.url);
    icon.alt = "";

    const text = document.createElement("div");
    text.className = "text";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = tab.title;
    const host = document.createElement("span");
    host.className = "host";
    host.textContent = hostOf(tab.url);
    text.append(title, host);

    row.append(icon, text);
    row.addEventListener("click", () => {
      selected = i;
      commit();
    });
    listEl.append(row);
  });
  listEl.children[selected]?.scrollIntoView({ block: "nearest" });
}

function move(step) {
  if (tabs.length === 0) return;
  listEl.children[selected]?.setAttribute("aria-selected", "false");
  selected = (selected + step + tabs.length) % tabs.length;
  const row = listEl.children[selected];
  row?.setAttribute("aria-selected", "true");
  row?.scrollIntoView({ block: "nearest" });
}

async function loadTabs() {
  tabs = (await chrome.runtime.sendMessage({ type: "getTabs" })) ?? [];
  // 2 番目（直前のタブ）を選ぶ。1 件だけなら先頭
  selected = Math.max(0, Math.min(1, tabs.length - 1));
  render();
  loaded = true;
}

// Option が離されていて、一覧の準備もできていれば切り替える
function commitIfReleased() {
  if (loaded && altReleased) commit();
}

function close() {
  if (closed) return;
  closed = true;
  port.disconnect();
  if (isWindow) {
    closeOwnWindow();
  } else {
    window.parent.postMessage({ type: "tab-switcher:close" }, "*");
  }
}

// 専用ウィンドウを閉じる。URL の ?window=1 は誰でも付けられるので信用せず、
// 自分が最上位のフレームで、ウィンドウが popup 型のときだけ閉じる
// （ほかのサイトに埋め込まれたときに、ユーザーの通常のウィンドウを閉じないため）
async function closeOwnWindow() {
  try {
    if (window.top !== window) return;
    const current = await chrome.windows.getCurrent();
    if (current.type === "popup") await chrome.windows.remove(current.id);
  } catch {
    // 切り替えでフォーカスが外れたときの blur と重なった場合など。すでに閉じている
  }
}

async function commit() {
  if (committing || closed) return;
  const tab = tabs[selected];
  if (!tab) {
    close();
    return;
  }
  committing = true;
  const result = await chrome.runtime.sendMessage({
    type: "activate",
    tabId: tab.tabId,
    windowId: tab.windowId,
  });
  committing = false;
  if (result?.ok) {
    close();
    return;
  }
  // タブが閉じられていた。一覧を取り直して開いたままにする
  altReleased = false;
  await loadTabs();
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  } else if (event.key === "Enter") {
    event.preventDefault();
    commit();
  } else if (event.altKey && event.code === "KeyQ") {
    // Option+Q がショートカットとしてではなくキー入力として届いた場合
    event.preventDefault();
    move(1);
  }
});

// Option を離したことを取りこぼしても、マウスを動かした時点で Option が押されていなければ離したとみなす
window.addEventListener("pointermove", (event) => {
  // 開いた直後に Chrome が送る疑似イベント（移動量 0）では判定しない
  if (event.movementX === 0 && event.movementY === 0) return;
  if (!event.altKey && !altReleased) {
    altReleased = true;
    commitIfReleased();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "Alt") {
    altReleased = true;
    commitIfReleased();
  }
});

backdropEl.addEventListener("click", close);
window.addEventListener("blur", close);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) close();
});

