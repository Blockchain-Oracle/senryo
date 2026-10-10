# Tradash fidelity study and gap analysis (10 Oct 2026)

**Verdict in four lines.** Senryo already carries Tradash's *chart engine* and *reaction engine* almost constant for constant
(600-sample ring, eased head, ±7.5-step y-axis, Catmull-Rom line with glow, 32 % fade, dot field, rolling pill, the
combo/surge/callout engine, the pentatonic profit ladder). What it does not carry is everything *around* the chart that makes
the loop feel like Tradash: a feed fast enough to make the line and the digits live, the PnL surfaces (Unrealized card,
position rows, ROI, live equity), the one-tap moments (instant open with its toast, CLOSE that sounds like a win or a loss,
TRAIL in the button morph), the floating settings stack, music, the tutorial, chart controls and the history/replay sheets.

## What I could not check (read this first)

- **No position was opened on Tradash** (no orders, not even demo). Everything about Tradash's live position, PnL pill, band,
  TRAIL/CLOSE and toasts comes from the 7 Oct bundle specs and the 7 Oct live observations, not from a fresh observation.
- **No audio was listened to**, Tradash's or Senryo's. Sound rows compare numbers (measured pitch contours, gains, timings).
- **The Senryo phone app was not run** on a device or simulator. Phone rows come from source only.
- **Tradash's price-change rate is UNVERIFIED.** On 10 Oct the Bulk ticker sent frames every ~200 ms, but the BTC mark price
  took only 2 distinct values in 40 s (a quiet book), so I could measure frame cadence, not movement cadence.
- **Whether Senryo's Pyth key can stream faster than once a second is UNVERIFIED.** I only measured what production sends.
- **Tradash's sheets were not re-opened today** (settings, account, markets, history, leaderboard, tutorial). The browser pane
  already held Tradash demo state from an earlier session, so the tutorial did not auto-open. Their rows rely on SPEC-flow.md.
- **Senryo's signed-in terminal** (balance, holding a call, exit armed) was not observed live; only the signed-out terminal was.

## 0. Evidence

Path shorthands used below:

| Short | Path |
|---|---|
| `T/` | `/Users/abu/dev/hackathon/canton-season3/context/13-revamp/tradash/` |
| `B/` | `T/bundle-2026-10-07/pretty/` (Tradash's shipped Next.js chunks, pretty-printed) |
| `SC` | `T/SPEC-chart.md` (chart, motion, reactions, sound, haptics) |
| `SF` | `T/SPEC-flow.md` (layout, loop, sheets, demo, copy, states) |
| `LO` | `T/LIVE-observations.md` (7 Oct, demo mode, 1440×900 and 390×844) |
| `SA` | `T/SOUND-analysis.txt` (pitch/level contours measured from the six MP3s) |
| `TF` | `/Users/abu/dev/hackathon/canton-season3/context/13-revamp/TRADASH-FIDELITY.md` (Owarine's ledger) |
| `W/` | `apps/web/src/` in this repo |
| `P/` | `apps/mobile/src/` in this repo (the phone app) |
| `pkg/` | `packages/` in this repo |
| `OW/` | `/Users/abu/dev/hackathon/owarine/web/src/` (Owarine, HEAD `90a91d71`) |

Earlier Senryo study: `docs/design/reference-study-2026-10-07-uglycash/tradash.md` (7 Oct) and
`docs/research/pivot/reference-products.md` §Owarine.

**Live checks made today (10 Oct 2026, read-only, no sign-in):**

1. **The Tradash bundle has not changed since 7 Oct.** `https://www.tradash.xyz/trade/BTC` serves the same 24 chunk names as
   `T/bundle-2026-10-07/page.html`, and the SHA-256 of the chart chunk `1ajlb01q0ta5l.js` (`1919a278…aa16`), the trade-screen
   chunk `1-glruyr--bvu.js` (`bfee8df0…c58ad`) and the sound chunk `1czbf01g7irmg.js` (`6fa0a483…0c0f80`) are byte-identical to
   the retained copies. The specs therefore describe the Tradash running today. Theme colour `#08090c`; the page's meta
   description calls it BTC perpetuals with a live chart and one-tap UP/DOWN. Server-rendered stack values for a fresh visitor:
   Size $5.05, 40×, Fees $0.11, Trailing 0.10 % (live-mode defaults, matching SF §2.1 and §4).
2. **Tradash feed cadence:** a read-only subscribe to `wss://mainnet-ws1.bulk.trade` (`ticker`, `BTC-USD`) delivered 68 frames
   in ~13 s (gap p50 201 ms, min 144, max 245) and 192 frames in 40 s; the mark price changed 26 times between 2 values.
3. **Senryo feed cadence:** `GET https://api.senryo.xyz/v1/stream?topics=prices` for 20 s delivered exactly 20 ticks per market
   (publish-time gaps all 1000 ms; three markets streaming). The gateway would allow 8 frames/s
   (`services/api/src/prices/constants.ts:20`, `FRAME_GAP_MS = 125`), so the 1/s comes from the source.
4. **Screens observed in the browser pane:** Tradash phone (560 px) and desktop (1440×900, scaled) layouts; Senryo
   `https://senryo.xyz/app/trade/btc/` at phone width and at 1280×800, signed out. Notes are in §2 and the matrix.

The measurement scripts lived in this session's scratchpad only; nothing was added to either repo besides this file.

---

## 1. What Tradash is and does

### 1.1 The product in one paragraph

Tradash ("One Tap Away From Glory", landing headline) is a one-screen perpetuals front end on the Bulk exchange. The whole app
is `/trade/{SYM}`: a live line chart fills the screen and *is* the workspace; you tap UP (long) or DOWN (short), a leveraged
position opens instantly, your profit or loss rides on the price line, you tap TRAIL to lock profit and CLOSE to bank it.
Everything else (markets, settings, account, history, leaderboard, share, replay, tutorial, install) is a bottom sheet over the
chart. There are two modes: demo (local $10,000, instant fills, no login) and live (Privy login plus two one-time signatures,
then real orders) (SF §0, §5). Markets: BTC, ETH, SOL, XRP, ZEC, HYPE, PAXG (gold), PUMP (SF §6).

### 1.2 Screens and layout

**Desktop, ≥ 1024 px** (one breakpoint, SF §1.1): CSS grid `220px | 1fr | 320px`, full height, no page scroll (SF §1.2).
- Left nav: logo + "Tradash", then Markets (opens the markets sheet), History, Statistics, Settings (all three open the Account
  sheet on its menu, SF §1.2 line 44).
- Centre: dot-field canvas, chart canvas, reactions overlay; asset chip top-left; floating settings stack on the left edge at
  mid-height; interval + chart-type control bottom-left; recentre button bottom-right (candle view only) (SF §1.2).
- Right rail: music toggle + equity pill (the "?" is the avatar placeholder, not help); Unrealized PnL card; positions list
  ("No open positions" when empty); UP/DOWN pinned at the bottom (SF §1.2; seen live 10 Oct).

**Phone, < 1024 px** (SF §1.3; seen live 10 Oct at 560 px): header with asset chip left and equity pill right; full-bleed
chart; settings stack on the left edge; a footer row `1m ⌄ · line/candles · music` (recentre on the right); a "View position /
View N positions" pill with the total ROI when anything is open; UP/DOWN full width at the bottom. No dock, no other screens.

**Sheets** (SF §1.4): one bottom sheet primitive everywhere, desktop included: `rounded-t-[50px]`, max width 28 rem,
min height 50 dvh, spring in (damping 30, stiffness 300), 0.25 s ease-in out, drag down > 110 px or velocity > 550 to close,
accent-coloured grab bar, centred muted title, round ✕.

**Toasts** (SF §8): top centre, at most 3, spring in from y −60; success 3.5 s ✓, error 5 s ⚠, info 3.5 s ⓘ, loading persists;
a repeated id replaces in place (loading → result); `confetti: true` bursts on the toast's own canvas (2 × 34 pieces, 1.1 s).

**Splash** (SF §8): logo and an animated sparkline, 1.4–3.5 s, not on `/`; the chart loop starts only after it (SC §2.3).

### 1.3 Moment by moment (the loop)

| # | Moment | What happens | Source |
|---|---|---|---|
| 1 | First visit | Splash; tutorial auto-opens (5 full-screen steps, progress dots, Skip); last step offers Try Demo / Try Live | SF §5; `B/1-glruyr--bvu.js:8602, 8757` |
| 2 | Watching | Line glides, pill digits roll, dot field drifts; no position means always green and silent | SC §0, §3, §5.2 |
| 3 | Tap UP | No tap sound; demo creates the position synchronously at the chart price; `open` sound + `[12,20,12]` haptic; toast "Long BTC opened · 40× · $500.00 margin" | SF §2.2 |
| 4 | Live tap UP | Guards (connect / one-tap setup / builder approval); chart draws the entry at once (`setPendingChartEntry`); loading toast "Opening long BTC…" that the success toast later replaces | SF §2.2 |
| 5 | Position live | Buttons cross-fade to TRAIL (disabled, "Need +0.1% to trail") and CLOSE; pill grows a PnL row; dashed Entry line and gradient band; whole line flips red while PnL < 0; rail shows Unrealized PnL and the position row; phone shows "View position −0.0%" | SC §3.8–3.10; SF §2.3–2.4; LO "Loop"; `B/1-glruyr--bvu.js:10384, 10437, 10447, 11337` |
| 6 | PnL moves | Favourable steps climb a pentatonic pitch ladder with a 6 ms tick; second adverse step blips low; surges flash the chart edge with an arpeggio; emoji callouts ride the head | SC §5 |
| 7 | Trail | Once the move exceeds the trail distance, TRAIL arms; stop ratchets; toast "Trailing stop armed · BTC"; demo caption "Demo: only while app is open" | SF §2.5; `B/1-glruyr--bvu.js:16951` |
| 8 | Close | One tap, no confirm, whole position; win sound if PnL ≥ 0 else loss; 20 ms haptic; toast "Closed BTC · Realized +$x", confetti if > 0; buttons morph back; size re-derives from the new balance | SF §2.6; LO "Loop"; `B/1-glruyr--bvu.js:16579` |
| 9 | Afterwards | Trade history with stats, replay of the recorded path, share card (PnL/ROI/Both, Download, Share on X) | SF §2.6, §7 |

### 1.4 The live price line (SC §1–§3; constants confirmed in `B/1ajlb01q0ta5l.js`)

| Behaviour | Tradash value | Source |
|---|---|---|
| Feed | Bulk WS `ticker` mark price, one shared socket, REST snapshot on subscribe, reconnect after 1.5 s, no heartbeat | SC §1.2 |
| Feed cadence | ~5 frames/s (measured 10 Oct, p50 201 ms) | live check 2 |
| Chart vs store | Chart gets every tick; app store commits ≤ 1 per 200 ms per symbol (leading edge) | SC §1.2 |
| Easing | `value += (target − value) × 0.18` per frame (τ ≈ 84 ms at 60 Hz; twice as fast at 120 Hz) | SC §3.1; `B/1ajlb01q0ta5l.js:12592` |
| Sample buffer | 600 eased samples, one per frame; x = sample index (≈ 10 s at 60 Hz); prefilled flat at the first price | SC §3.2; `B/1ajlb01q0ta5l.js:13124, 13253` |
| Y-axis | Centred on the eased price every frame; ±7.5 steps, step = nice(0.01 % of price), frozen at reset (BTC: $10 steps, ±$75) | SC §3.4 |
| Curve | Uniform Catmull-Rom → Bézier (1/6); 6 px stroke at 18 % under a 2 px stroke; no area fill | SC §3.3, §3.6; `B/1ajlb01q0ta5l.js:13503` |
| Tail | Left 32 % erased (alpha 1 → 0.55 at 45 % → 0) | SC §3.2 |
| Grid and axis | Majors only, 1 px white 6 %; ticks both edges (6/3 px); labels right at w − 14, 11 px mono `#8b90a0`, fading near edges and the pill | SC §3.5 |
| Head | 3.5 px dot, no pulse | SC §3.7 |
| Pill | Capsule filled with the line colour, right edge at w − 14, line ends 10 px before it; 26 px tall (`700 15px` mono price) or 34 px with a position (price 14 px over PnL 11 px, `+$1,234.56`, true minus) | SC §3.8 |
| Raw vs eased | Pill digits show the latest *raw* tick; line, grid and head use the eased value | SC §3.1 |
| Rolling digits | Per-digit slots, ease 0.22/frame, roll forward on a rise and backward on a fall; pitch 20/16/14 px | SC §3.8 |
| DOM odometer | Every changing number in the UI (equity, asset price, PnL, ROI): 0–9 strips, 260 ms `cubic-bezier(0.22,1,0.36,1)` | SC §3.8; SF §3.1 |
| Watermark | Logo at 7 %, ≤ 260 px, behind the line | SC §3.6 |
| Dot field | 34 px grid, r 1.1, x at half the line's scroll, y drifting with price velocity | SC §5.5 |
| Price decimals | ≥ 1e5 → 1, ≥ 1e3 → 2, ≥ 10 → 3, ≥ 0.01 → 4 | SC §3.5 |
| Colours | Up/line `#72E912`, down `#E6432D`, ink on pill `#08090c` | `B/1ajlb01q0ta5l.js:13183–13190, 13648` |

### 1.5 Live position and live PnL

- **PnL** = (price − entry) × size × side; live PnL is anchored to the exchange's last figure and moves with the chart price
  between account updates; ROI = PnL / margin (SF §2.3, §3.1).
- **Colour rule:** green unless an open position's PnL < 0, then line, head, pill and band all turn red; tick direction never
  colours anything (SC §3.9).
- **Band:** the price path closed down to the entry line, gradient 0.22 → 0.02 alpha from price side to entry side (SC §3.10).
- **Level tags at the axis:** Entry `[4,4]`, B/E `[1,3]` amber (live), TP/SL `[5,3]`, Liq `[2,3]` red, Trail `[6,3]` bold in
  the line colour; off-screen levels become edge tags such as "▲ Entry $x" (SC §3.10).
- **Unrealized PnL card:** label, `text-2xl` odometer, ± % of total margin; "Close all (N)" with more than one position
  (SF §2.3; `B/1-glruyr--bvu.js:11337, 11368`). Decimals follow magnitude (4 under $10), so small PnL visibly ticks (SF §2.3).
- **Position row:** logo, symbol ↗/↘ (link), "Bitcoin · 40×", ROI over PnL odometers, chevron, share; expanded rows Direction,
  ROI, Avg entry, Current, Break-even (live), Liquidation (red), Margin, TP/SL (live), then `+ Add` / `− Reduce`. No per-row
  close (SF §2.3).
- **Phone pill:** "View position / View N positions", icon by total PnL sign, total ROI odometer, opens "Open positions"
  (SF §2.4; `B/1-glruyr--bvu.js:10384`).
- **Equity pill:** balance + Σ unrealized, odometer, skeleton while loading, "Connect" when logged out (SF §1.6).

### 1.6 Order controls

- **Floating settings stack** (SF §4): glass, flush to the left edge, mid-height, rows Size · Leverage · Fees · Trailing as
  icon + 11 px value; peeks in from x −12 and settles after 1.4 s; draggable vertically; tap opens "BTC settings".
- **Settings sheet:** SIZE (available, $ input, slider, Min/25 %/50 %/Max, "N % of available", Reset to default), LEVERAGE
  (max, big value, risk in words "liquidates on a 2.50% move against you", chips 1×/10×/20×/40×, locked while open),
  TRAILING STOP (0.10 % default, presets 0.10/0.50/1.00/2.00 %), summary rows Trade size · Margin at risk · Fees, each title
  with a ? tooltip (SF §4).
- **Size defaults:** margin = max(minimum, 5 % of available), re-derived on every balance change until touched (SF §2.1).
- **UP/DOWN:** `rounded-full`, tinted (`bg-up-soft text-up`, `bg-down-soft text-down`), large tracked caps (SF §2.4; seen live).
- **Morph:** with a position on the active market, UP/DOWN cross-fade (`mode="wait"`, y 12 → 0, 0.18 s,
  `[0.22,1,0.36,1]`) into TRAIL and CLOSE (SF §2.4).
- **Add / Reduce sheet:** amount, slider, 25/50/75/Max (Reduce 25/50/75), "After this order" preview, min $5; Add plays `open`,
  Reduce plays `close` (SF §2.7).
- **TP/SL sheet** (live only): ROI % / Change % / P&L modes, trigger inputs, validation copy (SF §2.8).
- **Keyboard:** none beyond Escape closing overlays (`B/1-glruyr--bvu.js:2184, 3271, 4075, 9340, 9789`). No ⌘K, no search
  outside the markets sheet.

### 1.7 Reactions (SC §5; SF §3.2)

Runs on the ≤ 5 Hz store commits, only while a position is open on the market on screen.
- **Steps:** threshold = clamp(2.5 × EMA|Δp| (α 0.03), 0.005 %, 0.08 % of price); favourable steps count a combo, an adverse
  step resets it.
- **Surges:** inside a 1.5 s window of ≥ 4 points spanning ≥ 900 ms, z = |Δ| / (baseline·√n); surge at z ≥ 3 and ≥ 0.025 %,
  mega at z ≥ 4.5 and ≥ 0.06 %; 3 s cooldown; needs ≥ 12 samples. Against the position it is a slump.
- **Callouts:** emoji pools (combo 3/6/10+, surge, mega, adverse, slump), ROI milestones 10/25/50/100/200 %, new high after a
  30 % give-back, comeback from −3 %, near liquidation (< 25 % of entry→liq, re-arm > 40 %); silent for the first 1.2 s;
  cooldown 2.2 s (0.9 s for epic/warn); at most 2 on screen, riding the head; lifetimes 1.5/1.8/2.2/2.6 s; epic is gold
  `#FFD84D` with a −8° springier entrance.
- **Flash:** inset glow 50 px (70 mega), green 16 % / red 13 %, opacity keyframes `[0,1,0.6,0]` over 0.9 s.

### 1.8 Sound (SC §5.3; SF §2.9, §3.3; `B/../pretty_sound_raw.js` module 722153)

| Cue | Clip / synth | Gain | Measured contour (SA) | When |
|---|---|---|---|---|
| tap | `button_tap.mp3` | 0.30 | 1102 Hz, ~45 ms | almost every control (not UP/DOWN, not CLOSE) |
| open | `open_trade.mp3` | 0.55 | 735 → 1161 Hz glide, ~60 ms audible | position created; Add |
| close | `close_trade.mp3` | 0.55 | 817 → 432 Hz | Reduce only |
| win | `close_win.mp3` | 0.50 | 882 / 1102 / 1297 Hz at 0 / 80 / 160 ms | full close, close-all, trail hit with PnL ≥ 0 (zero counts as a win) |
| loss | `close_loss.mp3` | 0.40 | 424 → 283 Hz, ~300 ms | same with PnL < 0; liquidation |
| profit | `profit_move.mp3` | 0.35 | 1050 then 1297 Hz | only through the combo ladder, pitched by `playbackRate = 2^(s/12)`, s ∈ [0,2,4,7,9,12,14,16,19,21,24] |
| adverse | sine 262 → 196 Hz, 110 ms | 0.07 | — | from the 2nd consecutive adverse step |
| slump | sine 330 → 130 Hz, 280 ms | 0.14 | — | adverse surge |
| surge / mega | triangle C5 E5 G5 C6 (+E6), 45 ms apart, 120 ms each | 0.13 / 0.16 | — | favourable surge |

Engine: Web Audio with `latencyHint: "interactive"`, master gain 1, clips decoded up front, unlock on the first
touchend/click/keydown/pointerup/mousedown with a 1-sample silent buffer, resume on visibility, rebuild a stuck context,
`navigator.audioSession.type = "playback"` (plays through the iPhone ringer switch).

**Music:** three looped tracks (Arcade, Turbo, Neon; `B/2i-b0for4sngo.js:1946–1960`), gain 0.32, 1.2 s fade-in, 0.5 s
crossfade, stops when hidden; an equaliser toggle beside the chart controls with a 4 s "♪ Arcade ›" chip to skip; a 900 Hz
low-pass ("tense") while ROI ≤ −5 % (SF §3.3). Off by default.

### 1.9 Haptics (SC §6)

`navigator.vibrate` patterns: tap 8 · tick 3 (crosshair detents) · open `[12,20,12]` · close 20 · move 6 (each favourable
step) · surge `[25,35,25,35,45]` · mega `[40,30,40,30,40,30,80]` · slump 35 · warn `[80,60,80]` (near liquidation). iPhone
fallback: a hidden `<input type="checkbox" switch>` clicked 1–5 times, 70 ms apart.

### 1.10 Settings, history, statistics, sheets

- **Settings → Feedback:** Sound effects · Haptics · Trade reactions ("emoji callouts…"; gates callouts and flash only); Music.
  Mode switch Demo/Live. Defaults: sound, haptics, reactions on; music off; line view; 1m (SF §2.1, §4).
- **Account sheet** (from the equity pill): avatar/handle or Log in; balance with Today/7D/30D/All P&L and a cumulative P&L
  chart; Funding/Trading tiles; Deposit · Withdraw · Transfer · History; Trading group (Trade history, Leaderboard,
  Referrals, Aura, Grid bot, Settings, Advanced); App group (How it works, Install app); feedback link; Reset demo / Log out
  (SF §7).
- **Trade history ("Statistics"):** Lifetime PnL, Win rate, Trades, Win streak, Best streak, Volume; list with direction,
  ▶ when replayable, duration, ±$ and ROI; trade details with Share PnL (SF §7).
- **Replay:** path recorded at 100 ms, gaps back-filled from 1m candles, play/pause/scrubber, Share (SF §7).
- **Leaderboard:** ROI/PnL × Daily/Weekly/Monthly/All time, podium, profile drill-down (SF §7).
- **Share card:** 1600 × 1000 PNG, PnL / ROI / Both, Download, Share on X with result-tiered text (SF §2.6).
- **Markets sheet:** search; Favourites · All · Hot 🔥 · Crypto · Commodities · Stocks; star, logo, label, max-leverage badge,
  price, 24h change (SF §6).
- **Chart controls:** interval pill (Minutes 1m 3m 5m 15m 30m · Hours & days 1h 2h 4h 12h 1d); picking one switches to
  candles; line/candles toggle; recentre; every control plays tap + haptic. Candles: 300 loaded, refresh at the boundary + 4 s,
  older on approach, pan/pinch/axis-drag/wheel, crosshair with detent haptics, double-tap recentre, new candle slides in,
  0.35/0.2 crossfade between views (SC §2.4, §4).
- **Install sheet** and a "New version available" toast (SF §5, §8).

### 1.11 Colours and type

Dark only: background `#08090C`, up `#72E912`, down `#E6432D`, axis text `#8b90a0`, grid white 6 %, epic `#FFD84D`, star
`#F5B90A` (SF §9). UI type is **Space Grotesk** (`--font-sans`) and **JetBrains Mono** (`--font-mono`)
(`T/bundle-2026-10-07/app.css`); the canvas uses `ui-monospace`. Prices, PnL and the UP/DOWN labels read as monospace
(seen live).

### 1.12 Demo and going live (SF §5)

Demo: $10,000, fills at the chart price, no fees, no slippage, margin settled only at close, positions not persisted, Reset
demo balance. Live: Privy login, then "Enable one-tap trading" (agent key) and "Approve builder code" — two one-time
signatures — then real market orders with a 10 % slippage cap. A fresh visitor defaults to live mode; the tutorial's buttons
choose.

---

## 2. Senryo today, in one view

| Area | Web | Phone |
|---|---|---|
| Terminal | `/app/trade/<symbol>/` → `W/features/terminal/TerminalScreen.tsx` | Trade tab → `P/features/terminal/TerminalScreen.tsx` |
| Chart | Two canvases, Tradash constants (`W/features/terminal/chart/*`) | Skia picture per frame, same constants (`P/features/terminal/chart/*`) |
| Per-tick pass | `pkg/calls/src/quote.ts` `quoteTick` → refs and live text (`W/.../useLiveQuote.ts`) | same pass → shared values (`P/.../useLiveQuote.ts`) |
| Call flow | `pkg/calls/src/use-call-flow.ts` (shared) | same |
| Reactions | `pkg/calls/src/reactions.ts` (shared) + `W/.../ReactionOverlay.tsx` | same engine + `P/.../ReactionOverlay.tsx` |
| Sounds | Live synth of `pkg/tokens/src/sound.ts` (`W/lib/feedback/sound.ts`) | WAVs pre-rendered from the same table (`P/feedback/trade-sound.ts`) |
| Results | `W/components/shell/ResultHost.tsx` → `pkg/calls/src/use-results.ts` | same hook |
| Shell | Floating rail, top line (hidden on the terminal), dock < 768 px, Everything drawer, ⌘K | Dock with the seal as Trade; More; Account |

**Observed live (10 Oct, signed out):** at phone width the terminal shows the BTC chip (no price), the lanes `1m 0:14 · 5m ·
15m · 1h` with a countdown ring, the chart with 千両, a "Line" tag and the green pill `$82,637.49`, the distance "▼ $0.31
(0.000%) below the line", stake chips `$1 $5 $10 $25 ··· Max`, solid UP "pays 1.93× · about 49%" and DOWN "pays 1.91× · about
50%", and the dock. At 1280 px: rail (Home, Trade, Markets, Calls, Everything, "Practice · Test dollars"), the chart stage, and
a right column that is empty except for the stake chips and UP/DOWN at its foot.

---

## 3. Fidelity matrix

Gap words: **Same** (behaviour matches) · **Partial** (part of it, or weaker) · **Different** (another behaviour in its place) ·
**Missing** · **Additive** (Senryo-only; keep) · **Decided** (a deviation recorded earlier; the replan should re-confirm it now
that Tradash is the overarching approach). "Translation" notes where a binary call needs an adapted promise (no leverage, no
liquidation; the window's open print K is the line you lose across; settlement at the window close).

### A. Feed and line motion

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| A1 | Bulk WS, ~5 frames/s (live check 2), REST snapshot, 1.5 s reconnect (SC §1.2) | One SSE `/v1/stream`; Pyth via the gateway; **1 tick/s per market measured on production** (live check 3); reseed from `/v1/prices/recent` on connect (`pkg/live/src/live.ts:109-119`); stale after 5 s (`pkg/live/src/prices.ts:10, 80-84`) | Different | A faster *display* feed: a higher Pyth tier if the key allows it (UNVERIFIED), or a labelled exchange feed for the line only (Owarine used Coinbase per-trade at ≤ 8 Hz, TF "Feed" row) while Pyth prints keep settling. The gateway already allows 8 frames/s. The earlier study's rule stands: label the display source separately from the resolution source (`docs/design/reference-study-2026-10-07-uglycash/tradash.md:58`) |
| A2 | Chart gets every tick; store throttled to 200 ms | Chart and quote pass both subscribe to a per-frame flush (`pkg/live/src/prices.ts:103-128`; `W/features/terminal/chart/LiveChart.tsx:80-89`; `W/features/terminal/useLiveQuote.ts:105-106`) | Same | — |
| A3 | Ease 0.18/frame, τ ≈ 84 ms | Fixed 60 Hz sample clock; τ = max(84 ms, 0.5 × measured tick gap) (`W/features/terminal/chart/constants.ts:13-17`; `chart-engine.ts:161`; `P/features/terminal/chart/state.ts:132-133`) → **τ ≈ 500 ms at 1 tick/s** | Different (Decided, D-272 comment in `P/.../chart/constants.ts:24-28`) | Nothing in the engine: the same formula returns to 84 ms once ticks arrive every ≤ 168 ms. The feel gap is A1 |
| A4 | 600 samples, x = index, flat prefill, ~10 s | Same (`W/.../chart/constants.ts:7`; `engine.ts:40-78`; `chart-engine.ts:103-108`) and frame-rate independent (fix) | Same | — |
| A5 | Y centred on eased price, ±7.5 frozen nice steps | Same (`chart-engine.ts:179`; `engine.ts:23-32`) | Same | — |
| A6 | Catmull-Rom 1/6, 6 px glow at 18 % + 2 px line | Same (`chart-engine.ts:228-242`) | Same | — |
| A7 | Left 32 % fade | Same (`chart-engine.ts:243-253`) | Same | — |
| A8 | Grid/ticks/labels, 11 px **monospace** | Same geometry; web labels in Inter tabular (`W/.../chart/constants.ts:82-84`; `theme.ts:11-27`), phone Menlo/monospace (`P/.../chart/LiveChart.tsx:28-29`); labels also give way to level tags (additive) | Partial (web font) | Use a monospace for canvas text on web |
| A9 | Head dot 3.5 px | Same (`chart-engine.ts:192-195`) | Same | — |
| A10 | Pill 26/34 px, price `700 15px` (14 px with a position), PnL 11 px | 26/34 px, price 13 px, PnL 11 px (`W/.../chart/constants.ts:47-49, 83`; `P/.../chart/LiveChart.tsx:29`) | Partial | Raise to 15/14 px |
| A11 | Pill shows the raw latest tick | Same (`chart-engine.ts:170-171`) | Same | — |
| A12 | Canvas odometer 0.22, directional, pitch 20/16/14 | Same algorithm (`W/.../chart/odometer.ts`), pitch 20/15/15 (`constants.ts:51-52`) | Same | — |
| A13 | Decimals ≥1e5→1, ≥1e3→2, ≥10→3, ≥0.01→4 | ≥1e5→1, ≥100→2, ≥10→3, ≥1→5 (`pkg/core/src/market/price-format.ts:8-13`) | Partial | Decide per asset class (stocks at $100–$1,000 show 2 dp here, 3 in Tradash) |
| A14 | Logo watermark 7 % | 千両 at 7 % (`W/.../chart/draw.ts:139-153`) | Same (brand) | — |
| A15 | Dot field 34 px, half scroll, velocity drift | Same, drift in grid steps (`W/.../chart/dot-grid.ts:55-76`; `P/.../chart/state.ts:143-147`) | Same | — |
| A16 | Reset to a flat line on market change | Same (`chart-engine.ts:124-135`; `P/.../chart/state.ts:107-116`) | Same | — |
| A17 | Splash gates the chart loop | None on web | Missing (low) | Optional |

### B. Live position and live PnL

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| B1 | PnL row on the pill, 2 dp, rolling | Second row = cash-out value − stake, 2 dp (`pkg/calls/src/quote.ts:161-162, 236-237, 256`; `chart-engine.ts:114-122`). With 1 tick/s and $1–$25 stakes it changes once a second, by cents | Partial | A1; magnitude-based decimals on the live PnL (Tradash shows 4 dp under $10 in the card, SF §2.3) so small stakes visibly move |
| B2 | Colour = PnL sign (≥ 0 green) | Colour = "would this band win at this spot" (`quote.ts:255`; `chart-engine.ts:169`; `P/.../chart/draw.ts:180`) | Different | Decide. Tradash's rule is `pnl >= 0`. With the current rule, an Up call just opened above K is green while its pill reads a small minus (cash-out < stake by the spread) |
| B3 | Band = price path closed to the entry line, gradient 0.22 → 0.02 | Flat rectangle over the band's winning price zone at 7 % (`chart-engine.ts:216-227`; `W/.../chart/constants.ts:66`; `P/.../chart/draw.ts:202-207`) | Different | Draw the path-to-entry gradient (entry is `entryE8`); the zone can stay as a faint second layer |
| B4 | Entry, B/E, TP/SL, Liq, Trail tags; edge tags off-screen | Line (K) `[2,3]` ink 0.7, Entry `[4,4]` 0.55, Range/Strike `[8,4]`; edge tags stack (`W/.../chart/constants.ts:78-79`; `quote.ts:263-269`; `draw.ts:172-207`). No break-even; armed exits are not drawn | Partial | B/E = the spot where cash-out equals the stake (invert `quoteClose` at the current τ; Owarine did this, TF "Position overlay"); draw take-profit/stop/trail as levels by inverting their bid thresholds to spot; Line in the loss colour like Liq (TF uses red `[2,3]`) |
| B5 | Live: entry drawn the moment you tap (`setPendingChartEntry`) | A committed call shows nothing until filled (`quote.ts:217-235`); tap → fill measured 1.26 s (one-tap, phone) / 2.2 s (production) (`docs/plan/STATUS.md:75, 129`) | Missing | Draw a pending entry at the quote's spot on `committed`, clear on refuse/fail |
| B6 | Unrealized PnL card (odometer, ± %, Close all) | None; the web right column is empty above the panel (`W/features/terminal/terminal.css:151-162`; seen live) | Missing | Port `OW/features/terminal/ui/PositionsPanel.tsx` `UnrealizedCard` onto `quoteTick` readings |
| B7 | Position row with ROI/PnL odometers, expand rows, Add/Reduce, share | None in the terminal; open calls live on the Calls page with receipts (`W/features/calls/CallsScreen.tsx`) | Missing | Rows from tickets + a per-call quote pass: Direction, ROI, Avg in (¢), Now (¢), Entry spot, Line, Staked, Settles at (TF "Position row") |
| B8 | All positions across markets in one list | Only the call in the selected market's selected lane window (`pkg/calls/src/use-call-window.ts:31-36`); a call in another lane or market is invisible from the terminal | Partial | List every open ticket; tapping one switches market and lane |
| B9 | Phone "View position(s)" pill → Open positions sheet | None (web or phone) | Missing | Port `OW/features/terminal/ui/Chrome.tsx:157-172` |
| B10 | Equity pill = balance + Σ unrealized, odometer | Web: static balance text (`W/features/terminal/TerminalTop.tsx:47-52`; shell `W/components/shell/chips.tsx:38-71`). Phone: balance odometer (`P/features/terminal/TerminalTop.tsx:43-80`), cash only | Partial | Equity = cash + Σ live cash-out values, rolling on both apps |
| B11 | ROI % on rows, card, pill, phone pill | Computed for reactions only (`quote.ts:238`), never shown | Missing | Show ROI next to every PnL |
| B12 | — | "Cash out $X" (what selling returns now) live in the button; rolls on phone (`P/features/terminal/CallPanel.tsx:258`), plain text on web (`W/features/terminal/CallPanel.tsx:185`) | Additive | Keep; roll it on web too (see L1) |

### C. Core loop and controls

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| C1 | UP/DOWN: no tap sound; demo fills synchronously; open sound + haptic; toast "Long BTC opened · 40× · $500.00 margin"; live: loading toast replaced by the result | Tap → press haptic (`pkg/calls/src/use-call-flow.ts:141`) → "Signing…" → "Opening Up…" in the panel (`:96-106, 151`) → fill at the print 1 s later (`pkg/config/src/catalog.ts:35`) → open cue (`:78-80`). No success toast; only failures toast (`:81-87`) | Partial | Toast "Up BTC opened · pays 1.93× · $5.00" replacing a loading toast by id; optimistic entry (B5) |
| C2 | Guards in toasts; demo needs no login | "Sign in to make a call" (passkey); "Agree to the terms first" → Open setup leaves the terminal (`W/features/terminal/TerminalScreen.tsx:88-103`) | Different | See H2: a guest path to the first call on the terminal itself |
| C3 | Morph cross-fade out and in, 0.18 s, y 12 | Web: CSS fade-in only, 180 ms, y 12 (`terminal.css:211-216, 272-277, 314-319`); phone: no transition (`P/features/terminal/CallPanel.tsx:233-296`) | Partial | Exit + enter (`mode="wait"`) on both |
| C4 | TRAIL button in the morph: disabled with "Need +0.1% to trail", arms in one tap, "Trailing" solid, toasts armed/hit/off | No TRAIL button; exits (take profit, stop, trail in cents a share; `pkg/calls/src/constants.ts:31-45`) are set in a modal/sheet behind a crosshair icon (`W/features/terminal/CallPanel.tsx:199-210`; `ExitModal.tsx`; `P/features/terminal/CallPanel.tsx:265-281`; `ExitSheet.tsx`) and run with the app closed (S8.4) | Different | A one-tap TRAIL in the morph that arms the on-chain trail at the default distance, with "Need +x% past break-even" until eligible; the full exit sheet stays behind it |
| C5 | CLOSE: one tap, no confirm, whole position; **win if PnL ≥ 0 else loss**; toast "Closed BTC · Realized +$x", confetti if > 0 | "Cash out" one tap (web key C) → "Cashing out…" → neutral `close` cue at the fill (`TerminalScreen.tsx:81-86`); a later toast "Cashed out $X / +$Y on BTC 1m" with confetti when the ticket refresh shows `closed` (`pkg/calls/src/use-results.ts:72-76`); no win/loss cue for a cash-out | Partial | Play win/loss by realized sign at the fill; one toast id from "Cashing out…" to "Cashed out BTC · Realized +$Y"; confetti with it |
| C6 | Close all (N), no confirm, one sound for the sum | None | Missing | With B6/B7 |
| C7 | Add (sheet, 25/50/75/Max, preview, plays open) | Holding hides the call buttons (`W/features/terminal/CallPanel.tsx:117-165, 174`); whether the contract accepts a second ticket in the same window is UNVERIFIED | Missing | Add = another open on the held band, if the book allows it |
| C8 | Reduce (25/50/75, plays close) | Cash out part 25/50/100 % (web ⋯ → `CashOutModal.tsx`; phone long-press → `CashOutSheet.tsx`), neutral close cue | Same (adapted) | — |
| C9 | TP/SL sheet (live only) | Exit sheet: take profit, stop, trail, "never below"; runs with the app closed | Additive (stronger) | Keep; surface as levels (B4) |
| C10 | Liquidation toast and loss sound | Settlement: win cue + confetti + "Won $X on BTC 1m"; loss cue + "closed against you"; refunds (`use-results.ts:77-88`) | Same (translated) | — |
| C11 | Size = margin, default 5 % of available, re-derived until touched; Min/25/50/Max; slider | Stake chips $1/$5/$10/$25/any/Max, last remembered, default $5 (`W/features/terminal/constants.ts:4, 7`; `TerminalScreen.tsx:44-58`) | Different | A size control in the settings sheet (C14) with % of balance; chips can stay inside it |
| C12 | Leverage + "liquidates on a 2.50% move against you" | Odds per button "pays 1.93× · about 49%" (`quote.ts:165-171`); distance to K under the chart (`quote.ts:212-214`) | Partial (translated) | Risk in one sentence as Owarine did: "Up loses it all if BTC closes below $X at 11:15" (TF "Leverage") |
| C13 | Fees row (demo Free, live breakdown) | Pool load surcharge folded into the odds (`quote.ts:96-113`); no fee line | Partial | Show the surcharge/spread as the "Fees" row |
| C14 | Floating glass settings stack on the chart → settings sheet with ? tooltips and summary | Mode segmented control + stake chips inline above the buttons (web right column; phone under the chart) | Different | Stack on the chart's left edge: Stake · Pays · Fees · Exit; tap → sheet (TF "Settings stack", `OW/features/terminal/ui/sheets/SettingsSheet.tsx`) |
| C15 | No keyboard trading, no ⌘K | ↑/↓ call, C cash out (`TerminalScreen.tsx:107-124`); 1–n places, ⌘K, `/`, `?` (`W/components/shell/TopLine.tsx:46-64`; `Rail.tsx:28-46`) | Additive | Keep |
| C16 | — | Lanes 1m/5m/15m/1h with countdown ring; lockout "Calls closed · next opens in"; crowd split; basket members; Range/Moonshot modes | Additive | Keep (windows end; Tradash has no equivalent) |

### D. Reactions

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| D1 | Fed ≤ 5 Hz store commits | Fed every quote tick = 1 Hz (`W/features/terminal/useLiveQuote.ts:102-103`; `useReactions.ts:27-41`; same on phone) | Different | A1 |
| D2 | Step/combo thresholds | Identical constants (`pkg/calls/src/reactions.ts:101-111, 198-219`); at 1 Hz the noise baseline is per second, so steps come slower | Partial | A1 |
| D3 | Surge/mega/slump: 1.5 s window, ≥ 4 points, ≥ 900 ms, 3 s cooldown, ≥ 12 samples | Same constants (`reactions.ts:113-121, 221-234, 270-293`). **At 1 tick/s the 1.5 s window holds 2 points, so a surge needs three consecutive tick gaps summing to ≤ 1.5 s: effectively it never fires.** The surge/mega/slump sounds, their haptics, the edge flash and their callouts are unreachable today | Broken by cadence | Faster feed (A1), or scale the window and point count to the measured tick interval (a design choice to record) |
| D4 | Callout pools, milestones, new high, comeback, near-liq; gating | Identical; "Near liquidation" → "Near the line" (`reactions.ts:32-99, 236-311`) | Same | — |
| D5 | Callout spring 520/22 (14 epic), epic −8° rotate | Web: CSS cubic-bezier approximation, no rotate (`W/features/terminal/reactions.css:74-113`); phone: Reanimated ZoomIn spring (`P/features/terminal/ReactionOverlay.tsx:115-117`) | Partial | Add the epic rotate; match spring |
| D6 | Inset flash 50/70 px, 0.9 s | Same timing and size on both (`reactions.css:31-58`; `P/.../ReactionOverlay.tsx:27-32, 96-103`) | Same (but unreachable, D3) | — |
| D7 | "Trade reactions" toggle gates callouts + flash | Web: no toggle. Phone: "Live position reactions" switch is stored (`P/app/account/preferences.tsx:29, 75-82`; key `P/lib/storage.ts:19`) but **read nowhere** — reactions always run | Missing (web) / Broken (phone) | Wire the setting into both `useReactions`; add it to web Settings |
| D8 | Tense music at ROI ≤ −5 % | No music | Missing | With E6 |

### E. Sound

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| E1 | Web Audio, interactive latency, gesture unlock, `audioSession = "playback"` | Web: the same engine, synthesised voices instead of clips (`W/lib/feedback/sound.ts:20-115`). Phone: expo-audio WAVs rendered from the same table, `playsInSilentMode: false` (`P/feedback/sound.ts:38-42`), two players per cue (`P/feedback/trade-sound.ts:39-58`) | Same (web) / Decided (phone follows the ringer; `docs/design/reference-study-2026-10-07-uglycash/tradash.md:66`) | Re-confirm the ringer rule |
| E2 | Cue contours (SA) | tap, open, close, win, profit match the measured pitches (`pkg/tokens/src/sound.ts:36-60`). **Loss**: Senryo's loud voice is 848 → 566 Hz with 424 → 283 Hz underneath; the measured clip's fundamental is 424 → 283 Hz (SA line 4). Open/close/loss run 0.22/0.24/0.42 s vs ~0.15/0.17/0.30 s clips | Partial (UNVERIFIED by ear) | Re-voice loss an octave down; trim lengths; listen side by side |
| E3 | Gains as listed, master 1 | Same mix numbers but × voice gain (0.75–0.9) × master 0.7 (`pkg/tokens/src/sound.ts:63-75`) → clip-type cues ≈ 0.5–0.63×, synth cues ≈ 0.56–0.63× of Tradash's level | Partial | Re-level to the reference |
| E4 | Pentatonic ladder via `playbackRate` (pitch and length change together) | Same ladder (`pkg/tokens/src/sound.ts:78`); pitch only, length constant (web `W/lib/feedback/sound.ts:149-154`; phone 11 pre-rendered steps `P/feedback/trade-sound.ts:25-37`, `apps/mobile/scripts/gen-trade-sounds.mjs:64-70`) | Same (minor) | Optional: shorten higher steps |
| E5 | Sound map: tap on controls; none on UP/DOWN/CLOSE; open; win/loss on close; ladder; adverse; surge/slump | Web: tap on shell/lanes/chips (`W/lib/feedback/index.ts:98-100`); phone: no tap sounds by rule ("haptics own those", `P/feedback/sound.ts:6-11`); open ✓; **cash-out plays close, not win/loss** (C5); settlement win/loss ✓ (`W/components/shell/ResultHost.tsx:13-18`); surge/slump unreachable (D3) | Partial | C5; D3; decide tap sounds on the phone |
| E6 | Music: 3 loops, toggle + track chip, tense filter | None on either app | Missing | Port `OW/lib/sound/music.ts` (loops sequenced in code, licence-clean) and the toggle in the chart footer |

### F. Haptics

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| F1 | tap 8, tick 3, open `[12,20,12]`, close 20, move 6, surge/mega patterns, slump 35, warn `[80,60,80]`; iOS switch fallback | Web table (`W/lib/feedback/constants.ts:9-35`) and iOS switch fallback (`W/lib/feedback/haptics.ts`). Mapping differs: cash-out fires `filled` `[12,20,12]` (Tradash close = 20); surge and mega both fire `snap` 12 ms; slump fires `warn` `[80,60,80]` (`W/features/terminal/useReactions.ts:33-35`) | Partial | Add close/surge/mega/slump words with Tradash's patterns |
| F2 | — | Phone: semantic Taptic / Android constants (`P/feedback/haptics.ts:15-51`) | Same (platform) | — |
| F3 | Crosshair detent ticks in candles | No candles | Missing | With G2 |

### G. Chart controls and candles

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| G1 | Footer: interval pill + menu, line/candles toggle, music, recentre | None. Senryo's lanes pick the *window length*, not a chart interval | Missing | Port `OW/features/terminal/ui/ChartControls.tsx` |
| G2 | Candles (10 intervals, 300 loaded, pan/pinch/crosshair, slide-in, crossfade) | None in either terminal; the API already serves 1-minute candles (`services/api/src/routes/prices.ts:10, 34-41`) | Missing | Port `OW/features/terminal/chart/{candles,candle-view}.ts` on web; Skia candles on the phone |

### H. Onboarding, practice and going live

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| H1 | Tutorial on first visit: Watch the market · Tap UP or DOWN · Watch your PnL move · Trail to lock profit · Close to bank it; Try Demo / Try Live; reopen from How it works (SF §5; copy at SF:536-543) | Web: none inside the app (landing page section only, `W/app/page.tsx:96-136`). Phone: a 6-scene welcome story before sign-in (`P/features/onboarding/Story.tsx`) and "Try your first call" over the live terminal during setup (`P/app/setup/first-call.tsx:10-24`) | Missing (web) / Partial (phone) | The same five steps over the terminal on both, last step "Try Practice / Go Real" (`OW/features/terminal/ui/sheets/Tutorial.tsx`, `tour-copy.ts`) |
| H2 | Demo: $10,000, no login, instant | Practice is real testnet calls with test dollars after passkey sign-in, terms and a grant (`docs/plan/STATUS.md:68-70`); mode capsule (`W/components/shell/chips.tsx:22-35`) | Different | A first tap that works before sign-in (e.g. a guest Practice seat or a lazily created passkey at the tap) so step 2 of the tutorial is one tap |
| H3 | Two one-time signatures for one-tap | Passkey + one-tap session grant with caps; "One-tap · 12 min · $76 left" (`pkg/calls/src/one-tap.ts`; `W/features/terminal/OneTapLine.tsx`) | Same (translated) | — |
| H4 | Install sheet, "New version available" | Phone is native; web has no manifest or update toast (`apps/web/public/`) | Missing (low) | Optional |

### I. Secondary surfaces

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| I1 | Markets sheet: search, Favourites · All · Hot · categories, star, 24h % | Web: right drawer `MarketList` with search, kind filter, countdown/session, live price (`W/features/markets/MarketList.tsx:1-7`); phone sheet with mark, name, price (`P/features/terminal/MarketsSheet.tsx:1-3`) | Partial | Favourites, Hot, 24h change |
| I2 | Account sheet from the equity pill (balance, range P&L + chart, money actions, history, leaderboard, settings, how it works) | Split across Home, Wallet drawer, Settings drawer, Everything, phone More/Account | Different (multi-place product) | An account sheet reachable from the terminal's equity pill |
| I3 | Settings → Feedback: Sound effects · Haptics · Trade reactions; Music | Web: Sounds, Vibration (`W/components/shell/drawers/SettingsDrawer.tsx:96-109`); phone: Sounds, Haptics, Live position reactions (unwired), Choose sounds | Partial | D7, E6 |
| I4 | Stats: Lifetime PnL, Win rate, Trades, Win streak, Best streak, Volume | Calls: lifetime P/L, calls, won, lost, best streak (`W/features/calls/CallsScreen.tsx:50-61`), filters, receipts, proof (additive) | Partial | Win rate, current streak, volume |
| I5 | Replay | None | Missing | `OW/features/terminal/replay.ts`, `ui/sheets/ReplaySheet.tsx` |
| I6 | Leaderboard sheet | None (S8.1–S8.3 social not built, `docs/plan/STATUS.md` "Next") | Missing | Planned |
| I7 | Share card 1600×1000, PnL/ROI/Both, X text tiers, from a live position too | 4:5 card for finished calls (`W/features/calls/share-card.ts:1-12`), system share or download (`ShareCallButton.tsx:51-62`) | Partial | Share from a live call; X intent with tiers; value toggle |
| I8 | Toasts: max 3, loading → result by id, confetti in the toast | Sonner top centre (`W/components/shell/ToasterHost.tsx:31`), **1 visible** (`W/components/ui/sonner.tsx:17`); no loading → result for calls; full-screen confetti with Tradash's numbers (`W/lib/constants/confetti.ts`) | Partial | 3 visible; id replacement for open/close |

### J. Layout and shell

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| J1 | One screen, everything else in sheets | A multi-place app (rail, dock, Everything) around the terminal | Different (product scope) | Keep the terminal itself one-screen: everything a trader needs as sheets over it |
| J2 | Desktop `220 / 1fr / 320`, right rail = equity + PnL + positions + buttons | Rail 88/248 + stage `1fr / 22rem`; the right column holds only the panel at its foot (`terminal.css:9-14, 151-162`; `W/styles/shell-parts.css:233-258`) | Partial | Fill the column top-down like Tradash's rail (B6, B7, B10) |
| J3 | Phone: chip ↔ equity, full-bleed chart, footer controls, view-position pill, UP/DOWN | Chip + lanes; chart; distance, crowd, basket lines; mode + stake chips; one-tap line; UP/DOWN with odds; dock below (`P/features/terminal/TerminalScreen.tsx:120-158`; seen live on web) | Partial | Move stake/mode into the stack (C14); add footer controls (G1) and the pill (B9) |
| J4 | Bottom sheets everywhere | Web: right drawers + centred modals, never bottom sheets (D-190, `docs/plan/pivot-2026-10-08.md:260`); phone: bottom sheets | Decided (web) | Re-confirm D-190 for the terminal |
| J5 | Asset chip: logo + **live price odometer** + "BTC · Bitcoin" | Web: mark, symbol, name, chevron — no price, though its docstring says the price rolls (`W/features/terminal/TerminalTop.tsx:3, 33-46`); phone: mark, symbol, chevron (`P/features/terminal/TerminalTop.tsx:56-68`) | Partial | Rolling price in the chip |

### K. Colours and type

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| K1 | Dark only, `#08090C`, up `#72E912`, down `#E6432D` | Living Lacquer/UGLYCASH tokens; dark by default on web (`W/components/shell/theme-provider.tsx:11`); chart up `#25CF68` / down `#FF5A48` dark, `#087F3C` / `#C83225` light (`pkg/tokens/src/tokens.css:277-278, 343-344`) | Decided (identity; `tradash.md:48` "Superseded by user") | Re-confirm; Owarine also kept its own colours (TF "Approved deviations") |
| K2 | UP/DOWN tinted soft plates with coloured mono caps | Solid green/red plates with dark text (`terminal.css:234-239`; seen live) | Different | Tinted plates if the replan follows Tradash's look |
| K3 | Space Grotesk + JetBrains Mono; canvas `ui-monospace` | Inter (+ Noto Sans JP for the mark); canvas Inter on web, Menlo on phone | Different | Monospace for prices/PnL/buttons at least |

### L. Rolling numbers in the DOM

| # | Tradash | Senryo today | Gap | What it would take |
|---|---|---|---|---|
| L1 | Every changing number rolls (260 ms per digit) | Web: cash-out, odds and balance are plain text painted per tick (`W/components/kit/live-text.tsx`); phone: cash-out and balance roll (`P/components/kit/LiveOdometer.tsx`) | Partial (web) | A DOM odometer on web for cash-out, equity, PnL, ROI and the chip price |

---

## 4. The top 15 gaps, ranked by how much they make "the Tradash feel"

1. **The line and the numbers move once a second (A1, A3, B1).** Tradash's feel is a head that never stops gliding and digits
   that keep rolling; its feed sends a frame every ~200 ms and the line follows within ~84 ms. Senryo's production stream sends
   one tick per second, so the engine (correctly) stretches its glide to ~500 ms and the pill, the PnL and the odds change once
   a second. *Take:* a faster display feed with the source labelled, Pyth prints kept for settlement; the engine already adapts.
2. **No PnL surfaces around the chart (B6, B7, B10, B11, J2).** Tradash's step 3 is "watch your PnL move": an Unrealized card,
   a position row with ROI over PnL, a live equity pill. Senryo has a cents-level second row on the pill and a cash-out value
   in the button, nothing else; the desktop right column is empty. *Take:* Unrealized card, position rows, ROI, equity =
   cash + live cash-out values, all rolling (port `OW/.../PositionsPanel.tsx`).
3. **The first tap is not one tap (C2, H2, B5, C1).** Tradash demo opens a position the instant you tap, with no account.
   Senryo asks for a passkey, terms and a grant before the first call, then shows "Signing…" / "Opening Up…" for 1.3–2.2 s with
   nothing on the chart and no "opened" toast. *Take:* a guest path to the first Practice call on the terminal, a pending entry
   drawn at the tap, and a loading → "Up BTC opened" toast.
4. **CLOSE does not sound or read like banking it (C5, E5, I8).** Tradash plays the win or loss sound by the realized sign at
   the moment of close, with "Closed BTC · Realized +$x" and confetti. Senryo plays a neutral close cue and the result toast comes
   later from a ticket refresh. *Take:* win/loss at the fill, one toast id from "Cashing out…" to "Realized", confetti with it.
5. **Half the reaction vocabulary can never fire (D3, D6, F1).** At one tick a second the 1.5 s surge window holds two points,
   so surge, mega, slump, their arpeggios, haptics, edge flash and callouts are unreachable. *Take:* faster feed, or scale the
   surge window to the measured tick interval.
6. **No TRAIL in the button morph (C4, C3).** Tradash's step 4 is one tap on TRAIL once you're in profit ("Need +0.1% to
   trail" until then). Senryo's exits are deeper (on chain, app closed) but sit behind a crosshair icon and a form. *Take:* a
   one-tap TRAIL that arms the on-chain trail at the default distance, with the eligibility caption; the exit sheet stays behind.
7. **Colour follows the band, not the PnL (B2).** Tradash turns everything red the moment PnL < 0, which is what makes a
   position feel alive. Senryo stays green while the call would win at this spot even when cashing out would lose money.
   *Take:* decide; Tradash's rule is `pnl >= 0`.
8. **No PnL band and no break-even (B3, B4).** Tradash fills the area between the path and the entry with a fading gradient
   and tags B/E, Trail, TP/SL. Senryo draws a flat 7 % zone and no B/E or exit levels. *Take:* path-to-entry gradient; B/E as
   the spot where cash-out equals the stake; armed exits as levels.
9. **No tutorial on the terminal (H1).** Tradash teaches the five-step loop over the chart on first visit. Web has none;
   the phone has a story and a first-call coach that don't teach trail or close. *Take:* the five steps on both apps.
10. **No music, no tense filter, no reactions toggle that works (E6, D8, D7, I3).** *Take:* port Owarine's code-sequenced
    loops, the footer toggle with the track chip, the tense low-pass; wire the reactions setting on both apps.
11. **Static numbers on the web (L1, J5, B12).** Tradash rolls every changing number. Senryo's web cash-out, balance and odds
    are plain text, and neither app shows the live price in the asset chip. *Take:* a DOM odometer and the rolling chip price.
12. **The order controls aren't on the chart (C14, C11, C12, C13, J3).** Tradash keeps Size · Leverage · Fees · Trailing in a
    small glass stack on the chart's edge with a settings sheet and risk in words. Senryo puts mode and stake chips above the
    buttons. *Take:* Stake · Pays · Fees · Exit stack → sheet, with "Up loses it all if BTC closes below $X at 11:15".
13. **Positions beyond the current window are invisible; no View-position pill, Close all or Add (B8, B9, C6, C7).**
    *Take:* list every open call, the phone pill, Close all; Add if the book allows a second ticket.
14. **No chart controls or candles (G1, G2, F3).** *Take:* interval/type/music footer and candles on the existing 1-minute
    candle endpoint (port Owarine's candle view on web; Skia candles on the phone).
15. **Thin after-trade surfaces (I4, I5, I6, I7).** Tradash's history has win rate, streaks and volume, a replay of the path,
    a leaderboard and a share card from a live position with X copy. Senryo has the record, receipts and proof (stronger on
    proof) but no replay, no leaderboard yet and share for finished calls only.

Smaller deltas that still show: sound levels 0.5–0.63× of the reference and the loss cue an octave high (E2, E3); pill digits
13 px vs 15 px (A10); canvas text in Inter on the web (A8); one visible toast (I8); epic callout without its tilt (D5); price
decimals for $100–$1,000 assets (A13).

## 5. Notes for the replan

- **Recorded deviations to re-confirm now** (each was decided before Tradash became the overarching approach): adaptive easing
  for a 1 s feed (D-272 note), web overlays as right drawers not bottom sheets (D-190), Senryo colours and type (earlier study),
  the phone's sounds following the ringer switch, no tap sounds on the phone, band-side colour rule.
- **Port sources already re-implemented once for a binary product** (Owarine, Canton-specific trading code excluded):
  `OW/features/terminal/ui/{PositionsPanel,TradeButtons,Chrome,ChartControls}.tsx`,
  `OW/features/terminal/ui/sheets/{SettingsSheet,Tutorial,ReplaySheet,LeaderboardSheet,MarketsSheet,AccountSheet}.tsx`,
  `OW/features/terminal/{replay,position-value,position-return}.ts`, `OW/features/terminal/chart/{candles,candle-view}.ts`,
  `OW/lib/sound/music.ts` (~3,400 lines in the UI files and sheets). They are web DOM; the phone needs its own Skia/RN versions.
- **Found in passing:** the phone's "Live position reactions" switch is never read (D7); `P/feedback/movement.ts`
  (`MovementBaseline`) is not imported anywhere; the web `TerminalTop` docstring promises a rolling price the chip doesn't render.
- **Provenance:** Tradash has no licence. Re-implement behaviour and numbers only; never ship its code, images or MP3s
  (`T/bundle-2026-10-07/README.txt`).
