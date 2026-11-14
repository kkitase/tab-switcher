#!/usr/bin/env bash
# Chrome ウェブストアにアップロードする ZIP を dist/ に作る。
# 拡張機能の動作に必要なファイルだけを入れる（docs、test、README などは入れない）。
set -euo pipefail

cd "$(dirname "$0")/.."

version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
out="dist/tab-switcher-${version}.zip"

mkdir -p dist
rm -f "$out"
zip -q -r -X "$out" \
  manifest.json background.js content.js \
  switcher.html switcher.css switcher.js \
  lib/order.js lib/page.js \
  icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png

echo "作成しました: $out"
unzip -l "$out"
