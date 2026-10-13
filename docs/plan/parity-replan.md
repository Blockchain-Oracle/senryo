# Parity ledger — the 10 Oct replan (Tradash · Owarine · Mitoshi · Sotto · UGLYCASH)

**Rule:**
- Every take-list row from the replan studies maps to a stage step.
- Nothing is dropped silently; "Excluded" needs the owner's decision.
- Status keeps **built**, **accepted** (simulator or preview, with evidence) and **deployed** as separate facts.

**Sources:** `docs/research/replan-2026-10-10/`:
- `01-tradash.md` §4 (T1–T15);
- `02-owarine.md` §6 (O1–O21);
- `03-canton-s2-mitoshi.md` §6 (M1–M15);
- `06-senryo-today.md` §1 (A1–A20);
- `04-pricing.md` §7 (R1–R18), tracked in `replan-r1-prices.md`.

## Tradash (01 §4)

| Id | Row | Step | Status |
|---|---|---|---|
| T1 | The line and numbers move about 5×/s (display feed) | R1.16–R1.17, R1.21 | — |
| T2 | PnL surfaces: Unrealized card, rows with ROI, equity pill | R5.1, R5.3 | — |
| T3 | The first tap is one tap (guest Practice, pending entry, opened toast) | R5.10, R5.11 | — |
| T4 | CLOSE sounds and reads like banking it (win/loss at fill, Realized toast, confetti) | R5.11, R5.12 | — |
| T5 | The whole reaction vocabulary fires (surge, mega, slump) | R1.22 | — |
| T6 | One-tap TRAIL in the button morph | R5.5 | — |
| T7 | Colour follows PnL ≥ 0 | R5.2 | — |
| T8 | PnL band and break-even, exit levels on the chart | R5.6 | — |
| T9 | Five-step tutorial on the terminal | R5.15 | — |
| T10 | Music, tense filter, a working reactions toggle | R5.16 | — |
| T11 | Rolling numbers on the web; live price in the chip | R5.18 | — |
| T12 | Order controls on the chart (Stake · Leverage · Fees · Exit) with risk in words | R5.4, R5.7 | — |
| T13 | Positions beyond the current window; View-position pill; Close all | R5.1, R5.3 | — |
| T14 | Chart controls and candles | R5.17 | — |
| T15 | Replay, stats, leaderboard, share from a live position | R5.19–R5.21, R8.1 | — |
| T16 | Linear long/short with leverage, Liq tag, close any time ("ride the price") | R3.8–R3.12, R4, R5.4 | — |

## Owarine (02 §6)

| Id | Row | Step | Status |
|---|---|---|---|
| O1 | Live positions book at 5 Hz | R5.1, R5.3 | — |
| O2 | A chart on real ticks (exchange display feed ≤ 8 Hz) | R1.16–R1.17 | — |
| O3 | TRAIL/CLOSE morph, B/E by bisection, B/E and Trail levels | R5.5, R5.6, R5.2 | — |
| O4 | Feedback defaults, music, reactions switch, `movement.ts` deleted | R5.16 | — |
| O5 | One visual system on the web (UGLYCASH) | R2.1–R2.5 | — |
| O6 | First-visit five-step tour, reopenable | R5.15 | — |
| O7 | Market picker: categories, Hot, favourites, 24 h change | R1.19, R5.23 | — |
| O8 | Candle view with gestures | R5.17 | — |
| O9 | Trade stats and replays | R5.19, R5.20 | — |
| O10 | Splash, PWA install, new-version toast | R2.17 | — |
| O11 | Share PnL / ROI / Both with X text tiers | R5.21 | — |
| O12 | Arcade package on web and phone | R7.4, R7.5 | — |
| O13 | Lucky reel sound, staggered stops, lock-in | R7.2 | — |
| O14 | Games hub meta (seasons, achievements, profile, settings) | R7.1, R7.6 | — |
| O15 | Duel feel (queue, lobby, flip, result, share) | R7.7 | — |
| O16 | Leaderboard and public profiles | R8.1, R8.2 | — |
| O17 | Reels vertical feed | R8.6 | — |
| O18 | Activity ticker and per-call publishing | R8.3 | — |
| O19 | Trader Edge report | R8.7 | — |
| O20 | Takes and Rooms | R8.8 | — |
| O21 | Search on the phone | R6.9 | built · accepted (Release simulator) · deployed (OTA `bdbdfe6b`) |

## Mitoshi, Sotto and UGLYCASH (03 §6)

| Id | Row | Step | Status |
|---|---|---|---|
| M1 | Neutral ground plus one brand colour (web on UGLYCASH) | R2.1–R2.4 | — |
| M2 | Unknown and recovered outcomes as first-class states | R5.13 | — |
| M3 | ⌘K: recents, open calls, all lanes, events, deposit, tx lookup, hints, people, phone | R6.1–R6.9 | built · accepted (production web, simulator) · deployed; people → R8.9 |
| M4 | Live positions everywhere with one-tap cash-out | R5.3 | — |
| M5 | The blocker names its fix (shortfall pre-filled) | R5.7 | — |
| M6 | Display feed separate from settlement, with a "Signed" marker | R1.16, R1.17 | — |
| M7 | Leaderboard surface | R8.1 | — |
| M8 | The receipt as an artifact with a stamp | R5.11 | — |
| M9 | Pending call as an object that becomes the receipt | R5.11 | — |
| M10 | Music with a mood (tense filter) | R5.16 | — |
| M11 | Privacy reaches every surface | R5.14 | — |
| M12 | Keyboard safety (no hotkey moves real money) | R5.9 (D-308) | — |
| M13 | Discovery: Hot movers, replay | R5.19, R5.23, R6.3 | Hot in search and the picker · built · deployed; replay v2 → R8.10 |
| M14 | Editorial restraint (one quiet line per surface; proof behind ⓘ) | R2.9, R7.2, R7.8 | — |
| M15 | Honest ticker and phone health indicator | R1.20 | — |

## Senryo audit (06 §1)

| Id | Row | Step | Status |
|---|---|---|---|
| A1 | Web colour is the retired Living Lacquer | R2.1–R2.2 | — |
| A2 | Games have no art and no logos | R2.6, R2.8, R7 | — |
| A3 | The Lucky spin's motion is broken | R7.2 | — |
| A4 | No game-feel layer | R7.1–R7.8 | — |
| A5 | Duel, Events and Earn are dead ends with engineering copy | R2.9, R4.7 | — |
| A6 | Logos missing where identity matters | R2.6–R2.8 | — |
| A7 | The phone has 1 of the 4 games | R7.3, R7.5 | — |
| A8 | ⌘K is a static list; no phone search | R6 | fixed · deployed (D-336…D-342) |
| A9 | Public copy contradicts the product | R2.12 | — |
| A10 | Events look borrowed (ESPN hot-links, explanatory) | R2.7, R7.8 | — |
| A11 | Three visual languages | R2.4 | — |
| A12 | Games and money places hard to find (rail, Back, phone guests) | R2.14 | — |
| A13 | Settings and copy for features that don't exist | R2.11 | — |
| A14 | The phone Status screen is a placeholder | R2.10 | — |
| A15 | Broken links between web and phone | R2.13 | — |
| A16 | Duel has no opponent and no drama | R7.7 | — |
| A17 | Signed-out dead ends and silent disabled buttons | R2.15 | — |
| A18 | No web notifications inbox; text-only result toasts | R5.22, R5.11 | — |
| A19 | Game screens explain instead of play | R7.2, R7.8 | — |
| A20 | Dead code and stale design records | R2.5, R2.16 | — |

## Contract and pricing rows (05, 07, 08)

| Id | Row | Step | Status |
|---|---|---|---|
| P1 | Near-certain winner shows −$10 in the win colour | R5.2 | — |
| P2 | σ follows the market (keeper σ marks), calibrated table, band widths from realised σ | R3.2–R3.4 | — |
| P3 | Spread curve h(p) by lane | R3.5 | — |
| P4 | Slippage limit in price terms | R5.8 | — |
| P5 | Fill delay as a bounded setting, set from measured δ | R1.18, R3.6 | — |
| P6 | Earn: hour cutoff, exact ride mark, `withdrawHold` | R3.15 | — |
| P7 | Batched `listSeries` | R3.1, R3.7 | — |
| P8 | Mainnet listing Up/Down until calibrated | R3.20 (D-306) | — |

## Owner review of production (12 Oct; research 10)

| Id | Row | Step | Status |
|---|---|---|---|
| V1 | Sound everywhere: every tap, trade, verdict and game moment has its cue (one map, both apps) | F1 | — |
| V2 | Music: games bed on Play, terminal tracks behind ♪, Duel pulse, ducking and the tense filter | F2 | — |
| V3 | Haptics on every press and verdict, Tradash's table on both apps; one Sound & vibration sheet | F3 | — |
| V4 | Everything tappable looks and moves tappable (lift, press, gloss, chevrons, focus) | F4 | — |
| V5 | Direction colours that aren't boring (acid green / coral / cyan) | F5 (D-316) | — |
| V6 | A 24 h graph and change chip beside every price, terminal header included | F6, F7 (D-319) | — |
| V7 | The ticket reads at a glance: label-only buttons, the strike on the chart, unpriced states outside the buttons | F8 | — |
| V8 | Practice ↔ Real is one tap on the web; Real is never blank on either app | F9, F10 (D-320) | — |
| V9 | Teams wear their crests; live scores on event cards | F11, F12 (D-315) | — |
| V10 | Games are real games: full screen, a game camera, physics, juice, sound and haptics | R7.1–R7.5 (D-318) | — |
| V11 | All four games on the phone | R7.6 | — |
| V12 | Game cards show the game (16:9 art, Play, best, live players) | R7.7 | — |
| V13 | Duel has a queue, a versus entrance, swipe cards with stakes and a result moment | R7.8 | — |
| V14 | Events read as a scoreboard with crests, team colours and a settlement moment | R7.9 | — |
| V15 | Value first, passkey only to sign: no account walls; the first commitment's sheet signs and completes it | F14 | — |

## Owner's phone review, 12 Oct afternoon (stage P; research `review-2026-10-12`)

Status keeps three facts apart: **built** (committed, gate green), **accepted** (seen working in the Release simulator,
the web preview or on testnet, with the evidence named) and **deployed** (production web/api/keeper/indexer, phone OTA).

| Id | Row | Step | Status |
|---|---|---|---|
| PR1 | Sheets sit above the dock: the scrim covers the ticket, the dock hides, nothing draws over the panel | P1 (D-321) | built `ff55a2a9` · accepted (simulator: DOGE market sheet over the ticket, dock gone) · deployed OTA `f2ee0f7b` |
| PR2 | The market sheet drags taller: 62 / 88 / 100 %, search raises it to full, the list scrolls only at the top | P1, P2 | built · accepted (simulator, each detent; the upward drag fixed after the first pass) · deployed OTA `f2ee0f7b` |
| PR3 | The market picker: search, Favourites · Hot · All · kinds, recents first, a star per row, the current market marked, reset on every open | P2 | built `08649e5e` · accepted (simulator and web, both widths) · deployed web `sha-08649e5`, OTA `f2ee0f7b` |
| PR4 | Parlay builds a chain: four sockets, the mark's flight into its socket, links that light | P3 (R7.10) | built `252aba6e` · accepted (simulator and web) · deployed web `sha-252aba6`, OTA `66b9f59c` |
| PR5 | Parlay cards: live price, 24 h line, change, per-side indicative odds for the lane | P3 (D-326) | built · accepted (simulator, web) · deployed |
| PR6 | One round strip, never a countdown per row; between rounds the sides become next-round drafts and the price waits | P3 (D-326) | built · accepted (simulator in the settling window, web dark) · deployed |
| PR7 | The slip always exists; it opens to legs, "Pays N×" from the chain's quote, stake, the fill floor, and a hold-to-place that names its blocker | P3 | built · accepted (simulator: a guest's hold opened the passkey step with the slip kept) · deployed |
| PR8 | Placed parlays settle as tracks; parlays in play on Calls | P3 | built · money path accepted on testnet (P7 parlay won, `0xe570…2f4a`); the track view itself not yet seen for a real account · deployed |
| PR9 | Duel stage: your seat vs the opponent's, the pot on the line, searching in the empty seat | P4 (D-322) | built `ceeda2e3` · accepted (simulator, web light and dark) · deployed api + web `sha-ceeda2e`, OTA `c1681c42` |
| PR10 | Tier tiles with live queue counts, "No pot" (never "Free"), the commitment spelled out | P4 (D-323) | built · accepted (`/v1/duel/queue` serves `waiting`; tiles read "First in this tier") · deployed |
| PR11 | The match on three market lanes (Warm-up keeps the deck), the verdict on the stage, Rematch and Share | P4 (D-322) | built · **not accepted live**: both apps point at production, where only a real account sits a seat; the scripted duel (P7) proves the money path, not this view · deployed |
| PR12 | Earn shows ownership: share value, net earned, share of the pool; a guest sees one share's value and what it did | P5 (D-325) | built `681a8a69` · accepted (simulator and web guest; net earned read for the R4 account, +$0.000031) · deployed indexer + api + web `sha-681a8a6`, OTA `e7565118` |
| PR13 | A share's value over 1D / 7D / 30D, never deposits, never exaggerated | P5 | built · accepted (simulator, web; span floor) · deployed |
| PR14 | Amounts only in a keypad sheet (phone) or amount modal (web), with ¼ ½ ¾ All, the estimate, the timing and the risk | P5 (D-325) | built · accepted (simulator keypad "$8", web modal "$50", both as guests) · deployed |
| PR15 | Status: one verdict with a tally; a tile per component, problems first, with its numbers and 24 h / 90 d bars; unknown never counts as a pass or a failure | P6 (D-324) | built `3e0b7295`, `ee25b7e2`, `954df526`, `1d8e560e` · accepted (simulator, web, both widths and themes, against production's records) · deployed api + keeper `sha-ee25b7e`, web `sha-1d8e560`, OTA `6edf6099` |
| PR16 | The web gets its first Status page; the phone's More row carries the live verdict | P6 | built · accepted (web preview; simulator "Status · Live" on a fresh build) · deployed web `sha-1d8e560`, OTA `6edf6099` |

## Owner's review, 13 Oct (stage Q; research `review-2026-10-13`, Codex 15 and 16)

| Id | Row | Step | Status |
|---|---|---|---|
| QR1 | Leverage is opt-in: rides open at 1×, one Leverage switch (the whole row), the multiple and a marked slider when on | Q1 (D-344) | built `0f3f666a`, `62439a89` · accepted (simulator: a 1× ride opened and closed on testnet; Off in one tap) · deployed web `sha-9931957` |
| QR2 | Ride settings drawn: margin line, two-rail risk ladder at true distances, Trail ruler, "Open fee ›" — the slop rows gone | Q1 (D-345) | built · accepted (simulator, production web as a guest) · deployed |
| QR3 | Call settings drawn: Stake hero over the payoff (zones, thin "Pays $x" bars on one scale, stake tick, live bead, settlement ring), one rule sentence | Q1 | built `d954a7b1`, `fdd6da0b` · accepted (simulator Up/Down, Range, Moonshot; production web) · bead/ring/thin bars deploying |
| QR4 | The live position row on every list: ring, head, ticking clock, recorded trace, rolling PnL; tap → that exact position | Q1 (D-343) | built `c05874f5` · accepted (simulator: ticks, swipe reveals Close, tap opens the ride with CLOSE ringed) · deployed |
| QR5 | Close from the row: phone swipe → "Close $x" (one tap), web always-visible "Close $x"; Close all as a review | Q1 (D-343) | built · phone fix `d954a7b1` (a revealed Close opened the trade) **not yet re-seen**; review not yet seen with two positions |
| QR6 | Position details and View receipt behind long-press / right-click | Q1 | built · not yet seen |
| QR7 | Exact-position selection: the selected ride or call drives the chart until another is picked or a trade placed | Q1 (D-340) | built · accepted (simulator, one position) · two positions not yet seen |
| QR8 | Restraint in the gate: dot chains, one FactList, no explainers, retired words; a dev inspector | Q0 (D-346) | built `62439a89` · gate green · deployed |
