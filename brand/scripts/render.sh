#!/usr/bin/env bash
# Regenerates every brand asset: fetch OFL fonts → outline to SVG (build.py) → rasterise PNGs → copy web assets.
# Needs: uv (python + fonttools), rsvg-convert, magick (ImageMagick 7). Run from anywhere.
set -euo pipefail

BRAND="$(cd "$(dirname "$0")/.." && pwd)"
WEB_PUBLIC="$BRAND/../apps/web/public"
export SENRYO_FONT_DIR="${SENRYO_FONT_DIR:-$BRAND/.fonts}"
mkdir -p "$SENRYO_FONT_DIR"

fetch() { # url file
  [ -s "$SENRYO_FONT_DIR/$2" ] || curl -fsSL -o "$SENRYO_FONT_DIR/$2" "$1"
}
fetch https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/ttf/JetBrainsMono-Bold.ttf JetBrainsMono-Bold.ttf
fetch https://raw.githubusercontent.com/google/fonts/main/ofl/zenoldmincho/ZenOldMincho-Black.ttf ZenOldMincho-Black.ttf

cd "$BRAND/scripts"
uv run -q --with fonttools python build.py

cd "$BRAND"
png() { # svg out width [height]
  rsvg-convert -w "$3" ${4:+-h "$4"} -o "$2" "$1"
}
png app-icon.svg app-icon-1024.png 1024 1024
magick app-icon-1024.png -alpha off -define png:color-type=2 app-icon-1024.png # iOS: no alpha channel
png splash.svg splash-1290x2796.png 1290 2796
png logo.svg logo.png 2048
png logo-transparent.svg logo-transparent.png 2048
png kinpaku-card.svg kinpaku-card-1536x969.png 1536 969
png kinpaku-card-back.svg kinpaku-card-back-1536x969.png 1536 969
png senryo-seal.svg senryo-seal-512.png 512 512

mkdir -p "$WEB_PUBLIC/brand"
cp favicon.svg "$WEB_PUBLIC/icon.svg"
rsvg-convert -w 180 -h 180 -o "$WEB_PUBLIC/apple-touch-icon.png" app-icon.svg
cp senryo-seal.svg "$WEB_PUBLIC/brand/seal.svg"
cp senryo-wordmark.svg "$WEB_PUBLIC/brand/wordmark.svg"
cp kinpaku-card.svg "$WEB_PUBLIC/brand/kinpaku-card.svg"
cp kinpaku-card-back.svg "$WEB_PUBLIC/brand/kinpaku-card-back.svg"

ls -la "$BRAND"/*.png
