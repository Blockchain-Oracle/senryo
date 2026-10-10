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
| O21 | Search on the phone | R6.9 | — |

## Mitoshi, Sotto and UGLYCASH (03 §6)

| Id | Row | Step | Status |
|---|---|---|---|
| M1 | Neutral ground plus one brand colour (web on UGLYCASH) | R2.1–R2.4 | — |
| M2 | Unknown and recovered outcomes as first-class states | R5.13 | — |
| M3 | ⌘K: recents, open calls, all lanes, events, deposit, tx lookup, hints, people, phone | R6.1–R6.9 | — |
| M4 | Live positions everywhere with one-tap cash-out | R5.3 | — |
| M5 | The blocker names its fix (shortfall pre-filled) | R5.7 | — |
| M6 | Display feed separate from settlement, with a "Signed" marker | R1.16, R1.17 | — |
| M7 | Leaderboard surface | R8.1 | — |
| M8 | The receipt as an artifact with a stamp | R5.11 | — |
| M9 | Pending call as an object that becomes the receipt | R5.11 | — |
| M10 | Music with a mood (tense filter) | R5.16 | — |
| M11 | Privacy reaches every surface | R5.14 | — |
| M12 | Keyboard safety (no hotkey moves real money) | R5.9 (D-308) | — |
| M13 | Discovery: Hot movers, replay | R5.19, R5.23, R6.3 | — |
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
| A8 | ⌘K is a static list; no phone search | R6 | — |
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
