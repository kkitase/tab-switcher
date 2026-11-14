# Chrome タブ切り替え拡張機能 設計書

- 作成日: 2026-11-14
- 参考画面: `CS-20261114-140947.png`（macOS のウィンドウ切り替えツールの一覧表示）

## 目的

macOS のウィンドウ切り替えツール（Alt+Tab 系）と同じ感覚で、Chrome のタブを一覧から選んで切り替えられるようにする。

## 前提と制約

- Chrome 拡張機能（Manifest V3）として作る。macOS ネイティブアプリは作らない
- 呼び出せるのは Chrome が前面にあるときだけ。拡張機能は OS の `Cmd+Tab` や `Option+Tab` を横取りできないため、拡張機能に割り当てられるショートカットを使う
- キー選定の経緯: 拡張機能のショートカットに Tab キーは割り当てられない（使えるのは A〜Z、0〜9、Comma、Period、Space、矢印キーなど）。`Command`＋文字は Chrome やウェブアプリ（Google ドキュメントなど）の既存ショートカットとほぼすべて衝突する。いったん `Option+S`（切り替え）と `Option+W`（検索）にしたが、操作を絞るため `Option+Q` の切り替え 1 つにし、検索モードは削除した。ページ上で `Option+Tab` を拾う方法（全サイトに常駐するスクリプト）は、アドレスバーや新しいタブで効かず、全サイトへの権限も必要になるので採らない
- 対象は、拡張機能を入れた Chrome プロファイルで開いている全ウィンドウのタブ。別プロファイルのタブは取得できないので、必要なプロファイルごとに拡張機能を入れる
- 英語（既定）と日本語に対応する。名前、概要、ショートカットの説明、一覧の画面の文言は `_locales/<言語>/messages.json` に置き、Chrome の表示言語で切り替える
- ビルドなしの素の JavaScript で書き、「パッケージ化されていない拡張機能を読み込む」で導入する

## 操作

ショートカットは `Option+Q`（コマンド名 `switch`）の 1 つだけにする。

- `Option+Q` で最近使った順の一覧を出し、2 番目（直前のタブ）を選んだ状態にする
- Option を押したまま `Q` で次へ（末尾の次は先頭に戻る）。逆戻りや矢印キーでの選択は、操作を `Option+Q` だけに絞るため設けない
- Option を離すと選択中のタブに切り替える。`Enter` でも切り替わる。`Esc` で何もせずに閉じる
- すばやく 1 回押して離すと、直前のタブに戻る
- 行をクリックするとそのタブに切り替える
- ショートカットは `chrome://extensions/shortcuts` で変更できる。manifest の初期値は `"mac": "Alt+Q"`、それ以外の OS は `"Alt+Q"`
- Option を押したまま `Q` を繰り返したとき、Chrome がショートカットとして受け取る場合（`background.js` の `chrome.commands.onCommand` に届く）と、iframe のキー入力として届く場合（`keydown` の `code === "KeyQ"` かつ `altKey`）がある。どちらで届いても 1 回の操作として 1 つ進める。どちらになるかは試作の最初に確認する

## 構成

```
chrome-alt-tab/
├── manifest.json
├── background.js        # service worker
├── content.js           # オーバーレイの差し込みと撤去
├── switcher.html        # 一覧画面（オーバーレイと専用ウィンドウで共用）
├── switcher.css
├── switcher.js
├── lib/
│   ├── order.js         # 最近使った順への並べ替え（純粋関数）
│   └── page.js          # 差し込めるページかの事前判定（純粋関数）
├── package.json         # node --test 用（"type": "module" だけ）
└── test/
    ├── order.test.js
    └── page.test.js
```

### manifest.json

- 権限: `tabs`（タイトルと URL の取得）、`storage`（使った順の記録）、`scripting` と `activeTab`（ショートカット操作時に表示中のページへ差し込む）、`favicon`（`chrome-extension://<id>/_favicon/` でファビコンを取得）
- 全サイトへのアクセス権限（host permissions）は付けない。ショートカット操作で `activeTab` の権限が得られるため
- `web_accessible_resources` には `switcher.html` だけを登録する（CSS と JS は拡張機能のページから読むので登録不要）
- `action.default_popup` は設定しない。ページに差し込めないときは、ツールバーのポップアップではなく専用ウィンドウを使う（下の background.js を参照）

### background.js

- 使った順の記録: `chrome.tabs.onActivated` と `chrome.windows.onFocusChanged` でアクティブになったタブ ID を先頭に移す。`chrome.tabs.onRemoved` で削除する。記録はメモリ上のものを正とし、一覧を出すときに保存の完了を待たない。service worker は止まることがあるので、復元用に `chrome.storage.session` にも書き出す
- ショートカットの受け取り: `chrome.commands.onCommand` で `switch` を受け取る
  - 一覧がまだ開いていなければ、アクティブなタブに `chrome.scripting.executeScript` で `content.js` を差し込み、続けて `window.__tabSwitcherOpen(mode)` を呼ぶ
  - 差し込む前に `lib/page.js` の `pageKey` で URL を確かめ、`http`、`https`、`file` 以外なら差し込みを試さない。管理ポリシーで禁止されたページは、一度失敗したらプロトコルとホストをメモリに覚え、次からは試さない（どちらも専用ウィンドウを早く開くため）
  - 差し込みに失敗したら（`chrome://` ページ、Chrome ウェブストア、管理ポリシー ExtensionSettings の `runtime_blocked_hosts` で禁止されたサイトなど）、`chrome.windows.create({ type: "popup" })` で `switcher.html?mode=...&window=1` を開く。大きさは 680×520 で、ショートカットを押したウィンドウの中央に置く
  - 経緯: 当初はツールバーのポップアップ（`chrome.action.openPopup()`）にしていたが、企業などで管理されている Chrome では、管理ポリシーで特定のサイトへの差し込みが禁止されていることがあり、ページによって一覧が中央に出たり右上に出たりした。表示位置をそろえるため、専用ウィンドウに変えた
  - すでに一覧が開いていて `switch` が届いたら、一覧に「次へ」を送る。一覧が開いているかどうかは、一覧の画面が `chrome.runtime.connect({ name: "switcher" })` でつないだ port があるかで判断し、「次へ」もこの port で送る
  - 開き始めてから一覧の画面がつながるまで（最大 2 秒）に `switch` が届いたら、二重に開かず回数だけ数える。つながったときに `{ type: "ready", nexts, altReleased }` でまとめて渡す
- 受け付ける相手（ほかのサイトに `switcher.html` を埋め込まれて悪用されないため）:
  - port は、開き始めた直後（2 秒以内）で、Option+Q を押したタブの中の iframe か、専用ウィンドウの最上位フレームからのものだけを受け付ける。それ以外はすぐ切断する
  - `getTabs` と `activate` は、受け付けた port と同じ文書（`sender.documentId`）からの依頼にだけ応じる
- 切り替え: 一覧から `{ type: "activate", tabId, windowId }` を受け取ったら、`chrome.tabs.update(tabId, { active: true })` と `chrome.windows.update(windowId, { focused: true })` を実行する
- 一覧用データ: 一覧から `{ type: "getTabs" }` を受け取ったら、全ウィンドウのタブを `lib/order.js` で並べて返す。各タブは `{ tabId, windowId, index, title, url }`。Option+Q を押したタブ（`onCommand` の `tab`）は必ず先頭にする（専用ウィンドウではフォーカスが一覧側に移るため、最後にフォーカスしたウィンドウからは求めない）

### content.js

- ページの最前面に、画面全体を覆う透明な iframe（`switcher.html`）を差し込む。iframe の読み込みが終わったらフォーカスを移す。土台（一覧の外側）とパネルは iframe の中の画面が描く
- iframe 要素と `switcher.css` の `:root` には、同じ `color-scheme: light dark` を指定する（値がそろっていないと iframe の背景が不透明になる）
- 同じページに 2 回差し込まれても二重に表示しない
- 差し込んだ直後からページ側でも Option の `keyup` を監視し、iframe にフォーカスが移る前に離された場合は、`chrome.runtime.sendMessage({ type: "alt-released" })` で background に伝える。background は一覧の port に転送する（すばやく 1 回押したときの取りこぼし対策）。ページのスクリプトから偽装されないよう、`postMessage` は使わない
- 一覧から `postMessage` で閉じる指示を受けたら、送信元が自分の iframe であることを確かめて iframe を取り除く

### switcher.html / switcher.css / switcher.js

- 起動時に background と port をつなぎ、`ready` を受け取ってから `getTabs` で一覧を取得して描画する。port が切れたら（受け付けられなかった、service worker が止まった）必ず自分を閉じる
- 専用ウィンドウを閉じるのは、自分が最上位のフレームで、ウィンドウが popup 型のときだけ。URL の `?window=1` は誰でも付けられるので信用しない（ほかのサイトに埋め込まれたときに、ユーザーの通常のウィンドウを閉じないため）
- content.js が拾う Option の `keyup` は、本物のキー入力（`isTrusted`）だけを扱う
- 各行: ファビコン（`chrome-extension://<id>/_favicon/?pageUrl=...` から取得）、タイトル、ドメイン（グレー）。タイトルが長いときは末尾を省略する
- 選択中の行は青枠と薄い青の背景で強調する（参考画面と同じ）
- Alt+Tab モードでは `keyup` で Option（`Alt`）が離されたことを検知して切り替える
- 閉じる条件: 決定、`Esc`、土台（一覧の外側）のクリック、ウィンドウからフォーカスが外れたとき、タブが非表示になったとき
- 色、フォント、余白は DESIGN.md のトークンに従う。OS のダークモード設定にも合わせる

### lib/order.js

- `orderTabs(tabs, mruTabIds)`: 使った順の記録にあるタブを記録順に並べ、記録にないタブをウィンドウ ID、タブの並び順の順で後ろに付ける。記録にあるが存在しないタブ ID は無視する

## 例外時の扱い

- 切り替える前にタブが閉じられていた場合: `chrome.tabs.update` の失敗を受けて一覧を取り直し、閉じずに表示を更新する
- 差し込みも専用ウィンドウも開けない場合（フォーカスされた Chrome ウィンドウがないなど）: 何もしない
- 専用ウィンドウのタブは一覧に出さない（`windowType: "normal"` のタブだけを対象にする）
- 一覧が 1 件だけの場合: Alt+Tab モードでも先頭を選び、決定しても何も変わらない
- 一覧が別のタブに取り残されている場合: そのタブ以外で `Option+Q` を押したら、port で古い一覧に閉じる指示を送り、新しい一覧を開く
- 一覧を閉じたとき: 開く前にフォーカスがあった要素へフォーカスを戻す
- ページの DOM の作り直しなどで iframe が外れていた場合: 片付けてから開き直す

**仕組み上の限界**

- すばやく押して離すと、`content.js` が Option の監視を始める前に離されることがある（service worker の起動と差し込みに時間がかかるため）。差し込みに `injectImmediately` を使って時間を縮め、それでも取りこぼした場合は、マウスを動かした時点で Option が押されていなければ離したとみなす。マウスも動かさなければ一覧は開いたままなので、Enter キーで切り替えるか、Esc キーで閉じる（Option キーをもう一度押して離しても切り替わる）
- アドレスバーやデベロッパー ツールにフォーカスがあるとき、フォーカスを取り戻すページ（Google ドキュメントなど）、モーダルの `<dialog>` やフルスクリーン表示中のページでは、iframe にキー入力が届かなかったり、すぐ閉じたりすることがある。手動確認で挙動を確かめる

## テスト

- 単体テスト: `lib/order.js` と `lib/page.js` を `node --test` で確認する
- 手動の確認リスト:
  1. 通常のページで `Option+Q` を押すと、中央に一覧が出て直前のタブが選ばれている
  2. Option を押したまま `Q` を繰り返すと 1 つずつ進み、末尾の次は先頭に戻る
  3. Option を離すと選択中のタブに切り替わる。別ウィンドウのタブならそのウィンドウが前面に出る
  4. すばやく 1 回押すと直前のタブに戻り、もう一度押すと元のタブに戻る
  5. Option の離しを取りこぼして一覧が開いたままのとき、`Enter` で切り替わる
  6. `chrome://extensions` や、管理ポリシーで差し込みが禁止されたサイトでは、ウィンドウの中央に専用ウィンドウが開き、同じ操作ができる。一覧に専用ウィンドウ自身は出ない
  7. `Esc` と一覧の外側のクリックで閉じ、ページに何も残らない

## 作らないもの

- 別プロファイルのタブの表示
- Chrome 以外のアプリからの呼び出し
- タブを閉じる、移動するなどの一覧からの操作
- 設定画面（キーの変更は Chrome 標準の画面で行う）
