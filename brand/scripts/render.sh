#!/usr/bin/env bash
# Regenerates every brand asset: fetch OFL fonts → outline to SVG (build.py) → rasterise PNGs → copy web assets.
# Needs: uv (Python 3.12 + fonttools), rsvg-convert, magick (ImageMagick 7). Run from anywhere.
set -euo pipefail

BRAND="$(cd "$(dirname "$0")/.." && pwd)"
WEB_PUBLIC="$BRAND/../apps/web/public"
export SENRYO_FONT_DIR="${SENRYO_FONT_DIR:-$BRAND/.fonts}"
mkdir -p "$SENRYO_FONT_DIR"

fetch() { # url file — via a .part file, so a cut-off download is never taken for the font
  [ -s "$SENRYO_FONT_DIR/$2" ] && return
  curl -fsSL --retry 5 --retry-all-errors -C - -o "$SENRYO_FONT_DIR/$2.part" "$1"
  mv "$SENRYO_FONT_DIR/$2.part" "$SENRYO_FONT_DIR/$2"
}
fetch https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/ttf/JetBrainsMono-Bold.ttf JetBrainsMono-Bold.ttf
fetch https://raw.githubusercontent.com/google/fonts/main/ofl/zenoldmincho/ZenOldMincho-Black.ttf ZenOldMincho-Black.ttf

cd "$BRAND/scripts"
uv run -q --no-project --python 3.12 --with fonttools python build.py

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
# The web app's install icons (app/manifest.ts, R2.17): the same app icon at the sizes browsers install with.
rsvg-convert -w 192 -h 192 -o "$WEB_PUBLIC/icon-192.png" app-icon.svg
rsvg-convert -w 512 -h 512 -o "$WEB_PUBLIC/icon-512.png" app-icon.svg
cp senryo-seal.svg "$WEB_PUBLIC/brand/seal.svg"
cp senryo-wordmark.svg "$WEB_PUBLIC/brand/wordmark.svg"

# Mobile app icon, splash seal and Android adaptive foreground (the seal at 600 px centred on a transparent 1024 px
# canvas, inside the adaptive icon's safe zone): the same seal as everywhere else, so they never drift from it.
# android-icon-monochrome.png is a one-colour 千 for themed icons and has no colour to refresh.
MOBILE_IMAGES="$BRAND/../apps/mobile/assets/images"
cp app-icon-1024.png "$MOBILE_IMAGES/icon.png"
cp senryo-seal-512.png "$MOBILE_IMAGES/splash-icon.png"
rsvg-convert -w 600 -h 600 senryo-seal.svg | magick - -background none -gravity center -extent 1024x1024 "$MOBILE_IMAGES/android-icon-foreground.png"

# Original identity art (S1b.3): koban, chōgin, FX pair discs, venue chip → brand/art/; then the J1 artwork that
# composes them (six onboarding scenes, pending-passkey art, completion foil, twelve avatars) → brand/art/onboarding/
# and brand/art/avatars/; then re-pin + regenerate. Contact sheets for review: python3 scripts/sheets.py.
# Python 3.12+: the scene scripts nest quotes inside f-string expressions.
uv run -q --no-project --python 3.12 python scripts/art.py
uv run -q --no-project --python 3.12 python scripts/onboarding.py
(cd "$BRAND/.." && pnpm --filter @senryo/identity codegen --rehash)
# The scenes' flattened copies: the landing's WebPs and the phone story's layers (both drawn from the masters above).
node "$BRAND/../apps/web/scripts/website-art.mjs"
node "$BRAND/../apps/mobile/scripts/onboarding-art.mjs"

ls -la "$BRAND"/*.png
