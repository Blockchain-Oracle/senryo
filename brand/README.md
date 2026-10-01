# Brand — Senryo 千両 · Kinpaku 金箔

Senryo (千両, "a thousand ryō") is the app; Kinpaku (金箔, "gold leaf") is the card (D-003, D-049). The look is the D2 Desk terminal (D-004): black, one warm gold, JetBrains Mono. Every glyph is outlined to vector paths, so no SVG here contains a `<text>` element or depends on installed fonts.

## Assets

| File | Use | Size |
|---|---|---|
| `senryo-seal.svg` | Primary mark: square 角印 seal, gold field, carved double border (heavy + hairline), carved 千 | 512 × 512 viewBox |
| `senryo-seal-inverse.svg` | Seal on dark UI where a gold block is too loud: black field, gold carving, gold edge | 512 |
| `senryo-seal-mono.svg` | One-colour outline seal (`#f5f5f5` on transparent) for watermarks and embossing | 512 |
| `senryo-seal-512.png` | Raster of the primary seal | 512 × 512 |
| `favicon.svg` | Simplified seal (no borders, heavier glyph) for 16–64 px | 64 viewBox |
| `senryo-wordmark.svg` / `-ink.svg` | `SENRYO`, JetBrains Mono Bold, tracking −10 units: light for dark grounds, ink for light | cap height 100 |
| `senryo-lockup.svg` / `-ink.svg` | Seal + wordmark. Seal edge = 1.9 × cap height, gap = 0.55 × cap | — |
| `app-icon.svg`, `app-icon-1024.png` | iOS/Android icon: seal at 58 % on black, **opaque RGB** (App Store rejects alpha) | 1024 × 1024 |
| `splash.svg`, `splash-1290x2796.png` | Launch screen: black, seal 240 + wordmark cap 56, centred | 1290 × 2796 |
| `logo.png`, `logo-transparent.png` (+ `.svg`) | Submission logo (≤ 3 MB; actual ≈ 33 KB) | 2048 × 881 |
| `kinpaku-card.svg`, `kinpaku-card-1536x969.png` | Card front: lacquer black, a field of gold-leaf sheets torn along one edge, flakes drifting into the black, the seal stamped on the leaf, `KINPAKU` / `金箔` top right, `SENRYO` pressed into the leaf. **Bottom right is left empty for the network mark.** | ISO ID-1 85.6 × 54 mm → 856 × 540 viewBox |
| `kinpaku-card-back.svg`, `kinpaku-card-back-1536x969.png` | Card back: a torn leaf band where a magstripe sits, mono seal, quiet type | same |

### Identity art (`art/`, S1b.3 first-pass masters, pending design review — B12)

Written by `scripts/art.py` (deterministic, no fonts: the 千 is the seal's own outlined glyph). Gradients, clip paths,
masks and opacity only, so react-native-svg draws them exactly; ids are prefixed per file. Each file is registered with
its sha256 in `packages/identity/src/art/originals.ts` (invariant `identity-provenance`).

| File | Use |
|---|---|
| `art/xau-koban.svg` / `-disc.svg` | XAU: gold koban with hammer lines, kiri stamps and an embossed 千; the disc variant sits on a lacquer plate with a gold rim. Never Tether Gold. |
| `art/xag-chogin.svg` / `-disc.svg` | XAG: cast silver chōgin bar with ripples and a 千 stamp; same viewpoint and optical scale as the koban. |
| `art/fx-{eur,gbp,jpy,chf,cad}-usd.svg` | FX pair discs: base-currency flag overlapped by the US flag (public-domain Commons files in `packages/identity/sources/flag-*`); the pair text is always shown beside them. |
| `art/senryo-venue.svg` | Senryo venue chip: the simplified seal geometry through the gold-leaf ramp, carved lacquer 千. |

`render.sh` also writes `apps/mobile/assets/images/kinpaku-card.png` (the card face; its grain filter doesn't draw in
react-native-svg) and re-runs `art.py` + the identity codegen.

Copied into the web app by `render.sh`: `apps/web/public/icon.svg` (favicon), `apps/web/public/apple-touch-icon.png` (180 × 180), `apps/web/public/brand/{seal,wordmark,kinpaku-card,kinpaku-card-back}.svg`.

## Colour (from `packages/tokens`)

| Role | Value | Token |
|---|---|---|
| Seal gold | `#fbe10f` | `KINPAKU.foilMid` (the warm end of the D2 gold family; `DARK.gold #fbfb0f` reads lemon at icon size) |
| Ground / carving | `#000000` | `DARK.background` |
| Wordmark light | `#f5f5f5` | `DARK.foreground` |
| Card lacquer / edge | `#070707` / `#1a1a1a` | `KINPAKU.lacquer` / `KINPAKU.lacquerEdge` |
| Foil stops | `#fffbd6` `#fff27a` `#fbe10f` `#c9a800` `#6e5700` | `KINPAKU.foilHighlight … foilDeep` |

Change a colour in `packages/tokens/src/marks.ts` first, then mirror it in `scripts/build.py` and re-render.

## Usage rules
- **Clear space:** half the seal's edge on every side of the seal or lockup. The wordmark alone takes one cap height.
- **Minimum size:** full seal 24 px (below that use `favicon.svg`), lockup 96 px wide, wordmark cap height 9 px.
- Don't recolour the seal outside the three variants, don't add shadows, gradients or outlines, don't rotate or stretch, and don't set 千 in a live font as a substitute.
- On gold or busy imagery use the inverse seal. The seal sits left of the wordmark and never above it, except on the splash.
- The card art carries no card number or name. The app renders those over the art (right half, above the network-mark area).

## Fonts and licences
- **JetBrains Mono Bold** (wordmark, `KINPAKU`): SIL Open Font License 1.1, from https://github.com/JetBrains/JetBrainsMono.
- **Zen Old Mincho Black** (千, 金箔): SIL Open Font License 1.1, from https://github.com/google/fonts/tree/main/ofl/zenoldmincho. Chosen over macOS system mincho fonts (Hiragino, Songti), which don't permit redistributing outlined glyphs. The glyph is emboldened with a same-colour stroke so its mincho hairlines read as carved seal strokes.

Under the OFL, outlining glyphs into artwork is permitted, and the logo isn't a font derivative.

## Regenerate
```sh
brand/scripts/render.sh   # needs uv (python + fonttools), rsvg-convert, ImageMagick 7
```
1. Fetches the two OFL fonts into `brand/.fonts/` (gitignored).
2. `scripts/outline.py` turns text into SVG path data.
3. `scripts/build.py` writes the marks, and `scripts/card.py` writes the card art. Both are seeded (`random.Random(1000)` for 千 on the front, `2000` for 両 on the back), so every render is byte-identical.
4. `rsvg-convert` writes the PNGs, `magick` strips alpha from the app icon, and the web copies are refreshed.
