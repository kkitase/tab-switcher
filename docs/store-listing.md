# Chrome ウェブストア掲載情報

Chrome ウェブストアのデベロッパー ダッシュボードに入力する内容の下書きです。コード ブロックの中身をそのまま貼り付けられるようにしています。

## パッケージ

アップロードする ZIP は、次のコマンドで `dist/` に作ります。更新を出すときは、先に `manifest.json` の `version` を上げてください。

```bash
./scripts/package.sh
```

## ストアの掲載情報（Store listing）

名前と概要は `_locales/<言語>/messages.json` の `extName` と `extDescription` が使われます。1.0.1 から英語（既定）と日本語に対応しているので、ダッシュボードでは言語ごとに詳細な説明を入力します。英語の説明文は `store/text/description-en.txt`、日本語は `store/text/description.txt` です。カテゴリと画像は言語に関係なく共通です。

**名前**

```text
Tab Switcher
```

**概要**（`manifest.json` の `description`。132 文字以内）

```text
Option+Q で、Chrome のタブを最近使った順の一覧から切り替える
```

**詳細な説明**

```text
macOS の Alt+Tab 系のウィンドウ切り替えツールと同じ感覚で、Chrome のタブを切り替えられる拡張機能です。

■ 使い方
・Option+Q（Windows では Alt+Q）を押すと、最近使った順にタブの一覧が出て、直前のタブが選ばれた状態になります。
・Option を押したまま Q を押すたびに次のタブへ移り、Option を離すとそのタブに切り替わります。
・すばやく 1 回押すだけなら、直前のタブに戻ります。2 つのタブを行き来するときに便利です。
・一覧の行をクリックしても切り替えられます。Esc キーか一覧の外側をクリックすると、何もせずに閉じます。

■ 特長
・開いているすべてのウィンドウのタブが一覧に出ます。別のウィンドウのタブを選ぶと、そのウィンドウごと前面に出ます。
・一覧は、表示中のページの中央に重ねて表示します。chrome:// で始まるページなど、拡張機能が操作できないページでは、代わりに小さなウィンドウを中央に開きます。
・ツールバーのアイコンを押すと、いまのショートカットと使い方を確認できます。ショートカットは chrome://extensions/shortcuts で変更できます。
・ライトモードとダークモードに対応しています。

■ プライバシー
タブのタイトルと URL は、一覧を表示するためにブラウザの中でだけ使い、外部のサーバーには一切送信しません。
```

**カテゴリ**: 仕事効率化（Productivity）の中の「ツール」

**言語**: 英語（既定）と日本語

**画像**

| 種類 | サイズ | 必須 | 内容 |
|---|---|---|---|
| ストア アイコン | 128×128 | 必須 | `icons/icon-128.png`（ZIP にも同じものが入っている） |
| スクリーンショット | 1280×800 | 1 枚以上 | 下の「スクリーンショットの候補」を参照 |
| プロモーション タイル（小） | 440×280 | 任意 | `store/promo-small.png`。ないと検索結果で後ろに回される |

アップロードするスクリーンショットは、英語版が `store/en/`、日本語版が `store/ja/` にある 5 枚ずつ（1280×800）です。言語ごとに画像を登録できない場合は、全言語向けに英語版を使います。

| # | 見出し（英語 / 日本語） | 図 |
|---|---|---|
| 1 | Alt+Tab for your Chrome tabs / Chrome のタブを Alt+Tab の感覚で | 一覧が出た画面 |
| 2 | Hold Option and press Q to move / Option を押したまま Q で次へ | 選択が下に移った画面 |
| 3 | Release Option to switch / Option を離すと切り替わる | 切り替わったあとの画面 |
| 4 | Tabs from every window / すべてのウィンドウのタブが並ぶ | 2 つのウィンドウのタブが並ぶ一覧 |
| 5 | Check your shortcut anytime / ショートカットはアイコンで確認 | ツールバーのポップアップ |

図は実際の画面を模したイラストで、タブ名などの文字は灰色の線で表しています。実際の画面を撮ってストアのサイズにそろえるときは、`scripts/store-screenshot.sh` を使います。

## プライバシーへの取り組み（Privacy practices）

審査で特に見られる欄です。権限ごとに、なぜ必要かを具体的に書きます。

**単一用途**

```text
キーボード ショートカットで、開いている Chrome のタブを最近使った順の一覧から選び、切り替えます。
```

**権限が必要な理由**

| 権限 | 入力する文 |
|---|---|
| `tabs` | 一覧に表示するため、開いているすべてのタブのタイトルと URL を取得します。 |
| `storage` | タブを最近使った順に並べるため、アクティブになったタブの ID を chrome.storage.session に記録します。記録はブラウザを閉じると消え、外部には送信しません。 |
| `scripting` | ショートカットが押されたとき、表示中のページに一覧を重ねて表示するスクリプトを差し込みます。 |
| `activeTab` | ショートカットが押されたタブにだけ、一覧を表示するスクリプトを差し込みます。すべてのサイトへのアクセス権限は要求しません。 |
| `favicon` | 一覧の各行に、タブのサイトのアイコンを表示します。 |

**リモートコードの使用**: いいえ（すべてのコードは拡張機能のパッケージに含まれています）

**データの使用**: 「ウェブ履歴」にだけチェックを入れ、次の 3 つの宣言にはすべてチェックを入れます。ウェブストアの FAQ では、外部に送らず端末の中だけで扱うデータも申告が必要とされています。タブのタイトルと URL は「ウェブ履歴」（アクセスしたページのリストとタイトル）に当たります。

- 承認されている用途以外で、ユーザーデータを第三者に販売、譲渡しない
- 拡張機能の単一用途と関係のない目的で、ユーザーデータを使用、譲渡しない
- 信用力の判断や融資の目的で、ユーザーデータを使用、譲渡しない

**プライバシー ポリシー**: ユーザーデータ（ウェブ履歴）を扱うので必要です。本文はリポジトリ直下の `PRIVACY.md` で、URL は https://github.com/kkitase/tab-switcher/blob/main/PRIVACY.md です。

## 審査担当者向けのテスト手順（Test instructions）

審査担当者は英語で読むので、英語で書きます。

```text
No account or setup is required.

1. Open several tabs in one or more Chrome windows (for example, https://example.com and https://www.wikipedia.org).
2. On a regular web page, press Alt+Q (Option+Q on macOS). A list of tabs in most-recently-used order appears in the center of the page, with the previous tab selected.
3. Keep holding Alt (Option) and press Q again to move the selection. Release Alt (Option) to switch to the selected tab.
4. On pages where extensions cannot run scripts (for example, chrome://extensions), the same list opens in a small window in the center of the current window.

If the shortcut is not assigned because of a conflict, set it at chrome://extensions/shortcuts.
```

## 公開範囲（Distribution）

自分や同僚が使うだけなら「限定公開」（URL を知っている人だけがインストールできる）がおすすめです。誰でも検索して見つけられるようにするなら「公開」を選びます。
