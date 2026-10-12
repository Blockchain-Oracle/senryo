# Owarine — Parlay, Duel, Earn, Status and the market sheet (12 Oct study)

Owarine (`/Users/abu/dev/hackathon/owarine`, Canton S3, Expo 57 + Reanimated 4.5.1 like Senryo). Its **phone** Parlay,
Earn and Status are literal ports of older web pages; the strongest designs for Parlay, Status and the market sheet are on
its **web** trading screen (`web/src/features/terminal/**`) and the web Status redesign of 8 Oct. Paths relative to the
repo root.

## 1. Parlay

**A. Parlay inside the trading screen (the one to copy)** — `web/src/features/terminal/parlay/`
- **Picking legs:** no separate builder. A "Single · Parlay" switch sits above the Up/Down buttons with a 20 px pink
  count badge (`useTerminalParlay.tsx:126-143`). In Parlay mode the same two 64 px buttons add the market on screen as a
  leg; their sub-label becomes "add to parlay", or "in parlay ✓" once that side is picked (`:151-161`; `h-16
  rounded-full` in `ui/TradeButtons.tsx:42`). A second leg: switch market with the picker and press again. "Pick a
  market" / "Add another market" is a dashed 36 px round button that opens the market sheet (`ParlaySlip.tsx:78-82`).
- **The slip:** on a phone a 44 px pill above the buttons reads `Parlay · 2 legs … pays 2.35× →`
  (`useTerminalParlay.tsx:145-150`) and opens the slip in the shared sheet (`TerminalScreen.tsx:344-353`). The slip
  (`ParlaySlip.tsx`): header `PARLAY · n/3` with Clear; leg rows (`:139-164`) — 32 px coin, asset, coloured arrow,
  cadence, "closes in…" plus a live **ahead/behind** tag, the leg price in ¢, ✕; stake chips `[1, 5, 20, 50]` (`:17`,
  `h-7`); **Pays N×** on a rolling counter and "If all n land" in green (`:103-118`); "38 % chance all land" and a
  correlated-legs note (`:120-126`); a big pink pill `Place parlay · $5.00`, then "Can't be sold early. Pays when the
  last leg closes."
- **Motion:** legs enter `{opacity:0,y:8}`, leave sliding `x:24`, `0.18 s`, ease `[0.22,1,0.36,1]`, with layout
  animation (`:61-74`); every tap has sound and haptic. **No fly-to-slip anywhere in the repo.**
- **Persistence and closed markets:** the slip is kept in localStorage (`owarine.trade.parlay.v1`, `slip.ts:7-12`). A
  leg about to close moves itself to the next window on the same lane with a toast (`useTerminalParlay.tsx:66-81`).
  Adding is refused with < 25 s left (`LEG_MIN_LEFT_SEC = 25`) or at 3 legs (`:103-109`). Buttons disable when the
  market isn't trading.
- **After placing:** open parlays show as leg chips that tick off as each leg settles, valued live (`ParlayRow.tsx:35-36`).

**B. The phone `/parlay` page** (`mobile/src/features/parlay/`) is a long form ported from the web page — a "Your legs
n/max" panel with a ⚡ preset (`ParlayBuilder.tsx:79-96`), leg rows with a dropdown window picker in a transparent
Modal (`LegRow.tsx:137-165`), a 48 pt accent multiplier ticket (`ParlayTicket.tsx:83-89`). The same kind of plain form
Senryo has; **don't copy it.**

## 2. Duel

Owarine **also reuses its practice swipe deck for Duel** (`games/stage/SwipeDeck.tsx:2-3`, `DuelPicking.tsx:16`;
commit at 84 pt or 480 pt/s, follow 0.7, spring 260/26). What makes it feel different is each phase's own frame
(`DuelStage.tsx:109-171`):
- **Entry** (`DuelEntry.tsx:56-105`): a 2×2 grid of tier cards (48.5 % wide, radius 12), mono caps label over a 14 pt
  amount; the selected card on an accent border with an 8 % wash; players waiting in that tier; a "what this costs"
  list; inline refusals; one CTA.
- **Queue** (`DuelQueue.tsx:62-112`): a breathing "searching" panel (border 0.35→0.7 magenta with glow, 1,200 ms each
  way), pixel-art banner, "SEARCHING" in a pixel font, three dots bouncing 6 pt 150 ms apart; waited, queue size,
  rating band, next deck; a red-tinted Leave. A heavy "match found" haptic + sound (`DuelStage.tsx:64-69`).
- **Lobby** (`DuelLobby.tsx:30-48`): you vs opponent seats; address-derived avatar colour (`parts.tsx:144-148`); the
  current step with a spinner; the committed deck hash.
- **Picking** (`DuelPicking.tsx:42-94`): a full-width 4 pt timer bar that drains, green → accent → red; pulsing-dot
  "opponent away / deciding" lines; the deck with a "Stake" pill per card (`DuelFace.tsx:27-30`); your picks with dots.
- **Result:** a locked-in pixel mark with glow (`DuelResult.tsx:98-108`); a verdict panel bordered green/red; per-card
  rows tinted as each settles with card-win/loss cues; a **result modal** (`DuelResultModal.tsx:88-122`, max width 384,
  65 % backdrop, radius 24, 280 ms rise) — `WON/LOST` at 44 pt pixel font, the return %, two 64 pt avatars around "VS",
  three stat boxes (hits, P&L, pot); Share renders a PNG via `captureRef`.
- **Rating and history:** a season banner with a pixel trophy, a ladder with medals and your own row pinned
  (`DuelRank.tsx:50-55`, polled 10 s); history 8 a page (`hub/history/DuelHistorySection.tsx:36-41`); a hub "your
  match" resume tile (`hub/MatchTile.tsx`).

## 3. Earn

`mobile/src/features/earn/` (web the same):
- **Hero** (`EarnParts.tsx:16-33`, `ReservePanel.tsx:20-113`): "Earn the *maker vault*." 34.5 pt heavy; a gradient
  panel (radius 20) with a 46×2 accent tick; **share price as the hero number** (42 pt) with a green ▲ chip; "since
  launch"; reserve value and utilisation with a 5 pt glowing gradient meter. **No charts.**
- **Tabs:** Maker / Range / Parlay / Boost, underlined mono caps, scrolling (`EarnScreen.tsx:33-58`).
- **Signed out: no amount field.** "Take a seat to supply." + Connect; the position card "Take a seat to see it."
  (`SupplyCards.tsx:48-52`). The direct fix for Senryo's bare $0.00.
- **Amount entry is inline** (`SupplyCards.tsx:55-105`): "AMOUNT / seat 120.00", a 24 pt input with MAX and the unit
  inside, **quick chips at ¼, ½, ¾ and all of the wallet** (fallback 50/100/250/500, `web/src/features/earn/format.ts:31-38`),
  a round Supply button (max 280 wide, press 0.98).
- **Position card** (`:131-195`): value 36 pt, shares at the share price, a ghost "Withdraw all / Withdraw idle $x"
  sized to what's free, realised vs on-paper, what's still committed.
- **History:** "Where the capital is" — open windows, then the last 10 settled (`MakerEarn.tsx:40-80`).
- An unused keypad exists (`components/kit/ow/Keypad.tsx`: 3 columns, 64 pt keys, 28 pt digits, haptic per press).

## 4. Status

The phone port (`mobile/src/features/status/StatusRows.tsx`) is the old flat table. Use the **web redesign of 8 Oct**
(`web/src/features/status/StatusRows.tsx`, rebuilt because the owner found it "too small to see"):
- **Verdict hero** (`:44-102`): a wide card tinted by the verdict (green 10 % fill, 30 % ring; amber/red worse), the
  verdict in display type — "All systems live" / "Running degraded" / "Venue unreachable" — "Slowest: Oracle · Bitstamp
  freshness · 4m 10s", the ledger offset big on the right.
- **Count chips** 36 pt: "● 2 failing", "● 1 slow", "● 14 healthy".
- **Health strip:** one bar per check, 32 px row, 3 px gaps, **height by severity** (failing 32, slow 24, healthy 16,
  off 10 at 50 %). Thresholds: slow ≥ 60 s, failing ≥ 300 s (`protocol.ts:47-60`).
- **"Needs attention" cards first** (`:116-132`), worst first, tinted, value at title size.
- **Systems as expandable rows** (`:172-204`): 36 px icon, name, one-line summary ("All 3 healthy", "1 check slow",
  "Closed until the market opens"), a dot per check; expands to checks, each to detail; troubled systems start open
  (`:224`); 200 ms height animation.
- **Refresh:** a 28 px countdown ring for the 30 s poll, "Checked 14:56 · refreshes every 30 s"; the poll pauses while
  hidden (`useStatus.ts:19-21`). Unreachable shows a red alert panel (min 40 % of the screen).
- No uptime-history bars, no per-feed sparklines.

## 5. Market picker and bottom sheets

- **Libraries:** no `@gorhom/bottom-sheet`, no expo-router formSheet. The phone hand-rolls one drawer (Reanimated +
  Gesture Handler); web uses `@base-ui/react/drawer`.
- **Web `Sheet`** (`web/src/components/kit/Sheet.tsx:40-75`): sized to content between **50 % and 96 % minus the top
  inset**, max width 28 rem, top radius 50, a 3 rem bleed strip; 40×4 pink grab bar; header `[2.25rem 1fr 2.25rem]`;
  enter 420 ms `cubic-bezier(0.32,0.72,0,1)`, exit 250 ms; 50 % black backdrop fading with swipe progress. **z 9400 vs
  the dock's 40: the sheet covers the dock**; the backdrop blocks the ticket. The trading screen is padded by `--dock-h`
  (5.5 rem) so Up/Down never sit under the dock (`ShellChrome.tsx:47`).
- **`MarketsSheet`** (`web/src/features/terminal/ui/sheets/MarketsSheet.tsx`): opened from a glass chip (36 px coin,
  rolling price, ▾, "BTC · Bitcoin"); 44 px search pill; 32 px chips **Favourites / All / Hot 🔥 / Crypto / Stocks /
  Pre-IPO / Baskets** (`:19-28`); header "Market | Last price / 24h change"; rows (`:208-234`) — star, 32 px coin,
  name, symbol + shortest-window pill, live price, coloured 24 h change, skeletons, current row highlighted; Hot = the 6
  biggest movers; untradable markets listed at 70 % with a reason pill (`:105-128, 236-258`); resets to All + empty
  search on every open (`:79-84`); pick → tap sound, haptic, switch, close.
- **Phone `BottomDrawer`** (`mobile/src/components/drawer/BottomDrawer.tsx`): content-sized to 0.9 of the window (the
  ticket 0.92); spring `{damping 26, stiffness 260, mass 0.9, overshootClamping}`; close 220 ms ease-in quad; scrim 200 ms
  with blur 12; drag-up rubber-bands at 1/6; closes past 25 % of its height or 900 pt/s; hands off to the inner scroll
  only at scroll top; keyboard-aware; handle 36×5; radius 24. **The ticket is a native `transparentModal` route**
  (`app/_layout.tsx:31,85`; `app/ticket.tsx:32`), so it draws above the root dock. The dock has a hide switch only for
  full-screen games (`components/shell/immersive.ts`).

## Ranked ideas to borrow

- **Parlay:** Parlay as a mode of the trading screen ("add to parlay" / "in parlay ✓"); a slip pill that opens the slip
  sheet with the multiplier on rolling counters; leg rows with live ahead/behind, legs that roll to the next window, the
  slip kept across markets; stake chips and one big Place.
- **Duel:** a frame per phase (breathing search, vs lobby); the draining timer bar and "opponent deciding" pulses; a
  shareable result card (WON/LOST, VS avatars, three stats); tier cards in a grid with the cost list; a rating ladder.
- **Earn:** signed out shows no input; share price as the hero with a delta chip and utilisation meter; wallet-scaled
  chips and MAX; withdraw labelled with exactly the idle amount; "Where the capital is".
- **Status:** a verdict hero with the severity health strip; count chips; "Needs attention" first; expandable systems
  with problem ones open; a refresh countdown ring.
- **Market sheet:** min 50 %, max 96 %, drawn above the dock with a modal backdrop; pad the screen by the dock height;
  search, chips, stars, live price and 24 h change, untradable markets listed with a reason; reset on open.
