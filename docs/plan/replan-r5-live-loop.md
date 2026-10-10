# R5 — The live loop: calls and rides, Tradash at the core (replan stage 5)

**Goal:** Tradash's five steps — tap, watch your PnL move, trail, close, bank it — on both apps, for calls and rides:
- every open position is valued live;
- PnL starts at $0.00 and rolls with the price;
- one tap trails or closes;
- the close sounds and reads like a win or a loss.

**Authority:**
- `replan-2026-10-10.md` R5; D-298, D-299, D-303, D-305, D-308;
- research `01-tradash.md` (§1, §3 matrix, §4 top 15, §5 notes), `02-owarine.md` §6 A1–A11, `03` takes 2, 4, 5, 8–12,
  `05-contract-live-pnl.md`;
- port sources `../owarine/web/src/features/terminal/ui/{PositionsPanel,TradeButtons,Chrome,ChartControls}.tsx`,
  `ui/sheets/{SettingsSheet,Tutorial,ReplaySheet,AccountSheet,MarketsSheet,PositionSheets}.tsx`,
  `{replay,position-value,position-return,live}.ts`, `chart/{candles,candle-view}.ts`, `lib/sound/music.ts`;
- 21st.dev first for every component;
- one implementation in `@senryo/calls`, used by both apps (D-282).

**Gate:**
- `pnpm gate` 0;
- on both apps (web through the preview tools, phone through one simulator pass):
  - a call and a ride opened from the terminal with the PnL rolling from $0.00;
  - TRAIL armed in one tap;
  - CLOSE realised with the right sound, toast and confetti;
  - a knock-out shown;
  - the positions book matching the chain;
  - a guest's first Practice call with no sign-in;
- chart frame and render counts within the S5/S6 budgets.

## Steps

### The book
- [ ] R5.1 `useLiveBook`:
  - values every open position — calls via `quoteClose`, rides via `LinearMath`, parlays read-only — at up to 5 Hz from
    `live.prices` and display ticks;
  - replaces the map only on change;
  - `use-call-window.ts`'s one-window view is deleted.
- [ ] R5.2 PnL per D-303:
  - from the fair price at the fill (`Filled.probE6`; ride entry);
  - a Fees row;
  - B/E by bisection against `quoteClose` (rides in closed form);
  - colour by PnL ≥ 0;
  - fix the near-certain winner showing −$10 in the win colour (`packages/calls/src/quote.ts:236-237`).
- [ ] R5.3 Positions surfaces:
  - **web aside:** equity pill (cash + live values), Unrealized card (odometer, %, "N unpriced"), rows with ROI over
    PnL that expand to reduce/exits/share, Close all (n);
  - **phone:** a View-position pill (count + ROI) and a positions sheet;
  - **Home and Calls rows:** live value and Cash out, with Locked/Settled/Void states.

### The terminal
- [ ] R5.4 Mode switch Call | Ride. The order stack sits on the chart's edge (Stake · Leverage (ride) · Fees · Exit) and
  opens a settings sheet. Risk is written in words, and so is the knock-out price.
- [ ] R5.5 The button morph: UP/DOWN cross-fades to TRAIL/CLOSE.
  - TRAIL is greyed with "Need +x% to trail" until it qualifies, then reads TRAILING;
  - one tap arms the on-chain trail at the default distance;
  - the exit sheet stays behind a long press.
- [ ] R5.6 Chart levels on both engines:
  - entry, B/E (amber `[1,3]`), trail (`[6,3]`, 1.5 px), TP and SL;
  - knock-out (Liq) and cap for rides;
  - the path-to-entry gradient band.
- [ ] R5.7 Order controls:
  - stake presets plus keypad, with "remember last";
  - for rides, leverage chips up to the market's cap.
  - Shortfall opens Add money / test dollars with the amount pre-filled; the panel shows "after this: $Y".
- [ ] R5.8 Slippage limit in price terms (D-300), shared by calls and rides.
- [ ] R5.9 Hotkeys per D-308: in Real, ↑/↓/C act only with one-tap on.

### The moments
- [ ] R5.10 Instant first call:
  - a device-local Practice key for guests on the terminal (Practice only, granted test dollars);
  - the passkey account adopts it on sign-up (its test dollars move over).
- [ ] R5.11 Pending entry drawn at the tap.
  - One toast id carries the whole run: "Opening…" → "Up BTC opened" → "Cashing out…" → "Realized +$x", with the market
    mark.
  - The pending card becomes the receipt slip in place (stamp from the Kinpaku materials, folio, proof link, PNG
    download).
- [ ] R5.12 Win or loss sound by the realised sign at the close. Confetti on a win.
- [ ] R5.13 Unknown outcomes:
  - a journal of pending intents (survives reload);
  - `unknown → checking → recovered (filled / refused)` with Check status, never re-sending;
  - `trace.ts` is wired or deleted.
- [ ] R5.14 Privacy: masking reaches result toasts, the PnL pill, the canvas and share. Share is blocked while balances
  are hidden.

### Feel
- [ ] R5.15 A five-step tutorial on the first terminal visit (both apps; Owarine `Tutorial.tsx` reworded for calls and
  rides), reopened from Settings.
- [ ] R5.16 Sound and music:
  - the reactions switch wired on both apps, default on; `movement.ts` deleted;
  - tap sounds on the phone too;
  - cue levels raised to Tradash's, with the loss cue an octave lower;
  - music: `music.ts` on the web, pre-rendered loops on the phone, off by default, a footer toggle with a track chip,
    and the tense low-pass while PnL ≤ −5 %.
- [ ] R5.17 Candles and the chart footer:
  - interval, type and music;
  - Owarine's candle view on the web, Skia candles on the phone;
  - crossfade and haptic detents.
- [ ] R5.18 Rolling numbers:
  - a DOM odometer for every changing web number (cash-out, balance, odds, equity);
  - the rolling price in the asset chip;
  - pill digits at 15 px; canvas text in the display face.

### After the trade
- [ ] R5.19 Replay of a settled position (≤ 12 s) from its receipt.
- [ ] R5.20 Stats: lifetime PnL, win rate, trades, win and best streak, and volume.
- [ ] R5.21 Share from an open or closed position: PnL / ROI / Both, with tiered X text.
- [ ] R5.22 A web notifications inbox with marks (the phone's `SubjectMark` pattern).
- [ ] R5.23 Market picker on both apps: categories, star favourites, Hot sort, 24 h change (`/v1/prices/day`).

## Handoff
(written at the end of the stage)
