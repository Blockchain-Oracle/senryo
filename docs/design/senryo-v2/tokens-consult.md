# Token values consult — Codex, 2026-10-01 (S1b.6, D-191)

> Source: Codex CLI (gpt-6.1-sol, reasoning xhigh, read-only), consulted by S1b agent A2 on the worktree branch off
> `main@1137f57`. The question asked for every value that `direction.md` and v2-plan §5 do not fix: the mapping of
> existing role names, new roles, the light Text 3 fix, washes, Kinpaku stops, the type scale, radius, spacing, sizes,
> elevation and motion tokens. The answer below is verbatim and is the authority for the values in `packages/tokens`
> and `apps/mobile/src/theme`.

**A = declared adaptation. E = from evidence**, adopting approximate reference samples/geometry rather than claiming recovered source constants. `E/A` means dark/light respectively. Dimensions are mobile **pt**, web **px**; rem conversions assume 16 px. No files edited.

**1. Existing `ColorRole` mappings**

| Existing role | Dark | Light | Meaning | Basis |
|---|---|---|---|---|
| `background` | `#0A0911` | `#F5F4F8` | Page background | E/A |
| `card`, `surface` | `#13121A` | `#FFFFFF` | Opaque raised surface | E/A |
| `popover` | `#191822` | `#FFFFFF` | Sheet surface | A |
| `foreground`, `cardForeground`, `popoverForeground` | `#F5F4FA` | `#17151F` | Text 1 | A |
| `primary` | `#414EF4` | `#414EF4` | Primary action fill | E/A |
| `primaryForeground` | `#FFFFFF` | `#FFFFFF` | On-primary | A |
| **`mutedForeground`** | **`#B8B5C4`** | **`#5F5B6B`** | **Text 2; includes `inkMuted`** | A |
| `secondary` | `#201E2B` | `#ECE9F2` | Neutral secondary control fill | A |
| `secondaryForeground` | `#F5F4FA` | `#17151F` | Text 1 | A |
| `muted` | `#201E2B` | `#ECE9F2` | Quiet fill; temporary skeleton/pressed-state bridge | A |
| `accent` | `#1B2040` | `#E8EBFF` | Selected/active fill | A |
| `accentForeground` | `#8B95FF` | `#3643D8` | Active/link ink | A |
| `border`, `input` | `#2C2938` | `#DEDBE6` | Divider/input boundary | A |
| `ring` | `#8B95FF` | `#3643D8` | Focus; 2 px ring with 2 px background gap | A |
| `up`, `chartUp` | `#25CF68` | `#087F3C` | Positive direction | A |
| `down`, `chartDown`, `chartCandleDown` | `#FF5A48` | `#C83225` | Negative direction | A |
| `destructive` | `#FF5A48` | `#C83225` | Alias Down; destructive meaning comes from action/copy | A |
| `destructiveForeground` | `#17151F` | `#FFFFFF` | Ink on solid destructive fill | A |
| `warn` | `#F2B85C` | `#8A5800` | Warning ink | A |
| `gold` | `#D4AE5B` | `#89611F` | Senryo/Kinpaku UI identity | A |
| `practice` | `#B69DF8` | `#7049C8` | Practice accent | A |
| `mainnet` | `#8B95FF` | `#3643D8` | Mainnet accent | A |
| `chart1` | `#8B95FF` | `#3643D8` | Categorical series: blue | A |
| `chart2` | `#B69DF8` | `#7049C8` | Categorical series: violet | A |
| `chart3` | `#5CCAD8` | `#087A8A` | Categorical series: cyan | A |
| `chart4` | `#F18BB7` | `#AD3265` | Categorical series: rose | A |
| `chart5` | `#C9D0DD` | `#626D7E` | Categorical series: silver-gray | A |
| Chart semantics | — | — | Series colours identify datasets. Direction uses `chartUp`/`chartDown`; gold has no profit meaning. | A |

**2. New roles and missing states**

| New role | Dark | Light | Semantics | Basis |
|---|---|---|---|---|
| `text2` | `#B8B5C4` | `#5F5B6B` | Main secondary text | A |
| `text3` | `#8F8B9F` | `#716C7F` | Tertiary metadata | A |
| `link` | `#8B95FF` | `#3643D8` | Links/active ink | A |
| `glassTint` | `#201E2BD9` | `#FFFFFFD9` | Dock material; dark RGB follows evidence, alpha is adapted | A |
| `glassRim` | `#FFFFFF24` | `#FFFFFFB3` | Decorative glass rim | A |
| `glassOpaque` | `#201E2B` | `#FFFFFF` | Dock under reduced transparency | A |
| `fanCircle` | `#C3B5F6` | `#D5C8FF` | Fan action discs | A |
| `fanText` | `#211A31` | `#211A31` | **Ink/icons inside discs** | A |
| `fanLabel` | `#F5F4FA` | `#17151F` | Labels to the left of discs | A |
| `fanCirclePressed` | `#AE9BE8` | `#C1B0F2` | Pressed disc; retains `fanText` | A |
| `sheetScrim` | `#00000066` | `#17151F38` | Ordinary sheet dimming | A |
| `fanScrim` | `#0A091180` | `#17151F55` | Fan tint over live blur | A |
| `fanBackdropOpaque` | `#191822` | `#F5F4F8` | Fan backdrop under reduced transparency | A |
| `warningSurface` | `#332719` | `#FFF0D5` | Opaque warning plate; `warn` ink | A |
| `practiceSurface` | `#282038` | `#EEE7FF` | Opaque Practice plate | A |
| `mainnetSurface` | `#1B2040` | `#E8EBFF` | Opaque Mainnet plate | A |
| `silver` | `#C9D0DD` | `#626D7E` | Silver UI accent | A |
| `raised2` | `#201E2B` | `#ECE9F2` | Neutral elevated/control fill; opaque | A |
| `rowPressed` | `#2C2938` | `#E5E1EE` | Pressed/hovered row | A |
| `selectedRow` | `#1B2040` | `#E8EBFF` | Persistent selection; selection indicator also required | A |
| `skeleton` | `#2C2938` | `#DEDBE6` | Dedicated loading geometry | A |
| `primaryPressed` | `#343ED3` | `#343ED3` | Pressed primary; white ink | A |
| `upSurface` | `#102A1C` | `#E4F4E9` | Opaque positive-status plate | A |
| `downSurface`, `destructiveSurface` | `#35201F` | `#FBE8E5` | Opaque negative/error plate | A |
| `upForeground`, `downForeground` | `#17151F` | `#FFFFFF` | Ink on **solid** up/down action fills | A |
| `chartNeutral`, `sheetHandle` | `#8F8B9F` | `#716C7F` | Neutral candle/handle ink | A |
| `goldLeafShadow` / `goldLeafMid` / `goldLeafHighlight` | `#886426` / `#D4AE5B` / `#FFF0BC` | Same three values | Artwork material; theme independent | A |
| `silverShadow` / `silverMid` / `silverHighlight` | `#697383` / `#C9D0DD` / `#F4F6FB` | Same three values | Artwork material; distinct from UI `silver` | A |
| `lacquerShadow` / `lacquerMid` / `lacquerHighlight` | `#17121B` / `#29212F` / `#514357` | Same three values | Artwork material; theme independent | A |

**3. Text 3 contrast correction**

| Theme | Approved `text3` | Background contrast | Sheet contrast | Decision | Basis |
|---|---|---|---|---|---|
| Dark | `#8F8B9F` | **6.00:1** on `#0A0911` | **5.32:1** on `#191822` | Confirm | A |
| Light | **`#716C7F`** | **4.62:1** on `#F5F4F8` | **5.06:1** on `#FFFFFF` | Replaces `#746F82` in both authorities | A |

**4. Mobile washes**

| Existing name/configuration | Dark output | Light output | Rule | Basis |
|---|---|---|---|---|
| `WASH.soft` | `0.12` | `0.12` | Retain for transient directional washes | A |
| `WASH.strong` | `0.24` | `0.24` | Retain for stronger directional washes | A |
| `upWash` | `#25CF681F` | `#087F3C1F` | Up at soft alpha | A |
| `downWash` | `#FF5A481F` | `#C832251F` | Down at soft alpha | A |
| `upWashStrong` | `#25CF683D` | `#087F3C3D` | Up at strong alpha | A |
| `downWashStrong` | `#FF5A483D` | `#C832253D` | Down at strong alpha | A |
| `warnWash` | `#332719` | `#FFF0D5` | Alias opaque `warningSurface` | A |
| `practiceWash` | `#282038` | `#EEE7FF` | Alias opaque `practiceSurface` | A |
| `mainnetWash` | `#1B2040` | `#E8EBFF` | Alias opaque `mainnetSurface` | A |
| `destructiveWash` | `#35201F` | `#FBE8E5` | Alias opaque `destructiveSurface` | A |
| `WASH.chartFill` / `chartFillTop` | `0.16` / `#25CF6829` | `0.16` / `#087F3C29` | Replace 0.28 | A |
| `WASH.chartFillEnd` / `chartFillBottom` | `0` / `#25CF6800` | `0` / `#087F3C00` | Transparent endpoint | A |
| `scrim` | **`#00000066`** | **`#17151F38`** | Alias `sheetScrim`; remove generic `WASH.scrim=0.72` | A |
| Alpha construction | — | — | Hex alpha bytes above are rounded. Assign eight-digit scrims directly; current six-digit `withAlpha()` cannot parse them correctly. | A |

**5. Kinpaku and materials**

| Existing name | Dark | Light | Mapping | Basis |
|---|---|---|---|---|
| `KINPAKU.lacquer` | `#17121B` | `#17121B` | Lacquer shadow/body | A |
| `KINPAKU.lacquerEdge` | `#29212F` | `#29212F` | Lacquer midtone/edge | A |
| `KINPAKU.foilDeep` | `#886426` | `#886426` | Gold-leaf shadow; stop 0% | A |
| `KINPAKU.foilShade` | **`#AE8941`** | **`#AE8941`** | Intermediate shadow→mid; stop 25% | A |
| `KINPAKU.foilMid` | `#D4AE5B` | `#D4AE5B` | Gold-leaf mid; stop 50% | A |
| `KINPAKU.foilLight` | **`#EACF8C`** | **`#EACF8C`** | Intermediate mid→highlight; stop 75% | A |
| `KINPAKU.foilHighlight` | `#FFF0BC` | `#FFF0BC` | Gold-leaf highlight; stop 100% | A |
| New lacquer highlight | `#514357` | `#514357` | Use `lacquerHighlight` for reflective lighting | A |
| `QR.ink` / `QR.paper` | `#000000` / `#FFFFFF` | `#000000` / `#FFFFFF` | Confirm fixed scanner colours | A |
| `CHAIN_HUE`, `ASSET_HUE` | Delete | Delete | Remove maps/types/exports and emitter reads together; use real identity assets | A |

**6. Complete type scale**

All roles use `uppercase=false`. Letter-spacing is **pt/px**, with token `tracking` in em shown alongside. “Yes” means **both `tnum` and `lnum`**.

| Role | Size / lineHeight | Weight | Letter-spacing / tracking | Face | `tnum` + `lnum` | Basis |
|---|---:|---:|---:|---|---|---|
| Existing `micro` | 12 / 16 | 500 | 0 / 0 em | Inter | No | A |
| Existing `label` | 12 / 16 | 600 | 0 / 0 em | Inter | No | A |
| Existing `caption` | 12 / 16 | 400 | 0 / 0 em | Inter | No | A |
| Existing `body` | 16 / 22 | 400 | 0 / 0 em | Inter | No | A |
| Existing `bodyStrong` | 16 / 22 | 600 | 0 / 0 em | Inter | No | A |
| Existing `title` | 20 / 24 | 600 | 0 / 0 em | Inter | No | A |
| Existing `numSm` | 16 / 20 | 500 | 0 / 0 em | Inter | Yes | A |
| Existing `numMd` | 20 / 24 | 600 | 0 / 0 em | Inter | Yes | A |
| Existing `numTicker` | 40 / 44 | 600 | −0.80 / −0.02 em | Inter Display | Yes | A |
| Existing `numLg` | 40 / 44 | 600 | −0.80 / −0.02 em | Inter Display | Yes | A |
| Existing `numXl` | 52 / 56 | 600 | −1.04 / −0.02 em | Inter Display | Yes | A |
| Existing `numHero` | 52 / 56 | 600 | −1.04 / −0.02 em | Inter Display | Yes | A |
| New `displayBalance` | 52 / 56 | 600 | −1.04 / −0.02 em | Inter Display | Yes | A |
| New `displayMargin` | 64 / 68 | 600 | −1.28 / −0.02 em | Inter Display | Yes | A |
| New `displayPrice` | 40 / 44 | 600 | −0.80 / −0.02 em | Inter Display | Yes | A |
| New `row` | 16 / 20 | 500 | 0 / 0 em | Inter | No | A |
| New `rowStrong` | 16 / 20 | 600 | 0 / 0 em | Inter | No | A |
| New `rowAmount` | 16 / 20 | 600 | 0 / 0 em | Inter | Yes | A |
| New `meta` | 12 / 16 | 400 | 0 / 0 em | Inter | No | A |
| New `moneyMeta` | 12 / 16 | 500 | 0 / 0 em | Inter | Yes | A |
| New `sectionTitle` | 20 / 24 | 600 | 0 / 0 em | Inter | No | A |
| New `sheetTitle` | 24 / 28 | 600 | 0 / 0 em | Inter | No | A |
| New `pageTitle` | 32 / 38 | 600 | −0.64 / −0.02 em | Inter Display | No | A |
| New `buttonLabel` | 16 / 20 | 600 | 0 / 0 em | Inter | No | A |
| New `buttonCompact` | 14 / 20 | 600 | 0 / 0 em | Inter | No | A |
| New `tabLabel` | 12 / 16 | 600 | 0 / 0 em | Inter | No | A |
| New `chipLabel` | 12 / 16 | 500 | 0 / 0 em | Inter | No | A |
| New `modeLabel` | 12 / 16 | 600 | 0 / 0 em | Inter | No | A |
| New `fanLabel` | 24 / 28 | 600 | 0 / 0 em | Inter | No | A |
| Display cutoff | **32 pt/px inclusive** | — | Display tracking −0.02 em | Display amounts/headings ≥32 use Inter Display | As appropriate | A |
| Japanese fallback | Match role | Match role | Match role | Noto Sans JP | Match role | A |
| Step-1 font bindings | — | 400/500/600/700 | — | `sans=Inter`; `display=Inter Display`; legacy `mono`/`mono*` aliases resolve to Inter faces | Numeric flag independent of face | A |
| Step-1 adapter requirements | — | — | Remove explicit tracked-uppercase overrides | Replace web `--font-jbmono` binding; extend mobile face selection for Display and 700 | Web features `"tnum" 1, "lnum" 1`; mobile tabular + lining variants | A |
| Semantic migration | — | — | — | Ticket margin → `displayMargin`; market price → `displayPrice`; Home balance → `displayBalance` | Yes | A |

**7. Radius**

| Token/class | Value | Mapping/use | Basis |
|---|---:|---|---|
| `RADIUS.none` | 0 | Explicit square geometry only | A |
| `RADIUS.xs` | 8 | Small chips | A |
| **`RADIUS.sm`** | **12** | **Step-1 compatibility value; inputs in the rebuilt system** | A |
| `RADIUS.md` | 16 | Action rows | A |
| `RADIUS.lg` | 24 | Cards and sheet tops | A |
| `RADIUS.xl` | 32 | Onboarding hero | A |
| `RADIUS.pill` | 999 | Buttons, dock, fan circles, avatars | A |
| Web `--radius` | 12 px / 0.75 rem | Compatibility base | A |
| `rounded-xs` | 8 px / 0.5 rem | Explicit `--radius-xs` | A |
| `rounded-sm` | 12 px / 0.75 rem | Explicit `--radius-sm` | A |
| `rounded-md` | 16 px / 1 rem | Explicit `--radius-md` | A |
| `rounded-lg` | 24 px / 1.5 rem | Explicit `--radius-lg` | A |
| `rounded-xl` | 32 px / 2 rem | Explicit `--radius-xl` | A |
| `rounded-2xl` | 32 px / 2 rem | Compatibility alias of 32 | A |
| `rounded-3xl` | 32 px / 2 rem | Compatibility alias of 32 | A |
| `rounded-full` | 999 px | Pill/circle | A |
| Web construction | — | Replace the current multipliers with these explicit variables | A |

**8. Spacing**

| Final token | Value | Use | Basis |
|---|---:|---|---|
| `SPACE.none` | 0 | No gap | A |
| `SPACE.xxs` | **2** | Optical micro-gaps only; excluded from structural layout spacing | A |
| `SPACE.xs` | 4 | Small gap | A |
| `SPACE.sm` | 8 | Related controls/content | A |
| `SPACE.md` | 12 | Compact padding/gap | A |
| `SPACE.lg` | 16 | Standard content gap | A |
| **`SPACE.lgPlus`** | **20** | General 20-point step | A |
| **`SPACE.inset`** | **20** | Default screen horizontal inset | A |
| `SPACE.xl` | 24 | Section gap/padding | A |
| `SPACE.xxl` | 32 | Larger section separation | A |
| `SPACE.xxxl` | 48 | Major separation | A |
| Naming | — | Keep existing names; add `lgPlus` and semantic alias `inset`. No numeric-key migration. | A |
| Boundary stroke | 1 px | Ordinary divider/border; separate from spacing, without terminal grids | A |

**9. Sizes and elevation**

| Token/component | Exact value | Colour/material or placement | Basis |
|---|---|---|---|
| `touch` | **44 minimum** | Grow with accessibility/content | A |
| `rowMinHeight` | **64 minimum** | Grow with multiline content | A |
| `gutter`, `screenInset` | **20** | Alias `SPACE.inset` | A |
| `dockHeight` | **64** | `glassTint`, pill | A |
| `dockHorizontalInset` | **16** | Both sides | A |
| `dockBottomOffset` | **12** | `bottom = safeAreaBottom + 12` | A |
| `dockIconSize` | **24** | Lucide | A |
| Dock label | **12 / 16**, 600 | `TYPE.tabLabel`; icon→label gap **4** | A |
| `dockContentBottomInset` | **safeAreaBottom + 92** | 12 offset + 64 dock + 16 content clearance | A |
| `fanCircleSize` | **48** | `fanCircle`; circle | E, adopted P19 geometry |
| `fanVerticalSpacing` | **72 centre-to-centre** | 24 clear between adjacent 48-point circles | E, adopted P19 geometry |
| `fanLabelGap` | **16** | Label right edge→circle left edge | A |
| Fan label | **24 / 28**, 600 | `TYPE.fanLabel`; palette `fanLabel` | A |
| `fanTriggerSize` | **48** | Pill; plus icon **24** | A |
| Fan trigger placement | Right **16**; bottom **safeAreaBottom + 92** | 16 clear above dock; nearest fan circle centre is 72 above trigger centre | A |
| `buttonHeight` | **56** | Primary, pill | A |
| `buttonHeightSecondary` | **48** | Secondary, pill | A |
| `buttonHeightSm` | **44** | Compact, pill; replaces 36 | A |
| `inputHeight` | **52 minimum** | Radius 12; grows with text | A |
| `chipHeight` | **32 visual** | Radius 8; hit area ≥44 | A |
| `modeCapsuleHeight` | **44 minimum** | Pill; full mode label | A |
| `handleWidth` / `handleHeight` | **36 × 4** | Pill; `sheetHandle` colour | A |
| `icon` / `iconSm` | **24 / 16** | Small icons remain inside ≥44 touch targets | A |
| `iconStroke` | **2** | Consistent Lucide stroke | A |
| Avatar sizes | **24 / 32 / 40 / 56 / 80** | `avatarXs/Sm/Md/Lg/Xl`; circles | A |
| Dock elevation | x **0**, y **8**, blur **24**, spread **0** | Dark/light: **`#00000033`**; 20% black | A |
| Sheet elevation | x **0**, y **−4**, blur **16**, spread **0** | Dark/light: **`#0000001F`**; approximately 12% black | A |
| Raised-card elevation | x **0**, y **0**, blur **0**, spread **0** | **No shadow in either theme**; separation through surface/divider | A |

**10. Motion**

Spring notation is **mass / stiffness / damping**. Milliseconds beside springs are choreography targets; do **not** also pass `duration` into a physics spring configuration.

| Token / existing alias | Exact value | Behaviour/configuration | Basis |
|---|---|---|---|
| `easing` | **`[0.2, 0.8, 0.2, 1]`** | `cubic-bezier(0.2,0.8,0.2,1)` | A |
| `fastMs` → `pressMs` | **100 ms** | Press feedback | A |
| `baseMs` → `selectionMs` | **170 ms** | Selection, validation, small crossfade | A |
| `slowMs` → `pagePushMs` | **320 ms** | Compatibility timing alias; sheets use their own family | A |
| `flashInMs` | **160 ms** | Number-change emphasis entrance | A |
| `flashOutMs` | **160 ms** | Number-change emphasis release | A |
| `compactSelectorMs` / `compactSelectorSpring` | **420 ms; 1/260/30** | `overshootClamping=true` | A; M02-informed |
| `tallDetailMs` / `tallDetailSpring` | **450 ms; 1/240/30** | Also transaction entrance; `overshootClamping=true` | A; M07/M08/M13-informed |
| `parentChildMs` | **600 ms** | Coordinate differently sized parent/child exchange | A; M16-informed |
| `fanItemMs` / `fanStaggerMs` | **200 / 25 ms** | Send → Receive → Add money → Swap; nominal 275 ms entrance | A; M06-informed |
| `fanSpring` | **1/420/30** | Send translation: `overshootClamping=false`; other items and all scale springs: `true` | A; M06-informed |
| `fanBackdropMs` | **160 ms** | Concurrent blur/tint transition | A |
| `fanToggleMs` | **180 ms** | Plus→× rotation **45°** | A |
| `fanExitMs` | **180 ms total** | Item duration **135 ms**, reverse stagger **15 ms**; Swap exits first | A |
| `dockActiveMs` / `dockActiveSpring` | **260 ms; 1/500/36** | `overshootClamping=true` | A; M10-informed |
| `headerCollapseDistance` | **132 pt/px** | Scroll-driven progress 0→1 over distance; no timer | A; M09-informed |
| `rulerSnapSpring` | **1/500/40** | `overshootClamping=true`; clamp to valid instrument leverage bounds | A; M14-informed |
| `numberChangeMs` | **160 ms** | Animate only real value changes | A |
| `chartRevealMs` | **750 ms** | Once after first data arrival; subsequent updates do not replay entrance | A; M08-informed |
| `onboardingSceneMs` | **850 ms** | Scene travel | A; M01-informed |
| `qrRevealMs` | **650 ms** | Final valid payload; reveal existing code geometry | A; M04-informed |
| `ambientLoopMs` | **8000 ms** | Independently phased artwork loops | A |
| `completionFoilMs` | **800 ms** | One reveal after confirmed outcome, then ambient motion | A; M18-informed |
| `reducedMotionMs` | **100 ms** | Crossfades; static artwork and direct chart presentation | A |
| `springEnergyThreshold` | **`6e-9`** | Explicit common value for physics springs | A |
| `restDisplacementThreshold`, `restSpeedThreshold` | **Omit** | Locked Reanimated **4.5.1** exposes `energyThreshold` instead | A; API verified |
| Spring reduced motion | **`ReduceMotion.System`** | Apply device preference; substitute the 100 ms crossfade where needed | A |
| `pressScale` | **0.98** | Restrained plate feedback; no bounce | A |
| Skeleton breathing | **1200 ms**, opacity **0.65→1** | Static opacity 1 under reduced motion | A |
| `disabledOpacity` | **0.50** | Disabled controls | A |