#!/usr/bin/env bash
# スクリーンショットを Chrome ウェブストアのサイズ（1280×800）にそろえる。
# 縦横比を保ったまま縮小し、余白は背景色で埋める（切り抜かない）。
# 使い方: ./scripts/store-screenshot.sh 入力.png 出力.png [背景色]
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "使い方: $0 入力.png 出力.png [背景色（既定: #F8F9FA）]" >&2
  exit 1
fi

magick "$1" -resize 1280x800 -background "${3:-#F8F9FA}" -gravity center -extent 1280x800 \
  -alpha remove -alpha off "PNG24:$2"
echo "作成しました: $2（1280×800）"
