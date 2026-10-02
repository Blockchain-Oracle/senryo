# UI agent brief (shared by every screen-area agent)

You rebuild one area of the Senryo mobile app (Expo SDK 57, RN 0.86, Reanimated 4, Gesture Handler 2.32, expo-router)
to the product flow book. Work ONLY in your own worktree; commit on your branch in small steps, each message ending
with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, deploy, or send transactions.

## Read first
1. `~/.claude/plans/jiggly-munching-island.md`: Part A0 (how UI gets built), Part A (design rules), §0.5 (cross-cutting
   rules), your rows of §0.9 (surface pass: before → after → why), your Part 1 defects, Part F.
2. Your flow-book page(s) in `docs/product/flows/` — the capability cards are the spec (steps, rules, states, copy,
   acceptance). A screen that disagrees with them is the bug.
3. `docs/design/reference-study-2026-09-30/03-fomo.md` (and 01/02 for Solflare/Phantom) for the visual grammar; the
   frames are in `/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/evidence/` (read-only;
   2 px per pt). Do not take screenshots of the app; design from code + these references.

## Rules (binding)
- **21st.dev first** for any new component: `npx -y @21st-dev/cli search "<what>" --type c`, then `npx -y @21st-dev/cli
  get <id>` and port the behaviour/visuals to React Native (Reanimated/Skia/SVG). Record each port (or "searched, none
  fit") in `docs/product/provenance/<your-area>.md` (source id/url, what was ported, deviations). Never add web libs.
- **Use the foundation:** `components/kit/symbols.tsx` (native icons — never lucide), `components/trade/SlideToConfirm`
  (money confirmations; `tone`, `busy`), `components/kit/AmountHero` (hero numbers only), `features/trade/TradeTrace`
  (the one outcome surface — pass `title`, facts as children, words with `pending`/`success`), `UnderlineTabs`,
  `Button` (56/12), `Sheet`/`ChildSheet`/`TransactionSheet`, `EntityMark`/`Avatar` (every entity shows its real mark —
  no dots), `QuietLine`, `states.tsx` (loading/empty/error).
- **Do not edit** `components/kit/*`, `components/shell/*`, `components/sheet/*`, `theme/*`, `feedback/*` — if you need a
  change there, note it in your final report. You MAY add keys at the end of `STORAGE_KEYS` and routes in
  `lib/constants/routes.ts` (append-only, to keep merges trivial).
- **Copy budget:** no sentences on primary screens; a row is a title + ≤ 1 short subtitle; explanations behind an ⓘ that
  opens a sheet; pre-approval disclosures may stay as compact rows. Never the word "gas" (say network fee).
- **Rows, not boxes**; one hero per screen; 30 ms stagger once per mount for lists (not in recycled cells); press 0.97.
- **Money truth:** bigint units; the account signs and `@senryo/chain` sends; reviewed intent is immutable; failures go
  back to review and never resend; unknown outcomes offer no new action; keep review-guard `resetKey`s.
- Files ≤ 400 lines; named constants (biome `noMagicNumbers`); no UI test suites.

## Gates (by exit code) before every commit
`pnpm --filter @senryo/mobile typecheck`, typecheck of any package you touch, `npx biome check --write <paths>` then
`npx biome check .`, `node scripts/invariants/run.mjs`. Chain with `&&` so a failing gate stops the commit.

## Report
Files changed, which capability cards and §0.9 rows are now built, what remains (with the reason), and any change you
need in the shared folders.
