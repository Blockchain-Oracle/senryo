# The owner's review, 13 Oct 2026 — text density across both apps

**Trigger:** the owner, reviewing the phone after R6: Home's search capsule (white on dark, static), the open-position
row ("too much unnecessary stuff… direction, entry, everything is just slop"; "ends 09:57" never counts down; no way
to the trade), then the ride settings sheet ("too much text… boring… not creative… we know the leverage is 10×"), and
"look for the patterns even where I don't say". Memory: `feedback-restraint-not-text-dumps`.

**Method:** three read-only audits run in parallel on 13 Oct — every phone surface (`apps/mobile/src`), every web
surface (`apps/web/src`), and the references' restraint (Tradash specs + Owarine's port captures, Fomo R3 screens,
UGLYCASH, Mitoshi). Counts are from code with typical data. The position row's own direction is research 15 (Codex).

## 1. The numbers
- **Small, dim type dominates.** Phone: ~41 % of 533 `<Text>` nodes are 12 pt (caption 123, micro 26, meta 10, chip
  13) or 14 pt row detail (47). Web: 12 px classes used 216 times (`text-meta` 183); dim text 277 times; large numerals
  12 times in total. The terminal's order stack is 10–11 px; the live CLOSE amount 15 px (`trade-buttons.css:53`).
- **Label/value grids are the default renderer.** Phone: six separate row components (`OrderSheet.tsx:80`,
  `PositionRow.tsx:35`, `EarnScreen.tsx:242`, `EventDetailScreen.tsx:97`, `WindowProof.tsx:15`,
  `PredictionMarketCard.tsx:255`) plus slip facts, the stats grid, pending "quoted" rows. Web: `<dl>` in 12 files and
  40 `SummaryRow`/`Fact`/`Row`/`Figure` call sites.
- **Run-on " · " lines:** 164 in phone code, 147 in web code, 101 in the shared word helpers.

## 2. The densest surfaces (both apps; phone rank / web rank)
| Surface | Evidence | The one thing |
|---|---|---|
| Ride settings (1/1) | ~40–49 items, 8–10 summary rows; **10×** three times (big figure, chip, order stack), **40×** twice, **knock-out** three to six times (UP/DOWN lines, under both buttons `ride-tick.ts:62,80`, chart tag, row, exit modal, receipt); "Opening fee" and "Estimated closing fee" print the same `up.fee`; the cap three ways (Max profit / Up capped / Down capped); "Trade size" = margin × leverage; "After this" = balance − cost; explainer "Knocked out when 90% of the margin is lost." (`OrderSheet.tsx:155-213`, `RideSettings.tsx:68-132`) | Leverage, and how far price can move before knock-out |
| Receipts (2/2) | 55–65 items, 13 rows; payout three times, stake twice, amount won three times, the verdict four times (stamp, figure, last step, proof), two proof links, "View transaction" on every row (`trade-slip.ts:84-103`, `receipt.ts:71-176`, `CallTimeline.tsx`, `WindowProof.tsx`) | The stamp and the realised figure |
| Call settings (3/4) | ~33 items, 7 rows; stake three times, each side's payout three times, fees twice, settle time three times; win-condition sentence and a trail sentence (`OrderSheet.tsx:215-272`, `CallSettings.tsx`) | Stake, and what it pays |
| Event detail (4/3) | ~50 items; the close time **six** times; Yes share three ways ($, %, bar); rules paragraph, committee sentence, refund rule, hashes in hex, "Statement re-hashed here" per member | Yes / No on the pool split |
| Earn (5/8) | ~22 items + ~110 words; risk text twice on one screen (and in the modal); "next hour settles in" three to four times; backing as a row and a bar | Your share value |
| Terminal chrome (6/11) | payouts in the stack and under the buttons; the crowd bar and its sentence; "▲ $123.45 (0.12%) above the line" under a chart that draws the line; "Up to 4 h a ride · no funding"; one-tap said three ways | The chart and UP / DOWN |
| Positions rows and column (7/5) | the expanded 7-fact grid; leverage, direction and lane twice each; entry/KO/cap already drawn on the chart; one open position's PnL in four to five places; a full receipt inline per finished trade | PnL, time left, the way to the trade |
| Events list (8/7) | ~18–22 items per card; the close time three times per card; the pool split three ways; intro and rule sentences | The open questions |
| Exit sheets (9/9) | every row a title + hint sentence + chips + stepper; "runs with the app closed" five to seven times across the apps | Where it sells |
| Duel (10/10) | ~30 items idle; **the pot contradicts itself** — a $10 tier reads "$10 pot" on its tile and "$20 pot" on the stage and note (`duel.ts:20,40,45`); "the better total takes the pot" three to five times; the match countdown four times | Find an opponent |
| Ride receipt and live slips (11/—) | 9 facts; "Open" twice; derived trade size; knock-out and cap again | Stamp and figure |
| Status (12/—) | one verdict three ways (word, sentence, pill); dot + word per tile; "% working" under bars that show it | The verdict |
| Market rows (13/15) | the same "1m closes in 0:42" on every row; search rows print four clocks | Price and its 24 h move |
| Parlay (14/—) | rule sentences twice; "Pays" twice; a round clock and per-leg clocks | The chain and what it pays |
| Games (15/—) | "No stakes" three times on the hub; a fake "Play" pill; Lucky's deal card restates the reels; narration sentences | Play / Spin / Deal |
| Settings drawer (—/6) | ~35 items; three recovery paragraphs (~95 words); detail lines under toggles; duplicates of the eye button and the theme toggle | Sound; recovery status |
| Everything drawer (—/12) | 15 description sentences; duplicates of rail places | Navigation |
| Proof pages (—/13) | four prose blocks; header verdict repeating the bands | Line vs close, verified |
| Calls page (—/14) | a 6-cell stats grid; each row's verdict three ways (word, sign, colour); parlays twice | Your record |

Also flagged: Home repeats the top bar's balance and embeds the whole market list (web); the receive QR and address
appear on two screens; locked rows that do nothing ("Add real money", "Sending from another chain?" → Home); a toast is
always a title plus a sentence; the search preview is a fifth facts grid.

## 3. Cross-surface patterns
1. Fact grids rebuilt six times over.
2. One number printed in two to six places (stake, payout, fees, leverage, knock-out, close time, countdowns).
3. Text beside a visual that already says it (crowd bar + sentence; pool bar + % + $; status dot + word; slider + "x%
   of available"; pressed chip + big figure; row arrow + "Direction").
4. Lines glued with " · ".
5. Percentages in brackets ("$80,431 (−2.2%)") where a distance on a ruler would show it.
6. ALL-CAPS 12 pt section labels stacked on chips.
7. An explainer sentence under every control.
8. Countdowns everywhere, often repeated; `CountdownRing` used once.
9. Small type dominates.
10. Whole blocks mounted again instead of summarised (the positions list on four screens, market rows cloned, the
    event card inside its own page, a full slip inline).
11. Repeated reassurance ("runs with the app closed" ×5–7, "no seed phrase" ×5, "test dollars have no value" ×4).
12. Derived numbers presented as facts (trade size, "After this", the duplicated fee, max profit beside two caps).
13. Rows that do nothing.
14. One event narrated in parallel (a pending trade says "Signing…" in four places).
15. **The words are finished sentences in the shared package** (`packages/calls/src/*-words.ts`, `trade-slip.ts`,
    `receipt.ts`, `ride-quote.ts`, `quote.ts`, `stack-words.ts`): screens get strings, not numbers. Drawing bars, rings
    and ladders means these functions return values first — one change fixes both apps.

## 4. How the references stay quiet (rules, with sources)
1. The chart is the position: colour follows the PnL sign; PnL rides in the price pill (Tradash SPEC-chart §3.8–3.9).
2. Knock-out and cap are tagged lines on the chart, with edge tags off-screen — never rows (SPEC-chart §3.10).
3. Risk gets at most one line, attached to its number ("knocks out on a 1.1% move"); explanations behind ⓘ (Tradash
   SPEC-flow §4; Fomo F43).
4. Leverage is one big multiple plus one control — a ruler or a signed ladder (Fomo F37; Owarine `AimControl.tsx`).
5. Fees are one figure behind a chevron; the breakdown only on tap (UGLYCASH U01-S4/S5; Fomo F42).
6. One hero number of 40 pt or more per screen; secondary figures only when they mean something (Fomo F42).
7. A collapsed row holds at most four facts (Tradash's position row; UGLYCASH U13-S1).
8. The button names the state or the blocker; no error panels (Fomo F42; Mitoshi DESIGN.md).
9. The control is the progress: swipe → processing → ✓ in the same pill (UGLYCASH U01-S6–S8).
10. A close is a toast, a sound and confetti; a big result is a scene with one number (SPEC-flow §2.6; U01-S9).
11. Share artifacts are tilted physical objects (Owarine `rp-card.png`; UGLYCASH U05-S2).
12. Digits roll in the move's direction, decimals by size, trailing digits fade (SPEC-chart §3.8; U04-S1).
13. Time is a draining ring (Mitoshi `CountdownRing`).
14. Claims are stickers, not sentences (Mitoshi `Sticker`; UGLYCASH U04-S1).
15. Capacity is a bar with a cap tick (Mitoshi `CapitalBar`; Owarine `ReservePanel`).
16. Empty is an icon and three words over the ghosted surface; signed-out shows no input (SPEC-flow §8; Fomo F16).
17. The verdict is a seal stamp at −4° (Owarine `VerdictStamp`) — Senryo's Kinpaku stamp already does this.
18. Reactions replace copy: callouts near the knock-out and at milestones, glow flashes, the rising-scale sound
    (SPEC-chart §5).
19. Settings at rest are an icon and a value, labels for screen readers (SPEC-flow §4).
20. Never list zeros ("Hour by hour 0.000%" on Earn); say "No closed trades in this window" instead.

**Already visual in Senryo, to copy:** the welcome scenes, Parlay's sockets and tracks, Duel's stage, Lucky's reels,
Warm-up's deck, the Status bars, Replay, the chart's level lines, the icon-only chart footer, the tour illustrations,
`LiveHero`.

## 5. Found alongside (bugs, not density)
- **Finished rides never reached the Calls history** (both apps; fixed 13 Oct, `14a5b955`): the history read calls
  only, so a guest's BTC rides vanished once closed while the stats counted them.
- **Duel's pot contradicts itself** across tile, stage and note (`duel.ts:20,40,45`).
