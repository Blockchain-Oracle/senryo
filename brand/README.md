# Brand — Senryo 千両 · Kinpaku 金箔

Senryo (千両, "a thousand ryō") is the app; Kinpaku (金箔, "gold leaf") is the card (D-003, D-049). The look is Living Lacquer (D-168, `docs/design/senryo-v2/direction.md`): lacquer, gold leaf and silver as authored materials on a violet-black ground. The seal keeps its geometry and takes the gold-leaf ramp; the D2 lemon gold is retired. The wordmark is still the D2 `SENRYO` in JetBrains Mono (its redesign is not part of this pass). Every glyph is outlined to vector paths, so no SVG here contains a `<text>` element or depends on installed fonts.

## Assets

| File | Use | Size |
|---|---|---|
| `senryo-seal.svg` | Primary mark: square 角印 seal, gold-leaf field (the five-stop ramp from the lit upper-left corner to the far one, a soft round bloom of highlight off the lit corner, a bevel light on the lit edges and shade on the far ones), carved double border (heavy + hairline) and carved 千 in lacquer `#17121B`, a line of light caught under each carved edge. Gradients and opacity only, no filter: react-native-svg draws it | 512 × 512 viewBox |
| `senryo-seal-inverse.svg` | Seal on dark UI where a gold block is too loud: lacquer field (lit from the same corner), carving and edge inlaid with gold leaf (one ramp across the whole seal) | 512 |
| `senryo-seal-mono.svg` | One-colour outline seal (`#F5F4FA` on transparent) for watermarks and embossing | 512 |
| `senryo-seal-512.png` | Raster of the primary seal | 512 × 512 |
| `favicon.svg` | Simplified seal (no borders, heavier glyph) for 16–64 px | 64 viewBox |
| `senryo-wordmark.svg` / `-ink.svg` | `SENRYO`, JetBrains Mono Bold, tracking −10 units: light for dark grounds, ink for light | cap height 100 |
| `senryo-lockup.svg` / `-ink.svg` | Seal + wordmark. Seal edge = 1.9 × cap height, gap = 0.55 × cap | — |
| `app-icon.svg`, `app-icon-1024.png` | iOS/Android icon: seal at 58 % on the app ground `#0A0911`, **opaque RGB** (App Store rejects alpha) | 1024 × 1024 |
| `splash.svg`, `splash-1290x2796.png` | Launch screen: app ground, seal 240 + wordmark cap 56, centred | 1290 × 2796 |
| `logo.png`, `logo-transparent.png` (+ `.svg`) | Submission logo (≤ 3 MB; actual ≈ 33 KB) | 2048 × 881 |
| `kinpaku-card.svg`, `kinpaku-card-1536x969.png` | Card front: the same card as onboarding scene 5, drawn flat. Lacquer body, a torn field of thin gold leaf with one sheen direction on the left, the seal carved into the leaf, `Kinpaku` / `金箔` top right, `Senryo` pressed into the leaf. **The right half stays clear lacquer for the number and holder the app writes over it; the bottom right is left empty for the network mark.** No filter: it draws as SVG everywhere. | ISO ID-1 85.6 × 54 mm → 856 × 540 viewBox |
| `kinpaku-card-back.svg`, `kinpaku-card-back-1536x969.png` | Card back: a torn leaf band where a magstripe sits, the seal in a gold line, quiet type | same |

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
| `art/onboarding/labels.json` | The label plates the app fills with native text (`EUR/USD`, `JPY/USD`, `Practice · Paper money`, `Mainnet · Real money`): id, the layer the plate rides in, box in master units, text, ink. Text is never outlined into a scene, so it stays localisable and readable by assistive technology. | — |
| `art/onboarding/layers.json` | Every master's layers, back to front, with role, depth, subject and what moves most (see **Layers**). | — |
| `art/onboarding/passkey-pending.svg` | Shown while the OS passkey sheet is open: the key over its bed, alone, transparent ground. It may sway and glint; it never counts, fills or scans. | 640 × 640 |
| `art/onboarding/completion-foil.svg` | One square of beaten gold leaf with the seal pressed in. The sheet is a computed surface (broad bends, a lifted corner, a few creases): its outline, seal and creases are projected from it, and each bend's light is one continuous gradient across the whole sheet (no facets). The seal is shade over the leaf, so the gold under it still turns. Only after a verified outcome. | 640 × 640 |
| `art/avatars/avatar-NN-*.svg` | Twelve default avatars: one family (same collar, light and drawing), different people (jaw, nose, eye spacing, skin, hair or headwear, one accessory). The face fills about half the disc. Full-bleed squares; the app clips them to discs. | 256 × 256 |

**Conventions.** Two viewpoints only. Lying objects (cards, trays, notes, key, coins) are seen from straight above with
their thickness falling to the lower right; standing objects (the chest, the vault) use one three-quarter view from the
front right. A resting object gets a tight contact shadow plus a short throw (`kit.contact`), a hovering one a soft
shadow on what it hovers over; every shadow is its own layer so it can move apart from its object. Wherever the seal is
carved, stamped or printed it is the seal's own carving (`kit.carved_seal`: heavy frame, hairline frame, 千), never a
redrawn approximation. Gold is
brand and card material only; the financial green and red never appear. Robes and grounds of the avatars use palette
tokens; paper, bamboo, straw, skin and hair are material pigments named in the scripts.

**Layers.** A master's top-level groups are its layers, back to front, one per unit of motion: the colour field first
(`<key>-field`), then every object and every object's shadow as its own group (`scene-passkey-key`,
`scene-passkey-key-shadow`, `scene-lp-ripples`, `scene-lp-drop`, …). `art/onboarding/layers.json` lists them for each
master in order, with a `role` (field, shadow with the object it belongs `of`, ground, object, accent), a `depth`
(relative travel: 0 stays still, 1 travels most, equal depths move together, e.g. the chest and the paths that run off
it), the scene's `subject` and what has the `mostMotion`. `python3 scripts/onboarding.py --layers <dir>` writes one
stand-alone SVG per layer (same viewBox and defs), so each can be rasterised with a transparent ground and animated on
its own with Skia/Reanimated and still register with the others. The static master is the Reduced Motion composition:
same artwork, nothing missing. Label plates sit in the layer of the object they name (`labels.json` gives that layer),
so native text must move with it.

**Scripts** (each under 400 lines): `kit.py` (canvas, layers, shadows, materials, label plates, mark embedding),
`props.py` (Kinpaku card, gold leaf, lacquer dish, badges), `chest.py` (the senryō-bako), `keyart.py` (key, tag, tablet),
`scene_*.py` (one per scene), `pending.py`, `foil.py`, `avatars.py` + `avatar_parts.py`, `onboarding.py` (writes everything), `sheets.py` and `motion.py` (review aids).

**Review aids** (written to `brand/review/`, gitignored; phone chrome, copy and label text on them are mock context,
never part of a master):
- `python3 scripts/sheets.py` renders the scenes inside 402 × 874 phones on the dark and light grounds (native labels
  drawn from `labels.json`), the pending art and foil on both grounds, the avatars as discs at 48 px and 96 px, and the
  card face (with a mock of the app's overlay), card back, seal sizes and variants on both grounds.
- `python3 scripts/motion.py` (needs ffmpeg) renders three short motion samples by moving only the masters' layers:
  scene 2 arriving and the key settling, the LP drop and ripples, the foil reveal with the highlight crossing the seal.
  They show the layers come apart cleanly; they are not the Skia/Reanimated implementation.

Every file is registered with its sha256 in `packages/identity/src/art/onboarding.ts` (invariant `identity-provenance`),
which also generates a react-native-svg and a web component per master. Replacing a piece is one file plus
`pnpm --filter @senryo/identity codegen --rehash`. One authoring trap: the codegen's SVGO pass rounds a merged transform
to the precision of any `matrix()` it meets, so write a plain squash as `scale()` and compare the generated output with
the master after a change (`codegen --emit-svg <dir>`).

**Review status.** Codex reviewed the J1 package over five rounds, then the redrawn card face and gold-leaf seal over
two; in the closing rounds every piece passes as a static first-pass master for the user's design review, with a list
of what still falls short (`docs/design/reviews/2026-10-01-j1-art-review.md`). A last round on the seal alone (round 8)
passed it at app sizes and failed its large-size finish and the inverse; both were fixed once and not re-reviewed.
B12 stays open until the user's design review passes.

`render.sh` also writes `apps/mobile/assets/images/kinpaku-card.png` (the card face as the Card tab's raster) and re-runs
`art.py`, `onboarding.py` and the identity codegen.

Copied into the web app by `render.sh`: `apps/web/public/icon.svg` (favicon), `apps/web/public/apple-touch-icon.png` (180 × 180), `apps/web/public/brand/{seal,wordmark,kinpaku-card,kinpaku-card-back}.svg`.

## Colour (from `packages/tokens`)

| Role | Value | Token |
|---|---|---|
| Seal gold leaf (highlight / light / mid / shade / shadow) | `#FFF0BC` / `#EACF8C` / `#D4AE5B` / `#AE8941` / `#886426` | `MATERIAL.goldLeaf` with `KINPAKU.foilLight`, `foilShade` |
| Seal carving, inverse field (shadow / lit corner) | `#17121B` / `#29212F` | `MATERIAL.lacquer.shadow` / `.mid` |
| Ground (app icon, splash, logo) | `#0A0911` | `DARK.background` |
| Wordmark light / ink | `#F5F4FA` / `#17151F` | `DARK.foreground` / `LIGHT.foreground` |
| Card lacquer (highlight / mid / shadow) | `#514357` / `#29212F` / `#17121B` | `MATERIAL.lacquer` |
| Foil stops | `#FFF0BC` `#EACF8C` `#D4AE5B` `#AE8941` `#886426` | `KINPAKU.foilHighlight … foilDeep` |

Change a colour in `packages/tokens/src/marks.ts` first, then mirror it in `scripts/build.py` (seal, grounds, type) and
`scripts/kit.py` (materials for the card and the artwork) and re-render.

## Usage rules
- **Clear space:** half the seal's edge on every side of the seal or lockup. The wordmark alone takes one cap height.
- **Minimum size:** full seal 32 device pixels (a 24 pt seal on a 2x or 3x screen is 48 or 72 px and keeps the full seal). Below that its hairline frame is a quarter of a pixel or less, so use the simplified geometry (`favicon.svg`, or `art/senryo-venue.svg` in the app). Lockup 96 px wide, wordmark cap height 9 px.
- Don't recolour the seal outside the three variants (gold leaf, inverse, mono), don't add shadows or outlines beyond what the files carry, don't rotate or stretch, and don't set 千 in a live font as a substitute.
- On gold or busy imagery use the inverse seal. The seal sits left of the wordmark and never above it, except on the splash.
- The card art carries no card number or name. The app renders those over the art (right half, above the network-mark area).

## Fonts and licences
- **JetBrains Mono Bold** (wordmark): SIL Open Font License 1.1, from https://github.com/JetBrains/JetBrainsMono.
- **Inter Display SemiBold** (`Kinpaku` and `Senryo` on the card): SIL Open Font License 1.1, the app's own copy at `apps/mobile/assets/fonts/InterDisplay-SemiBold.ttf`.
- **Zen Old Mincho Black** (千, 金箔): SIL Open Font License 1.1, from https://github.com/google/fonts/tree/main/ofl/zenoldmincho. Chosen over macOS system mincho fonts (Hiragino, Songti), which don't permit redistributing outlined glyphs. The glyph is emboldened with a same-colour stroke so its mincho hairlines read as carved seal strokes.

Under the OFL, outlining glyphs into artwork is permitted, and the logo isn't a font derivative.

## Regenerate
```sh
brand/scripts/render.sh   # needs uv (python + fonttools), rsvg-convert, ImageMagick 7
```
1. Fetches the two OFL fonts into `brand/.fonts/` (gitignored).
2. `scripts/outline.py` turns text into SVG path data.
3. `scripts/build.py` writes the marks, and `scripts/card.py` writes the card art from the same card prop as onboarding scene 5 (`scripts/props.py`). Both are seeded (`1000` for 千 on the front, `2000` for 両 on the back), so every render is byte-identical.
4. `rsvg-convert` writes the PNGs, `magick` strips alpha from the app icon, and the web and mobile copies are refreshed.
5. `scripts/art.py` and `scripts/onboarding.py` rewrite `art/`, and the identity codegen re-pins and regenerates.
