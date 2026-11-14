// 表示中のページに一覧の iframe を重ね、閉じる指示で取り除く。
// background.js から何度差し込まれても、初期化は 1 回だけ行う。
(() => {
  if (window.__tabSwitcherOpen) return;

  const extensionOrigin = new URL(chrome.runtime.getURL("")).origin;
  let frame = null;
  let previousFocus = null;
  let altReleaseSent = false;

  // iframe にフォーカスが移る前に Option が離されたら、background 経由で一覧に知らせる。
  // ページのスクリプトから偽装されないよう、postMessage ではなく拡張機能の内部メッセージを使う
  function onKeyUp(event) {
    // ページのスクリプトが作った偽のキー イベントは無視する
    if (!event.isTrusted || event.key !== "Alt" || altReleaseSent) return;
    altReleaseSent = true;
    chrome.runtime.sendMessage({ type: "alt-released" }).catch(() => {});
  }

  function close() {
    if (!frame) return;
    frame.remove();
    frame = null;
    window.removeEventListener("keyup", onKeyUp, true);
    // 開く前に入力していた欄へフォーカスを戻す
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  window.addEventListener("message", (event) => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== extensionOrigin) return;
    if (event.data?.type === "tab-switcher:close") close();
  });

  window.__tabSwitcherOpen = () => {
    // background がここを呼ぶのは、このタブに使える一覧がないときだけ。
    // 古い一覧（service worker が止まって応答しなくなったもの、DOM から外れたもの）が残っていれば作り直す
    if (frame) close();
    previousFocus = document.activeElement;
    altReleaseSent = false;
    window.addEventListener("keyup", onKeyUp, true);

    const f = document.createElement("iframe");
    f.src = chrome.runtime.getURL("switcher.html");
    // ページの CSS に負けないよう !important で固定する。
    // color-scheme を switcher.css と同じ light dark にそろえ、ページの配色に関係なく iframe の背景を透明に保つ。
    f.setAttribute(
      "style",
      [
        "position: fixed",
        "inset: 0",
        "width: 100vw",
        "height: 100vh",
        "max-width: none",
        "max-height: none",
        "margin: 0",
        "padding: 0",
        "border: 0",
        "display: block",
        "background: transparent",
        "color-scheme: light dark",
        "z-index: 2147483647",
      ]
        .map((rule) => `${rule} !important`)
        .join("; "),
    );
    f.addEventListener("load", () => {
      if (frame === f) f.focus();
    });
    frame = f;
    document.documentElement.append(f);
  };
})();
