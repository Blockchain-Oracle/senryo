# Building a Senryo mobile screen — the brief every builder reads first

Written 1 Oct 2026 after the user rejected the first Living Lacquer build (D-196). It is short on purpose. Read it, then
open the frames; do not design from this text alone.

## 1. Authority, in order
1. The user's latest decision (`docs/plan/decisions.md`, newest first; D-194 lists what is excluded).
2. **The reference frames** in `docs/design/reference-study-2026-09-30/evidence/` (R3 = Fomo, the primary look; R2 =
   Phantom; R1 = Solflare) and the motion strips in `evidence/motion/`. Frames are 804 px wide = 402 pt: **2 px per pt**.
   Measure them. `03-fomo.md`, `04-motion-and-assets.md` and `05-components-and-agent-handoff.md` say what each frame is.
3. `controls-consult-2026-10-01.md` (numbers for buttons, sheets, selectors, navigation, surfaces).
4. `direction.md` for everything else (tokens, modes, money rules, journeys, the screen inventory).
5. Senryo's product and money rules (`docs/plan/00-plan.md`, `docs/plan/specs/`) always win over a reference's behaviour.

"Mediocre is never an option": a screen that is merely tidy is not done. Compare your result with the frame it adapts.

## 2. The surface rule
- No border around cards, groups, notes, chips, badges or buttons. A surface reads because its fill is one step lighter
  than its ground. Borders only for text-input boundaries, focus and glass rims.
- Lists sit **bare on the page** (Fomo F09/F12): no card around a list, no divider lines; rows are separated by their
  own height. Grouped settings use `Panel` (filled, 20 pt corners).
- Notes are plain text. A status that must stand out uses a filled wash (`color.warnWash`, `practiceWash`,
  `mainnetWash`, `upWash`, `downWash`) with 12 pt padding.
- No tracked uppercase. Sentence case everywhere; tickers stay as they are.
- Big numbers carry the hierarchy (Inter Display): one dominant figure per screen region, quiet labels around it.
- Empty states are quiet: one centred line in `text3` (F16 "No positions yet"), with at most one action. No dashed
  boxes, no illustration invented in code.
- Known entities show their real mark (`EntityMark`, `MarkCluster`, `VenueChip` from `~/components/identity`); Lucide
  icons are for actions only.

## 3. The kit (use it; do not restyle it locally)
| Need | Use | Notes |
|---|---|---|
| Button | `~/components/kit/Button` | `variant` primary · secondary · outline (quiet plate) · ghost (text) · destructive; `size` md 56 / sm 44; `block={false}` sizes to the label; `loading`, `disabled`, `leading` |
| Press feedback on any plate | `usePressScale()` from `~/components/kit/usePressScale` | `style` on an `Animated.View` wrapper, `onPressIn/Out` on the `Pressable`; never two transforms on one view |
| Filled group | `Panel`, `useGroupFill()`, `SurfaceLevel` from `~/components/kit/Surface` | level-aware: one step lighter than its ground |
| Settings row | `~/components/kit/ListRow` | inside a `Panel` |
| Category chips | `~/components/kit/ChipRow` | optional `leading` control |
| Two-to-five way switch | `~/components/kit/Segmented` | sliding plate |
| Loading / empty / error | `~/components/kit/states` (`ReadingView`, `Skeleton`, `EmptyState`, `LoadingState`) | a `Reading<T>` is never rendered as a fabricated 0 |
| Compact sheet | `~/components/sheet/Sheet` + `SheetHeading`, `SheetRow` (`SheetRoute` for a route) | register a new sheet route in `app/_layout.tsx` `SHEETS` |
| Full-height transaction | `~/components/sheet/TransactionSheet`, child: `ChildSheet` | |
| Tab root | `~/components/shell/CollapsingScreen` | `left`, `compact`, `expanded`, `sticky`, `utilities`, `status` |
| Round utility | `UtilityButton`, `AlertsButton` from `~/components/shell/Utilities` | 36 pt disc, 20 pt icon |
| Pushed page | `~/components/kit/Screen` | clears the dock by itself |
| Market row | `~/features/markets/MarketRow` | the row anatomy every list of instruments follows |
| Haptics / sound | `fire("tick" | "press" | "confirm" | "fail" | …)` from `~/feedback/fire` | never import expo-haptics |
| Money text | `usd`, `signedUsd`, `signedPct`, `arrow`, `price18` from `~/lib/money` | practice amounts print `P$` by themselves |

Type roles (`TYPE` from `~/theme`): `displayBalance` 52, `displayPrice` 40, `pageTitle` 32, `sheetHeading` 22,
`sectionTitle` 20, `rowTitle` / `rowPrice` 17 semibold, `body` 16, `row` 16 medium, `rowDetail` / `rowChange` 14,
`chipCategory` 14 semibold, `meta` / `moneyMeta` 12. Second lines of rows are `rowDetail` in `color.text3`.
Geometry (`~/theme`): `SIZE`, `SPACE`, `RADIUS`, `BUTTON`, `SHEET_SHAPE`, `DOCK`. Motion: `TIMING`, `SPRING`, `EASE`,
`EASE_SHEET`, `PRESS_SCALE`, `STAGGER_RISE`.

## 4. Motion
- Anything tappable answers the finger: 0.97 press scale (wide rows 0.985), plus `fire("tick")` or `fire("press")`.
- Things arrive from somewhere: a list that appears after loading may stagger (`TIMING.stagger`, 40 ms, 10 pt rise,
  see `SheetRow`); numbers change in place; a chart draws once when its data arrives, never on every tick.
- Entering is ease-out; leaving is faster than entering; nothing scales from 0.
- Reanimated only (`react-native-reanimated` 4): `useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`,
  `scheduleOnRN` from `react-native-worklets`. Reduce Motion is honoured by the theme springs; do not fight it.

## 5. Hard rules (the gate checks most of them)
- Colours only through `useTheme().color`; no hex or `rgba()` outside `apps/mobile/src/theme`.
- No magic numbers: tokens, or a named constant with one line saying why.
- Files ≤ 400 lines; one component per concern; match the surrounding comment style (each file opens with what it is
  and which evidence it follows).
- Money logic, signing, traces and outcome copy are not yours to change unless the task says so. A screen reads through
  the existing hooks (`@senryo/query`, `~/lib/account/*`, `features/*/use*.ts`).
- Mode travels with money: practice amounts are `P$`; a surface that moves money shows the mode.
- Every async surface has loading, empty where it can be empty, failure with a retry, and restores its parent.
- No tests as deliverables, no new dependencies without saying so, pnpm only.
- Verify from the repo root: `pnpm --filter @senryo/mobile typecheck`, `pnpm exec biome check apps/mobile packages`
  (`--write` formats), `pnpm invariants`. Report their last lines verbatim.
- You cannot see the simulator. Say exactly which screens you changed and what a reviewer should look at; the lead
  checks them on the simulator before merging.
