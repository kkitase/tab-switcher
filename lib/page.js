// ページに一覧を差し込めるかの事前判定

const SCRIPTABLE_PROTOCOLS = ["http:", "https:", "file:"];

/**
 * 差し込みを試す価値のあるページなら、記憶用のキー（プロトコルとホスト）を返す。
 * chrome:// など、拡張機能が差し込めない種類のページや不正な URL なら null を返す。
 */
export function pageKey(url) {
  try {
    const { protocol, host } = new URL(url);
    return SCRIPTABLE_PROTOCOLS.includes(protocol) ? `${protocol}//${host}` : null;
  } catch {
    return null;
  }
}
