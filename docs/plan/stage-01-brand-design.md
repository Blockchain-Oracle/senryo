# S1 — Brand + design system

**Goal:** one token source for web and mobile, the Senryo 千両 / Kinpaku 金箔 brand assets, and the web shell with the D2 21st components re-tokenized.
- **Plan:** `00-plan.md` §1 D-003/D-004/D-033/D-049, §2.4. **Open first:** `design/DIRECTIONS.md` (D2), `design/preview/components/directions/d2.tsx`, `design/preview/app/directions.css`, `docs/plan/specs/client.md` (component mapping), skills `21st-cli-use` / `21st-ui-build` / `21st-ui-review`.
**D-number range:** D-060…D-069.

## Steps
- [x] `packages/tokens`: D2 palette dark + light (single TS source), type/space/radius/motion scales, generated `tokens.css` (shadcn/Tailwind 4 variable names; adds `--chart-up`, `--chart-candle-down`, `--surface`)
- [x] Brand: 千 square seal mark (SVG, inverse), wordmark, app icon 1024, splash, logo ≤ 3 MB PNG, Kinpaku card art → `brand/`
- [ ] `apps/web` shell: Next 16 static export, Tailwind 4 + shadcn `components.json`, fonts Inter + JetBrains Mono, tokens.css, D2 top bar + tabs
- [ ] `21st add` the D2 set (per specs/client.md mapping), re-tokenize (no hex/px), split files > 400 lines, `framer-motion` → `motion/react`
- [ ] `apps/web/.21st/design.json` + `apps/mobile/.21st/design.json` (colors, type, radius, motion, must/avoid, installed components, RN port sources)
- [ ] Sounds (fill, deposit, send, unlock, liquidation) — **[OK?]** ElevenLabs credits
- [ ] Visual check vs `design/screens/d2-*` at 390/768/1440, both themes (chrome-devtools screenshots)
- [ ] Domain senryo.xyz — **[OK?]** pre-approved at ≈ $2 once Namecheap API whitelist is set (D-049/D-051)

## Gate
`design-literals-web` + `design-json-present` pass; logo exists; D2 screens match the approved screenshots.

## Findings
- The preview's Candle Chart read three undefined tokens (`--chart-up`, `--chart-candle-down`, `--surface`) and always fell back to its own colours — now defined in `packages/tokens`.

## Handoff
S5 (mobile) consumes `@senryo/tokens` (`PALETTES`, `TYPE`, `SPACE`, `RADIUS`, `MOTION`). Web consumes `@senryo/tokens/tokens.css`. Regenerate CSS with `pnpm --filter @senryo/tokens emit` after any palette change.
