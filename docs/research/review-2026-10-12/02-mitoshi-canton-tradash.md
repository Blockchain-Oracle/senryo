# Mitoshi, Canton S2 and Tradash — the five surfaces (12 Oct study)

What each reference holds:
- **Canton Season 2** (`/Users/abu/dev/hackathon/canton`) is Sotto (payroll, x402 marketplace): no Parlay, Duel, Earn
  or market picker. Useful: its status-page design spec and search-overlay states.
- **Canton Season 3's code is Owarine** (`/Users/abu/dev/hackathon/owarine`); `canton-season3` holds only the Tradash
  specs and the captured Tradash bundle.
- **Mitoshi** (`/Users/abu/dev/hackathon/crypto-world-fair`): Duel is an empty placeholder
  (`web/src/app/(app)/games/duel/page.tsx`) with a spec; Earn and the status chip are ported from Owarine.

## 1. Parlay

**Mitoshi** (`web/src/features/parlay/`):
- A list of live rounds, each row with its own Up/Down add buttons (rows 12×14 padding, radius 12, hairline; a row in
  the slip gets a vermilion border at 45 %; `WindowList.tsx:31-81`, `styles/parlay.css:45-49`).
- **Fly to slip:** tapping a side flies a chip ("BTC ▲") along an arc into the slip — 0.45 s, ease
  `[0.74,0.18,0.93,0.69]`, shrinking to 55 %, then the slip target pulses to 1.12 over 0.35 s
  (`components/ui/fly-to-target.ts:33-66`); reduced motion plays only the pulse.
- **Slip placement:** a 400 px sticky rail on wide screens; on phones a floating accent pill "Slip · 2 legs · Review
  slip" 4.75 rem above the tab dock (shadow `0 8px 24px rgb(0 0 0/.35)`) that opens the slip as a sheet
  (`SlipDock.tsx:48-77`, `parlay.css:30-39`).
- **Leg rows:** a numbered 24 px vermilion stamp, price, ✕, an Up/Down toggle and a stepper that moves the leg to a
  later round; enter/exit scale 0.96 over 0.2 s (`SlipLegs.tsx:57-97`).
- **Bottom of the slip:** Set stake / Set payout, the amount with +1/+5/+20 chips, totals (combined chance, pays ×, you
  pay, set aside, you win); **hold-to-place**, 1,800 ms (`ParlaySlip.tsx:87-123`, `hold-to-confirm.tsx:127`).
- **The button names whatever blocks you:** "Add at least two legs", "Leg 2's book is too thin to price", "Top up to
  place this" (`ParlaySlip.tsx:54-72`, `copy.ts:67-87`).
- **Tickets after placing:** the multiplier at 20 px / 800 in vermilion, one row per leg with ✓/✕/clock and a
  countdown, a full-width Claim (`Tickets.tsx:44-95`).

**Owarine mobile** (`mobile/src/features/parlay/`): "Pays 4.12×" as the hero (48/52, −1.2 tracking, accent, centred)
with "3 legs · 12.4 % combined" (`ParlayTicket.tsx:83-89, 198`); a one-tap "BTC close streak" preset
(`ParlayBuilder.tsx:79-96`); legs that roll to the next round (`:62-77`); "No legs yet" + "Add your first leg"
(`LegPlate.tsx:50-80`).

**Tradash:** no parlay.

## 2. Duel

**Owarine mobile is the only built one** (`mobile/src/features/games/duel/`), and it too picks with the warm-up deck.
The duel feel is everything around it: a screen per phase with no separate state, so a reconnect redraws the right one
(`DuelStage.tsx:122-170`; reconnect on foreground `:73-78`); tier cards in a 2-column grid with a cost list and a
refusal line (`DuelEntry.tsx:56-105`); a breathing "Searching" plate (pink 35 %→70 % border with glow, 1.2 s; three
dots bouncing 6 pt 150 ms apart; waited / waiting / rating band; a red Leave always visible; `DuelQueue.tsx:62-105`,
colours `theme/web/games-duel.ts:9-17`); the lobby's seats with "vs" and a receipt proving the cards were fixed before
either side saw them (`DuelLobby.tsx:28-52`); a 4 px urgency-coloured drain bar and "Opponent deciding / away" pulses
(`DuelPicking.tsx:42-108`); a locked-in mark, per-card win/lose sounds as cards settle, a verdict plate with both real
P&L (`DuelResult.tsx:57-79`); a result modal — **WON/LOST 44 pt pixel type**, the return %, two 64 pt avatars around
VS, three stat wells, Share as PNG (`DuelResultModal.tsx:77-117, 132-145`); a rank ladder with your row pinned and
medals (`DuelRank.tsx:48-52, 131`). Planned and never built: a **"Showdown" skin** — a card battle in a sumo ring with
banzuke ranks and deal/flip/slam animations (`canton-season3/context/13-revamp/PLAN.md:106`).

**Mitoshi spec only:** a radar for searching → steps (Queue → Opponent found → Stakes locked → Start) → a vs card → a
start countdown → invite copy, Cancel always visible (`context/tempo/research-2026-09-29/21st-weak.md:150-160`).

## 3. Earn

**Owarine mobile:** "Earn the **spread**." beside a live panel — radius 20, gradient wash, 46×2 accent tick, **share
price as the hero number** (42 pt) with a green ▲ chip and "since launch", reserve value and utilisation with a 5 px
gradient meter (`ReservePanel.tsx:40-113`); reserves as scrolling underline tabs (`EarnScreen.tsx:34-67`); **signed out
shows no input** — "Take a seat to supply." + Connect, "Take a seat to see it." (`SupplyCards.tsx:48-53, 151-152`);
signed in: "AMOUNT" + balance, a 24 pt mono input with MAX and the unit, **chips at 25/50/75/100 % of the wallet**
(fixed 50/100/250/500 when empty; `web/src/features/earn/format.ts:34-38`), a pill CTA (max 280, press 0.98); the
position card — value 36 pt, shares at the share price, **one withdraw button sized to what's free** ("Withdraw all" /
"Withdraw 12.40 USDC idle"), realised vs on-paper, what's committed (`SupplyCards.tsx:131-195`).

**Mitoshi** draws the whole card as if signed in; the CTA opens sign-in for that exact intent ("to supply $25.00")
(`web/src/features/earn/SupplyCards.tsx:30-75`); loading shows a skeleton of its own shape (`Hero.tsx`).

## 4. Status

**Owarine web** (rebuilt after "too small to see… rows should be dropdowns so it doesn't look like slop";
`owarine/web/src/features/status/StatusRows.tsx`): a verdict banner — "All systems live" / "Running degraded" in 40–64
px display type on its tone's wash, "Slowest: Oracle · 4m 10s", the ledger offset big, **a tally of pills** and **a
pulse strip** with bar height by severity (bad 32, slow 24, ok 16, off 10 at 50 %; `:49-102`); "Needs attention" cards
first (`:117-132`); systems as an accordion (36 px glyph, name, a one-line answer, a dot per check; problem systems
open; 200 ms; `:162-258`).

**Mitoshi:** a "network · Running" chip in the shell, polled every 30 s only while visible, linking to `/status`
(`components/shell/HealthChip.tsx:11-36`); a "Trading halts" row linking to a halts board.

**Canton S2 copy rules:** "Last probe 18 sec ago", never "Live" without a timestamp; honest states — all-zero, one
source delayed (mark only the affected figures partial), calculating (keep the previous value with its timestamp)
(`.thoughts/design/2026-07-12-sotto-x402-surface-map/06-statistics-health.md:50-73`).

## 5. Market picker and sheets

**Tradash** (`canton-season3/context/13-revamp/tradash/bundle-2026-10-07/pretty/1ajlb01q0ta5l.js:91-139`;
`SPEC-flow.md:72-77, 554-572`):
- **The phone has no tab bar**: one screen; every secondary page is a sheet over the chart.
- **Sheet:** top radius 50, max width 28 rem, **at least half the screen, at most `calc(96dvh − safe-top − 12px)`,
  else content-sized**, so a long list opens near full height; backdrop black 50 %; spring 30/300 in, 0.25 s ease-in out;
  **dismiss past 110 px or faster than 550, drag disabled until the list is scrolled to the top**; a 40×4 accent grab
  bar, a small centred title, a round ✕.
- **Picker:** a search pill with clear ✕; chips Favourites · All · Hot 🔥 · Crypto · Commodities · Stocks, **reset to All
  with empty search on every open**; header "Market | Last price / 24h change"; rows — gold star `#F5B90A`, 32 px logo,
  name, symbol + leverage badge, price and 24 h % (skeletons), the current market on a 10 % white; tap switches and
  closes; empty states "No favourites yet. Tap a star to add one." / "Loading movers…" / "No markets match that search."

**Owarine web** re-implements that sheet (`components/kit/Sheet.tsx:40-73`, z 9400 above the dock, 420/250 ms, a 3 rem
bleed, a pinned footer slot); its picker uses it (`features/terminal/ui/sheets/MarketsSheet.tsx:142-195`).

**Owarine mobile** solves "the dock covers it": the ticket is a `transparentModal` route (`mobile/src/app/_layout.tsx:31,
85`) above the tab stack and its dock; `BottomDrawer` content-sized to 0.9 (ticket 0.92), spring 26/260/0.9 without
overshoot, 220 ms out, dismiss past 25 % or 900, upward rubber-band 1/6, blur-12 scrim with `accessibilityViewIsModal`,
keyboard-aware, handle 36×5 (`components/drawer/BottomDrawer.tsx:19-24, 115-175`).

**Mitoshi** (`web/src/components/ui/drawer.tsx:21-28`, `styles/drawer.css:87-105`): one drawer — a right slide-over on
wide screens, a bottom sheet on phones (min 50dvh, max 94dvh, radius 32, 40×4 accent bar, 380 ms in
`cubic-bezier(.32,.72,0,1)`, 240 ms out), modal (focus trap, scroll lock), z 60/61 above the dock's 45; its picker
(`features/terminal/ui/MarketsDrawer.tsx:57-121`) adds Hot movers and 24/7 tabs, a "why" line for symbols with no live
round, Paused rows. Its 21st map suggests snaps `[0.5, 0.92]` (`context/tempo/research-2026-09-29/21st-map.md:41`).

**No reference uses snap points**: all size the sheet to content between half and 0.9–0.96 of the screen.

**Canton S2 search overlay** (`01-global-shell.md:58-60`): recents and shortcuts before typing; fixed-height skeleton
rows while loading so the overlay never resizes.

## 21st.dev components the references cite

- **Mitoshi** (`docs/specs/ux.md:70-84`, `context/tempo/research-2026-09-29/21st-map.md`, `21st-weak.md`):
  - Parlay: **109** interactive-checkout, **24524** motion-add-to-basket, 29356 order summary, 29940 quantity stepper,
    16240 prediction-market ticket, **23527** hold-to-confirm, 23552 segmented control.
  - Duel: 10759 radar-effect, 23569 task-steps, 21217 comparison-2 (vs), 19328 countdown, 23529 copy-button.
  - Earn: **28413** collapsible-05 (vault card), 30538 balance-chart, 26923 tabs, 28357 amount group, 31642 usage
    meter, 26545 partition-bar.
  - Status: **26906** openstatusHQ/status-bar, 24943 incident timeline.
  - Sheets and search: **31360** wensity/drawer (snap points), 11444 coss drawer, 31354 wensity/command.
- **Owarine:** 15742 Dock, 1354 Credenza, ddoemonn/swipe-deck, 24882 status dot, 7945 asset card.

## Ranked ideas to borrow

1. **Parlay:** live-round rows with inline add buttons plus a floating "Slip · N legs" pill above the dock that opens the
   slip; a big "Pays N×" hero with combined chance; a place button that names its blocker, hold-to-place; the one-tap
   streak preset and legs that roll to the next round; the fly-to-slip arc.
2. **Duel:** a different shell from the warm-up around the same deck — seats with vs on every phase, presence lines, the
   drain bar; the distinct queue; the result modal and per-card sounds; tier cards with a cost list; the Showdown skin
   and the rank ladder.
3. **Earn:** never show the input signed out; share price as the hero with a delta chip and a utilisation meter;
   wallet-scaled chips and MAX; withdraw sized to idle capital; realised vs on-paper.
4. **Status:** the verdict hero with the tally and the pulse strip; "Needs attention" first; the accordion; timestamps on
   every figure; a health chip in the shell, polled only while visible.
5. **Market sheet:** above the dock (a `transparentModal` route or a higher z); half to ~0.92–0.96 tall, content-sized;
   a modal scrim that makes the ticket inert; drag-to-dismiss only at the list's top (110 px / 550); keyboard-aware; the
   Tradash content with its reset-on-open, stars, skeletons and three empty states.
