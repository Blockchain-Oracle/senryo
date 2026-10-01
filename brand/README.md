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

### J1 onboarding artwork (`art/onboarding/`, `art/avatars/`, S1b.3 first-pass masters, pending design review — B12)

Written by `scripts/onboarding.py` (deterministic, seeded; Python standard library only). The look is the v2 "Living
Lacquer" direction (`docs/design/senryo-v2/direction.md` §2, §10), not the D2 terminal described at the top of this file:
lacquer, gold leaf and silver from the material ramps, on the six scene fields (`SCENE_FIELD` in `packages/tokens`).
Same rules as the identity art: no `<text>`, no `<filter>`, no `<style>`; gradients, clip paths, masks and opacity only.
Soft shadows are stacked translucent shapes or radial gradients, tinted with the field's own deep tone. Light comes from
the upper left on every object and thickness falls to the lower right.

| File | What it is | Size |
|---|---|---|
| `art/onboarding/scene-balance.svg` | 1 · One balance (orange): a lacquer senryō-bako (千両箱). Two gold inlaid lines leave the seal on its lid, run down its front and carry on as flat inlay across the ground to two inlaid rings: the Kinpaku card hovers over one (spend), the XAU koban over the other (trade). No amounts, no partition. | 756 × 940 (the 378 × 470 pt hero at 2x) |
| `art/onboarding/scene-passkey.svg` | 2 · Passkey (periwinkle): an original silver key (its bow is the seal's rounded square) hovering just over its bed in a lacquer tablet, a phone as the device cue, a seal tag. No scan, no progress. | 756 × 940 |
| `art/onboarding/scene-markets.svg` | 3 · Markets (yellow): three lacquer trays of equal weight: commodities (koban, chōgin), FX (EUR/USD and JPY/USD pair discs, each with a plate for its native pair label), crypto (the registered Bitcoin and MON marks, uniformly scaled, never recoloured). No quotes. | 756 × 940 |
| `art/onboarding/scene-lp.svg` | 4 · LP (lime): the vault as a lacquer well whose round, bolted door stands open on its hinges, one shared pool inside (far wall mirrored, a meniscus at the near wall), one drop above the point it disturbs. No rate. | 756 × 940 |
| `art/onboarding/scene-kinpaku.svg` | 5 · Kinpaku (pink): the card (lacquer, a torn field of thin gold leaf with one sheen direction, carved seal) over a book of beaten gold leaf and bamboo tweezers. No network mark, no number. | 756 × 940 |
| `art/onboarding/scene-modes.svg` | 6 · Practice / Mainnet (gray): washi notes printed in the practice violet in front; metal money in a lacquer tray lined in the mainnet blue, apart and behind; a plate beside each for its native mode label. The blue carries Mainnet, never the gold. | 756 × 940 |
| `art/onboarding/labels.json` | The label plates the app fills with native text (`EUR/USD`, `JPY/USD`, `Practice · Paper money`, `Mainnet · Real money`): id, box in master units, text, ink. Text is never outlined into a scene, so it stays localisable and readable by assistive technology. | — |
| `art/onboarding/passkey-pending.svg` | Shown while the OS passkey sheet is open: the key over its bed, alone, transparent ground. It may sway and glint; it never counts, fills or scans. | 640 × 640 |
| `art/onboarding/completion-foil.svg` | One square of beaten gold leaf with the seal pressed in. The sheet is a computed surface (broad bends, a lifted corner, a few creases): its outline, seal and creases are projected from it, and each bend's light is one continuous gradient across the whole sheet (no facets). The seal is shade over the leaf, so the gold under it still turns. Only after a verified outcome. | 640 × 640 |
| `art/avatars/avatar-NN-*.svg` | Twelve default avatars: one family (same collar, light and drawing), different people (jaw, nose, eye spacing, skin, hair or headwear, one accessory). The face fills about half the disc. Full-bleed squares; the app clips them to discs. | 256 × 256 |

**Conventions.** Two viewpoints only. Lying objects (cards, trays, notes, key, coins) are seen from straight above with
their thickness falling to the lower right; standing objects (the chest, the vault) use one three-quarter view from the
front right. A resting object gets a tight contact shadow plus a short throw (`kit.contact`), a hovering one a soft
shadow on what it hovers over; every shadow is its own named group so it can move apart from its object. Gold is
brand and card material only; the financial green and red never appear. Robes and grounds of the avatars use palette
tokens; paper, bamboo, straw, skin and hair are material pigments named in the scripts.

**Layers.** Every master keeps its layers as named top-level groups, back to front: scenes use `<key>-field`, `-shadow`,
`-back`, `-main`, `-fore`; the foil uses `-shadow`, `-leaf`, `-seal`, `-sheen`, `-flakes`; the pending art `-shadow`,
`-tablet`, `-tag`, `-key-shadow`, `-key`, `-glints`. Movable objects and their shadows are named groups inside them
(`scene-balance-chest`, `-card`, `-koban`, `-path-spend`, `-path-trade`, `scene-lp-door`, `-pool`, `-ripples`, `-drop`, …).
`python3 scripts/onboarding.py --layers <dir>` writes one stand-alone SVG per top-level group (same viewBox and defs), so a layer can be drawn and animated on its own with Skia/Reanimated and still
register with the others. The static master is the Reduced Motion composition: same artwork, nothing missing.

**Scripts** (each under 400 lines): `kit.py` (canvas, layers, shadows, materials, label plates, mark embedding),
`props.py` (Kinpaku card, gold leaf, lacquer dish, badges), `chest.py` (the senryō-bako), `keyart.py` (key, tag, tablet),
`scene_*.py` (one per scene), `pending.py`, `foil.py`, `avatars.py` + `avatar_parts.py`, `onboarding.py` (writes everything), `sheets.py` and `motion.py` (review aids).

**Review aids** (written to `brand/review/`, gitignored; phone chrome, copy and label text on them are mock context,
never part of a master):
- `python3 scripts/sheets.py` renders the scenes inside 402 × 874 phones on the dark and light grounds (native labels
  drawn from `labels.json`), the pending art and foil on both grounds, and the avatars as discs at 48 px and 96 px.
- `python3 scripts/motion.py` (needs ffmpeg) renders three short motion samples by moving only the masters' named groups:
  scene 2 arriving and the key settling, the LP drop and ripples, the foil reveal with the highlight crossing the seal.
  They show the layers come apart cleanly; they are not the Skia/Reanimated implementation.

Every file is registered with its sha256 in `packages/identity/src/art/onboarding.ts` (invariant `identity-provenance`),
which also generates a react-native-svg and a web component per master. Replacing a piece is one file plus
`pnpm --filter @senryo/identity codegen --rehash`. One authoring trap: the codegen's SVGO pass rounds a merged transform
to the precision of any `matrix()` it meets, so write a plain squash as `scale()` and compare the generated output with
the master after a change (`codegen --emit-svg <dir>`).

**Review status.** Codex reviewed the package over five rounds; in the closing round every piece passes as a static
first-pass master for the user's design review, with a list of what still falls short
(`docs/design/reviews/2026-10-01-j1-art-review.md`). B12 stays open until the user's design review passes.

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
