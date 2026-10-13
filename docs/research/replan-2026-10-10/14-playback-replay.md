# 14 · Playback: trade and portfolio replays (Fomo reference, 13 Oct 2026)

This is read-only research. The only file written is this one. The owner sent a 17 s clip of Fomo's "playback"
(`~/Downloads/ekB2UthMBUbj7h5v.mp4`, 1080×1350). The questions were: what exactly is in it, which of the owner's projects
already did something like it, and what Senryo's own version should be, for one trade and for a whole portfolio.

Scratch work is in `/private/tmp/claude-501/-Users-abu-dev-hackathon-metropolis/0caee452-ff83-4da7-a8cc-8bd1efca7f69/scratchpad/fomo-replay/`:
- `frames/`: 68 frames at 4 fps;
- `full/`: 17 full-size frames at 1 fps;
- `sheets/`: contact sheets 01–12, six frames each at 0.25 s steps (sheet n starts at (n−1)·1.5 s);
- `zoom/`: frame-by-frame crops of the buy, the colour flip, the note and the sell;
- `regiondiff.txt`: how much each screen region changes on each frame;
- `scores.txt`: ffmpeg's scene scores.

Timestamps below are seconds into the clip; at 24 fps, frame n is at n/24 s.

**What I couldn't see or check:**
1. **This is not a screen recording of the app.** It is Fomo's exported share video as posted on X. The container says
   `handler_name=Twitter-vork muxer`, x264 CRF 23 and `creation_time=2026-10-12T18:41:02Z`. So:
   - Fomo's in-app player isn't visible: no play/pause, scrubber, speed, entry point or share flow;
   - the 24 fps and ~930 kbps are X's numbers, not necessarily Fomo's.
2. **No audio track.** ffprobe lists one stream, h264, so loudness can't be measured. X normally keeps a posted video's
   audio, so Fomo's export is *probably* silent. That is unverified.
3. **The reference study has no Fomo playback screen.** `docs/design/reference-study-2026-09-30/03-fomo.md` and its
   evidence don't capture this feature. The nearest is the feed's "Thesis" posts (F15).
4. **Fomo's typeface isn't identified.** It looks like a geometric grotesk.
5. **The scene-change pass found nothing.** At `select='gt(scene,0.08)'` it returned 0 frames; the highest score is 0.034
   (frame 317, 13.2 s). It is one continuous animated shot with no cuts.
6. **This ffmpeg build has no `drawtext`,** so the contact sheets carry no burnt-in times; times come from frame indexes.
7. **Library facts come from the npm registry** (`npm view`, 13 Oct) and READMEs on npm. Context7 wasn't used, and the
   browser-support notes are from memory and marked *(verify)*.

---

## 1. The Fomo clip, exactly

### 1.1 File

| Property | Value |
|---|---|
| Size and length | 1080 × 1350 (4:5 portrait), 17.083 s, 24 fps, 408 frames, H.264 High@4.0 (x264 by X), ~930 kbps, 1.99 MB |
| Audio | none (no stream) |
| Shape of the shot | One continuous animation: 15.0 s of motion, then a ~2.1 s still hold to the end (`regiondiff.txt`: frames 361–408 change < 0.04) |
| What it shows | One coin ("No Crying In The", a memecoin), one buy ($49) and one sell ($374), realised +$325.45 (▲663.51%) |

### 1.2 Layout at 1080 px wide (measured by pixel sampling of `full/t_17.png`, ±4 px)

| Element | Geometry | Notes |
|---|---|---|
| Ground | full frame, `#4859F3` (Fomo blue) | a 12 px blue margin around the card; the brand band at the foot |
| Card | x 12–1068, y 12–1166, radius ≈ 60, fill `#04030F` | near-black |
| Avatar | circle ≈ 144 px at (48, 48) | the trader's PFP |
| Name | "Deestar", x 228, cap height ≈ 40 (≈ 50 px type), white | |
| Outcome badge | "Profit", x 228–345, y 135–190, text `#12E150` on `#0C2F1F`, radius ≈ 8 | shows the **final** outcome from frame 0, even while the PnL is red |
| Date | "Oct 12, 2026", right-aligned to x 1018, y ≈ 82, grey ≈ 34 px | the trade's date |
| Fomo glyph | ≈ 54 × 32 at (958, 140), grey | |
| Chart | y ≈ 220–660 | subtle dot-matrix grid; x-axis labels at y ≈ 632, 20-minute ticks ≈ 323 px apart (≈ 16 px a minute) |
| Line | ≈ 8 px stroke, smooth spline, with a faint same-tone gradient fill below it | the head (playhead) is pinned at x ≈ 595 (≈ 55 %) |
| Current-price rule | dashed, x 36–810, at the head's price, in the tone colour | |
| Price pill | x ≈ 848–1026, h ≈ 50, radius ≈ 10, tone fill (`#13DD4E` / `#EC4222`), white bold ≈ 32 px | the value is market cap ($15.0K MC…) |
| Y labels | two or three, x ≈ 880–985, grey | cross-fade when the range rescales |
| Position panel | x 36–1044, y 720–1143, fill `#100F18`, 2 px border `#1F1E27`, radius ≈ 40 | |
| Coin row | 60 px coin icon and the name (≈ 46 px) with a dotted underline | the feed's linked-asset style (F15) |
| PnL | "+$325.45", ≈ 84 px bold, tone colour; "( ▲ 663.51% )" ≈ 46 px, white, grey parentheses, tone triangle | |
| Stats row | y 975–1143, three columns split by 2 px `#1F1E27` rules | Invested / Avg. entry / Avg. exit; labels grey ≈ 34 px, values white ≈ 40 px |
| Brand band | y 1166–1350 on blue | "fomo" wordmark `#E7EBFB` (≈ 265 × 95 at x 50); right-aligned "10% off fees with code" `#A1A9F6` ≈ 38 px over **"Deestar"** (the referral code is the handle) in white bold ≈ 46 px |

### 1.3 Second by second

Prices are the pill (market cap). PnL is the panel's figure. Sources: `sheets/sh_01–12`, `zoom/*`, `regiondiff.txt`.

| t (s) | Pill | PnL | What happens |
|---|---|---|---|
| 0.00 | $18.8K red | $0 (▲ --) green | Starts mid-chart with no title card or fade. The first prices draw as a near-vertical red stroke at 6:00 PM (tiny auto-range). Invested $0. Avg. entry $15.8K and Avg. exit $120.9K already show their **final** values. |
| 0.0–2.1 | 18.8K → 15.6K | $0 | Pre-roll: about 14 minutes of market before the buy. The line draws while the x-axis pans left. Y labels cross-fade as the range settles. |
| **2.125** | $15.6K | −$0.06 (▼5.14%) | **Buy.** A tooltip "BUY / + $49.0 ($15.0K MC)" fades in over 2 frames (≈ 80 ms) at the entry point. Invested counts up $0 → $1 → $28 → $49 over frames 51–56 (≈ 200 ms) — the only number that animates. The PnL turns red. |
| 2.25–3.4 | 14.9K–14.3K | −$2.97 … −$4.91 (▼10.00% at 2.75) | The tooltip stays and the chart keeps scrolling at full speed (no slow motion). |
| ≈ 3.5 | $14.4K | −$4.45 | The tooltip fades out over about 3 frames, leaving a green **"B"** disc (≈ 54 px, white letter) on the line. |
| 3.75–4.4 | 15.2K–14.4K | −$2.22 … −$4.19 | |
| **4.50** | $20.0K **green** | +$7.41 (▲15.10%) | **Sign flip.** The line, its fill, the dashed rule, the pill and the PnL all turn green in **one frame**, with no cross-fade (frames 108 → 109). |
| 4.75–7.25 | 22.4K … 19.0K | +$20.44 (▲41.68%) … +$9.74 | Chop. The y-axis eases. |
| ≈ 7.6 | $21.6K | +$15.63 | The B disc scrolls off the left edge. |
| **8.0–8.25** | $48.6K → $52.6K | +$86.76 → +$112.67 (▲229.71%) | First leg up. The y-range jumps; old and new labels cross-fade (ghosted "$40.0K/$20.0K"). |
| 8.5–11.5 | 39K–54K | +$81 … +$119 | Chop between +166 % and +242 %. |
| **11.67** | $46.3K | ≈ +$88 | **Note.** The author's avatar disc (≈ 64 px) appears above the line at the note's time, with a caption box below: "Casino + Inu + Elon / don't paper hand a good runner". It fades in over about 4 frames (≈ 170 ms) with no scale, scrolls with the chart, and is still on screen at the end. It is almost certainly the trader's Fomo "Thesis" post on this coin (F15). |
| 12.0–13.0 | 38K–41K | +$70 … +$76 | |
| **13.25** | $57.3K | +$128.77 (▲262.53%) | Second leg up (the highest scene score, 0.034). |
| 13.5–14.5 | 58K–63K | +$122 … +$133 | |
| 14.58–14.67 | $68K → $96K | | Vertical candle. The y-axis rescales to $50K / $100K. |
| **14.71** | $100.4K | +$317.75 (▲647.80%) | **Sell.** A tooltip "SELL / − $374 ($125.3K MC)" fades in. A red **"S"** disc drops about 20 px into place with a fade (≈ 3 frames, ≈ 125 ms) and sits just above the line's tip. |
| 14.75–15.0 | → $133.1K | → **+$325.45 (▲663.51%)** | The line runs on for about 0.3 s. The PnL lands on the realised figure ($374 − $49 = $325.45; 325.45 / 49 = 6.635). |
| 15.0–17.08 | $133.1K | +$325.45 | **Still hold of about 2.1 s.** The SELL tooltip, the S disc and the note stay. There is no logo sting and the brand band never moves. |

### 1.4 Motion rules

- **Camera:** a scrolling window with the head pinned at about 55 % of the width. History is to the left (≈ 35 minutes
  visible) and the empty future to the right, crossed only by the dashed price rule.
- **Time is linear,** at about **6.5 minutes of market per second**:
  - the playhead reads 6:00 PM at 0 s, about 6:13 PM at 2 s, about 6:33 PM at 5 s and about 7:36 PM at 15 s;
  - the ≈ 83-minute hold plays in ≈ 12.6 s (2.1 → 14.7 s), about 395×;
  - the scroll speed is ≈ 105 px/s.
  - *(One sample can't show whether the speed adapts so that any hold fits ≈ 12–13 s. Senryo's R5.19 uses the same
    ≤ 12 s cap.)*
- **The line tip moves every frame,** interpolated along a smooth curve. The PnL and pill text **snap** to each new data
  point: 126 changes in 12.9 s ≈ 9.8 Hz ≈ one step per ~40 s of market. The numbers never roll, except Invested's
  200 ms count-up.
- **Tone is a single state:** green when the position's PnL is ≥ 0, red otherwise, and the whole chart follows it.
  Before the buy the line is red. *(The rule there is unknown; perhaps the change since the clip's first price.)*
- **Y auto-range:**
  - the range eases (fast to grow, slow to shrink, as in Tradash's driven mode,
    `canton-season3/context/13-revamp/tradash/SPEC-chart.md:194-197`);
  - labels cross-fade;
  - x labels fade in at the right and out at the left.
- **Moments:** fade-in tooltips for each fill. The buy's tooltip collapses into a lettered disc after ~1.4 s; the
  sell's stays, because the clip ends. The note appears at its post time.
- **Ending:** the clip freezes on the final frame for about 2 s, and that last frame doubles as the poster. The
  footer's referral code is the handle, so every share is an ad with a code in it.

### 1.5 What can't be told from the frames

- the in-app controls;
- whether there is music or sound;
- whether the speed adapts;
- why Avg. entry ($15.8K) differs from the BUY tooltip ($15.0K MC), and Avg. exit ($120.9K) from the SELL ($125.3K MC):
  fees, slippage or several fills, all unverified;
- whether the export is rendered on the device or on a server;
- whether there's a per-portfolio variant (the owner says Fomo's is per coin).

---

## 2. Prior art in the owner's projects

**Answer to the half-memory: yes, three times, and all from Tradash's replay.** Owarine built it first (7 Oct, web
only). Mitoshi ported it the next day (8 Oct, web only). Senryo's R5.19 shipped it yesterday (13 Oct), the first
version on a phone. None of them exports a video, adds sound, or replays a portfolio. Portfolio curves exist only as
static charts: Senryo v1's phone equity chart (deleted at the pivot), the Masayume/Agari/Stocklana equity curve and
Trader Edge, Mitoshi's /portfolio/edge, and Tradash's cumulative P&L.

| Where | path:line | What it does | How far it got |
|---|---|---|---|
| **Tradash** (the source) | `canton-season3/context/13-revamp/tradash/SPEC-flow.md:501, 625, 632-634`; `SPEC-chart.md:194-197, 506-509` | Records each episode every 100 ms (`tradash.replays.v1`, ≤ 150 episodes, ≤ 1.5 MB); back-fills hidden-tab gaps from 1 m klines; replays only with ≥ 30 samples, ≥ 60 % coverage and no hole in the middle 80 %. The replay sheet shows "Unrealized" PnL, play/pause/scrub, duration, "{N}% recorded", "Closed …" and Share. **It drives the same chart engine in driven mode:** `setDriven(true)`, `seed(samples)`, and a `fitScale` auto-range that grows at 0.12 a frame and shrinks at 0.02. | Live product (reference) |
| **Owarine** | `owarine/web/src/features/terminal/replay.ts:9-14` (recorder), `:122-152` (1 m candle back-fill); `ui/sheets/ReplaySheet.tsx:12-13` (≤ 12 s), `:91-92`, `:142` (240 px canvas), `:156` (scrub), `:160` ("% recorded"), `:163-164` (**Share**); opened from `AccountSheet.tsx:287` (replayable rows) and `TerminalSheets.tsx:110-131` (Share opens the trade share card) | Recorder at 100 ms with the PnL the screen showed; sheet with play/pause/again, scrub, coverage and Share | **Built and shipped on web** (commit `2c46923f`, 7 Oct, K-405 "trade replays and the share card as a PNG"). Owarine's phone app has no trade replay (only the arcade's) |
| **Mitoshi** | `crypto-world-fair/web/src/features/terminal/replay.ts:13`; `ui/ReplayDrawer.tsx:2-3` (ported from Owarine), `:14` (≤ 12 s), `:102-103` (**reduced motion:** no autoplay, jumps to the end), `:142-144` (Realized/Unrealized, NumberFlow rolling PnL), `:165` ("% recorded"); `ui/AccountDrawer.tsx:137` | Right-edge drawer replay with a rolling PnL, coverage and closed time. The commit says Share "joins S5's share card", but the drawer has no Share button | **Built and shipped on web** (commit `c0345617`, 8 Oct, S23.23g; also in `mitoshi-wt/r4-10-records`). No phone code |
| **Senryo R5.19** | `packages/calls/src/replay.ts:34-45` (200 ms, ≤ 12 s, 900-sample halving, 150 episodes, 1.5 MB, gap 3 s, Tradash's rule), `:130-143` (`replayable`), `:146-153` (`pnlAt`), `:168-213` (`recordBook`); `use-replay.ts:18-36`; recorder mounted in `use-live-book.ts:113`; stores `apps/web/src/lib/replay-store.ts`, `apps/mobile/src/lib/replay-store.ts` (MMKV) | **Web** `apps/web/src/features/receipts/Replay.tsx`: 160 px canvas (`:15`), the whole path scaled to its life, entry/line dashed, tone by PnL sign (`:71`), head dot, Odometer PnL (`:140`), Play/Pause/Again and a range scrubber (`:149-178`). **Phone** `apps/mobile/src/features/receipts/Replay.tsx`: a Skia path trimmed on the UI thread (`:125-127`), PnL text stepped 100 times (`:42`), drag to scrub (`:129-137`), masked when balances are hidden (`:146`). Shown on finished receipts only: web `CallReceipt.tsx:65`, `RideReceipt.tsx:50`; phone `CallReceipt.tsx:65`, `RideReceipt.tsx:45` | **Shipped on both apps** (commit `65f41619`, 13 Oct; D-335 at `docs/plan/decisions.md:609`; `replan-r5-live-loop.md:173-174`: seen on ride 18 on the phone and ride 19 on production web) |
| **Senryo v1** (pre-pivot) | `apps/mobile/src/components/charts/EquityChart.tsx` (148 lines) and `features/portfolio/TradingPerformance.tsx` (62 lines), deleted in `cd37e193`; described at `docs/product/flows/c-trading.md:548`; the S4 indexer's "equity curve" query at `docs/plan/stage-04-indexer.md:51` | Own-profile equity curve with 1H / 24H / 1W / 1M / All (All = 365 days). Static | **Built, then deleted** at the 8 Oct pivot (S1 cleanup). Today's indexer has no equity entity |
| **Masayume → Agari → Stocklana** | `stocklana/packages/core/src/strategies/record.ts:20` ("Cumulative net after each settled fill … the equity curve"); `stocklana/packages/markets/src/react/useReads.ts:123`; `agari-wt/s18/context/05-masayume-baseline-parity-inventory.md:263` (Trader Edge L-47: equity curve, win rate, profit factor, expectancy, drawdown, time of day, payoff shape) | A static equity curve and the Trader Edge report from settled history | Built in those products (static, no playback) |
| **Mitoshi /portfolio/edge** | `crypto-world-fair/web/src/features/edge/EdgeReport.tsx:1-8` | The Masayume Edge report on 21st's `portfolio-chart` (block 29532), sharing `/portfolio`'s curve; privacy masks every figure | Built (static) |
| **Tradash Account sheet** | `docs/research/replan-2026-10-10/01-tradash.md:216-218` | Balance with Today / 7D / 30D / All P&L and a cumulative P&L chart | Reference (static) |
| **Fomo study** | `docs/design/reference-study-2026-09-30/03-fomo.md:22, 98`; `09-feature-inventory.md:134`; `evidence/R3/screens/F15.jpg` | Feed with a pinned daily "Recap" post and "Thesis" posts (coin, price, % change, text) | Reference only; no playback screen captured |

**Video export: none anywhere.** A ripgrep over every repo under `~/dev/hackathon` for `MediaRecorder`, `captureStream(`,
`VideoEncoder`, mp4/webm muxers, `mediabunny`, gif encoders, `@ffmpeg/ffmpeg` and `skia-video` (skipping node_modules
and reference folders) hits only `qvac/lifeline-mesh` and `me-shyla` (audio recorders). No trading project has encoded
a video.

**What R5.19 already lost against its own sources:**
1. **The chart.** It is a 160 px line scaled to the trade's life, not the terminal's engine in driven mode as Tradash
   does. So it has no axis, no pill, no head glow, no K or band zone and no camera.
2. **Gaps.** There is no back-fill from 1-minute candles (Tradash, Owarine and Mitoshi all have it). A > 3 s hole in
   the middle 80 % means no replay at all.
3. **The "% recorded" line.** It is gone. The web docstring says a trade with holes "says how much of it was seen"
   (`Replay.tsx:5-6`), but `ReplayFor` returns `null` (`:98-101`).
4. **Reduced motion.** It isn't respected (Mitoshi's is).
5. **Share.** There is no Share from the replay itself (Owarine has it).
6. **Other devices.** A replay exists only on the device that recorded it. A phone trade has none on the web, and
   nobody else can ever see one.

---

## 3. Proposal: Senryo's take

### 3.0 The idea

Senryo is 千両, and a 千両役者 (*senryō yakusha*) is kabuki's star actor, "the thousand-ryō player". A replay is your
star turn, played in three acts:
- **the entrance:** the entry;
- **the run:** the ride, with its scares and its surges;
- **the bow:** the exit. The chart pulls back, the trade slip slides in, and the Kinpaku stamp presses.

Fomo ends on a frozen chart and a referral code. Senryo ends on **its object**: the slip (D-331), the share object
everywhere (D-334). The film is the slip coming to life, and the last frame is the slip you'd share anyway.

Identity rules, which differ from Fomo on purpose:
- **Palette (UGLYCASH, D-304):**
  - in the app, the film follows the app's theme (light `#F5F5F5` / white, or dark `#111111` / `#1C1C1C`);
  - exports use the games' near-black arena (D-316, `palette.ts:81`), so acid green `#B5F543` and coral `#FF647C` read
    vividly;
  - the white slip is the film's only light surface and carries the one shadow.
- **Type:** Roboto Condensed Black for money, headings and markers; Inter for captions; tabular figures.
- **No bordered boxes, pills or badge plates** (memory: Fomo look; direction 13's shared rules):
  - Fomo's tooltip cards become plain caption lines;
  - Fomo's B/S discs become ink notches with condensed caps;
  - Fomo's note bubble becomes text with a hairline leader.
- **`#FA00FF`** marks only the controls (play, export). Direction colours appear only on the line, the PnL and the
  marks.
- **Numbers roll** (the web's Odometer, the phone's odometer) where Fomo snaps.
- **It has sound.** Fomo's export appears silent; Senryo already has a cue map and music beds.

### 3.1 One film engine for both apps and both films

Add a platform-neutral **`@senryo/calls/film.ts`** (plain data, like `replay.ts`). It turns an input into a **film**:
beats, a camera path, captions and a cue track, all as pure functions of film time `t`.
- **Inputs:**
  - a trade replay takes an `Episode` (device samples) or a rebuilt path (§3.2.4);
  - a recap takes an account timeline (§3.3).
- **Players:** each app has a thin player that draws `frameAt(t)` and schedules the cue track.
  - Web: the terminal chart engine in a driven mode, plus overlays on the same canvas.
  - Phone: one imperative Skia `drawFilmFrame(canvas, film, t)`, shown through `<Picture>` and reused by the exporter.
- **Export** draws the same frames offline at fixed steps (§3.4), so what you watch is exactly what you post.

**The cue track** runs the samples through the existing **reaction engine** (`packages/calls/src/reactions.ts:1-7`,
Tradash's combo / surge / slump / callouts). It is pure, and its random callout pick is injectable, so seed it with the
episode id. **The replay then plays the moments and callouts you heard live,** and the same input always gives the same
film.

### 3.2 Trade replay ("Replay")

#### 3.2.1 What R5.19 has and what's missing

| Area | R5.19 today | Fomo | Senryo v2 |
|---|---|---|---|
| Chart | 160 px whole-path reveal | Scrolling window, pinned head, axes, pill, fill | **The terminal's own chart in driven mode** (`apps/web/src/features/terminal/chart/chart-engine.ts:1-7`: glow line, left 32 % erased, 千両 mark, K and entry, band zone, head dot, rolling pill). Tradash's `fitScale` range (`SPEC-chart.md:194-197`). Head pinned where the terminal pins it. The replay looks like the moment you lived |
| Time | Linear, ≤ 12 s | Linear, about 395× | **Event-weighted time:** flat stretches compress and entry, exits and the peak dilate, still ≤ 12 s of run. A small market clock in the corner shows the warp honestly |
| Moments | none | BUY/SELL tooltips, B/S discs | Ink notches **IN** / **OUT** (condensed caps, 12 pt) at the fill and the exit; **−50 %** on a partial close; the trail level steps as a dotted rule (TicketEvent/RideEvent carry `priceE8` and `timestamp`, `indexer/schema.graphql:143-155, 250-262`). For a call, its window: the K print, the band's winning zone, the expiry and the settlement print |
| Beats | none | none | **Slow-motion beats** (ease to 0.25× for 600 ms) at the entry, the deepest drawdown, the peak PnL and the exit, Fomo has none |
| Captions | none | the note bubble | Plain lines under the chart in Inter, 1.2 s each, from the events and reactions: "Opened Up · $5.00 at 62,410.12", "Down $3.10 — held", "Trail moved to 62,900", "Cashed out +$11.20". The user's Take (R8.8, ≤ 240 characters) pinned at its post time with their crest and a hairline leader |
| PnL | Odometer (web), 100 steps (phone) | snaps; tone flips in one frame | Rolling odometer in Roboto Condensed Black; tone flips with the head dot's pulse and the profit ladder's first step |
| Ending | stops | 2 s freeze | **The bow** (2.4 s): the camera pulls back to the whole trade; the slip slides up from the stub; the Kinpaku stamp presses (1.12 → 0.98 → 1 and y −8 → 0 over 220 ms, `apps/web/src/features/receipts/ReceiptStamp.tsx:4-17`) with the result cue |
| Sound | none | none (probably) | Cue map below, plus a music bed |
| Coverage | hidden unless replayable | n/a | Back-fill gaps from `/v1/prices/candles` (1 m OHLC, immutable for past ranges, `services/api/src/routes/prices.ts:91-111`). Say it: "Recorded 84 % · the rest from 1-minute prices" |
| Not recorded here | nothing | n/a | **Rebuilt replay** (§3.2.4), labelled |
| Reduced motion | ignored | n/a | Mitoshi's rule: open on the last frame, scrub to explore |
| Share | none from the replay | export | **Video** next to Image in the slip's share (§3.4) |

#### 3.2.2 The beats (≤ 15 s in all)

| Beat | Film time | What's on screen | Cue |
|---|---|---|---|
| Title | 0–0.6 s | Market crest, "BTC · 5m · Up" in condensed black, the folio `N° C-10143-001021` | `clap` (**new**: two wood-block noise voices 40 ms apart, bandpass ≈ 1.8–2.4 kHz, *hyōshigi*) |
| Pre-roll | to the fill | A ride gets 10 % of its hold from candles before the fill; a call gets its window from the K print to the fill. Line in neutral ink | music fades in (`MUSIC_FADE_IN_S` 1.2 s, `packages/tokens/src/music.ts:134`) |
| Entrance | the fill | **IN** notch, caption, 600 ms slow motion | `open` (`sound.ts:136`) |
| The run | ≤ 12 s | The line, PnL odometer, reactions, partial closes, trail steps, the Take | `profit` ladder (`SOUND_LADDER_SEMITONES`, `sound.ts:357`) each time the PnL reaches a new +10 / 25 / 50 / 100 % tier, at most one per 400 ms; `surge` / `mega` on spikes; `adverse` / `slump` on drawdowns; `MUSIC_TENSE_HZ` filter while losing (`music.ts:136`) |
| Exit | the end | **OUT** notch, 600 ms slow motion | `close` (`sound.ts:137`) |
| Bow | +2.4 s | Pull back, slip, stamp | `win` / `loss` / `refund` (`sound.ts:138-148`) with `cardSlam` (`:203`) on the press; haptic heavy on the phone |

Music: `rush` (128 bpm) under a gain, `night` (92 bpm) under a loss (`music.ts:71, 87`), at `MUSIC_GAIN` 0.32. In the
app the cues follow the Sounds setting; an export carries the soundtrack unless "Sound in video" is turned off.

#### 3.2.3 Controls

- Tap toggles play/pause. Drag scrubs (the phone already does, `Replay.tsx:129-137`). Hold to fast-forward ×3. The end
  frame's button reads **Again**.
- **Share video** appears beside the slip's Share image.
- No speed chips, because chips would be pills.

#### 3.2.4 Honesty and privacy

- **Recorded:** the device's 200 ms samples carry the PnL the screen showed (D-335). Holes are back-filled from 1 m
  candles, labelled with the coverage.
- **Rebuilt:** for a trade this device didn't record, the path comes from 1 m candles between fill and end, plus the
  on-chain prints at fill and settlement (`Print`, `schema.graphql:44-55`; `/v1/prices/print`). The PnL is recomputed
  with the live book's own maths:
  - rides: `ridePnl` (`packages/calls/src/book-ride.ts:1-5`), essentially exact;
  - calls: `valueCall` (`book.ts:150`), model-dependent.
  - It is labelled "Rebuilt from 1-minute prices", so D-335's "what the screen showed" stays true for recorded replays.
  - This is what lets the web replay a phone trade, and lets profile visitors replay a listed trader's calls (R8.2,
    D-297).
- **Hidden balances and share modes:** hidden balances mask the film and block export (D-329). PnL · ROI · Both carries
  into the film's figure (D-334); ROI mode shows no dollars.

### 3.3 Portfolio replay ("Recap": your day, your week, all time)

#### 3.3.1 The film (≤ 20 s)

1. **Title (0.6 s):** "Week 41", or "Today" or "Since 2 Oct", over the handle, with `clap`.
2. **The stage (≤ 15 s):**
   - The result line (cumulative realised PnL) draws left to right in event-weighted time. Nights with nothing open
     compress to ≤ 5 % of the film, which Fomo's linear time would spend on nothing.
   - **Below the line, a lane of entrances.** Each trade appears at its open as a direction-coloured tick, with a thin
     hold bar to its end. As it ends, the line steps and its result ("+$3.20") pops above the point.
   - Notable wins drop a 36 px Kinpaku mini-stamp on the line.
   - The result odometer, "14 / 23 won" and a streak line ("5 in a row", `comboStep` ladder, `sound.ts:368`) update
     in place.
3. **The highlight (≈ 2 s):** the best trade's mini-replay plays inset: recorded if this device has it, otherwise
   rebuilt (§3.2.4).
4. **The bow (≈ 2.4 s):** a **Recap slip**, in the same paper, stub and folio grammar (`N° W-10143-2026-41`):
   - period, trades, win rate, result, best trade, best streak, volume;
   - stamped "Up week" / "Down week" / "Even".

Music follows the result (`rush` / `night`). The profit ladder rises with each new equity high.

#### 3.3.2 Data today, and what's missing

| Need | Today | Missing / to build |
|---|---|---|
| Trades with times and results | **Indexer:** Ticket (`committedAt`, `filledAt`, `settledAt`, stake / payout / proceeds / refunded, outcome, `schema.graphql:57-98`); Ride (`filledAt`, `endedAt`, margin, size, pnl, fees, paid, `:100-141`); Parlay (`:170-189`); EventCall; Duel. **Api:** `/v1/markets/calls?owner` pages **by ticket id**, not time (`packages/api-client/src/routes/history.ts:50-62`); `/v1/markets/calls/:ticketId` gives the events with `priceE8` (`:65-85`); `/v1/rides?owner` returns every ride, with entry/exit and **no events** (`routes/rides.ts:161-166`) | **One account timeline:** `GET /v1/accounts/:owner/timeline?chainId&from&to` — every open, partial close, trail move and end across calls, rides, parlays, event calls, duels and Earn, oldest first, with realised e6 amounts and prices. It extends D-338's lookup reader, which already reads all those tables. D-297 applies: your own always; others only if listed with "show my calls" |
| Per-day result (All time) | `DailyAccountStat` (calls, wins, staked, pnl per UTC day; `schema.graphql:280-290`); rides, parlays and event calls fold in through `countCall` / `finishCall` (`indexer/src/lib/records.ts`); read only by the leaderboard (`services/api/src/history/reader.ts:186-203`) | A per-owner day series, either inside the timeline route or as `?resolution=day` |
| Lifetime record | Account (`schema.graphql:263-279`) and `/v1/markets/stats` (D-333) | none |
| Cash balance over time ("the balance rolling") | **Not indexed:** no deposits, withdrawals, faucet or Practice grants, or referral credits per account | v1 shows the **result** (realised PnL), not the balance. The balance needs ERC-20 `Transfer` indexing for Test USD and USDC (and the grant events) |
| Open positions marked to market | Price archive: `price_candles` 1 m OHLC (`services/common/migrations/0016_markets.ts:30-38`; no retention sweep found); `/v1/prices/candles` capped at a 7-day span per request (`routes/prices.ts:94-96`) | v1 steps only at realised ends; open trades are drawn as hold bars. v2 marks rides from candles (exact) and calls with the quote model (labelled estimated) |
| Earn | EarnAccount gives only `paidIn` / `paidOut` totals (`schema.graphql:294-303`); PoolEpoch has the hourly value and supply, i.e. the share price (`:306-320`) | Per-account Earn events (supply and withdraw with shares and time) to draw Earn's yield as its own line |
| The best trade's path | Device episodes (D-335), or candles | Covered by §3.2.4 |

### 3.4 Sharing: MP4 on both apps

**Formats:**
- 1080 × 1350 (4:5, X and Instagram feed; the same as Fomo) by default, with 1080 × 1920 (9:16, stories) as an option;
- 30 fps, H.264 + AAC, ~6 Mbps, so ≤ 15 s is about 11 MB;
- the poster frame is the stamped slip;
- the end card carries "by @handle" and a `?r=` QR and link (R8.2, R8.4). This is Fomo's referral footer, in
  Senryo's grammar, inside the slip's stub.

**Web:**
- **Encode:** draw frames deterministically into an OffscreenCanvas (no rAF; `t = i / 30`), then
  **mediabunny** (WebCodecs) → MP4.
  - Video comes from a canvas source (`avc`); audio from an `AudioBuffer`.
  - *(API names from memory: `Output`, `Mp4OutputFormat`, `BufferTarget`, `CanvasSource`, `AudioBufferSource`,
    `canEncode`. Check with Context7 before building.)*
- **Soundtrack:** rendered offline by an `OfflineAudioContext` through the existing voice booker. `bookVoice`
  (`apps/web/src/lib/feedback/sound.ts:173`) is typed `AudioContext` and needs widening to `BaseAudioContext`. Music
  comes from `stepVoices` (`packages/tokens/src/music.ts`).
- **Share:** `navigator.share({ files })` where `canShare`, else a download. X's web intent can't attach media, so
  "Post on X" stays text and link (D-334).
- **The end card** reuses the slip's own canvas drawing (`apps/web/src/features/receipts/slip-png.ts:1-5`, already
  1080 px wide).
- **Fallback** where `canEncode('avc')` fails: `MediaRecorder` on `canvas.captureStream(30)`, in real time (WebM on
  Chromium and Firefox, MP4 on Safari *(verify)*), else the PNG slip.

**Phone:**
- **Encode:** **`@azzapp/react-native-skia-video`** `exportVideoComposition({ videoComposition, drawFrame, outPath,
  width, height, frameRate, bitRate })`.
  - `drawFrame` is a worklet that uses Skia's imperative API, the same `drawFilmFrame` the player shows.
  - **Audio items** are mixed and encoded to AAC: place each cue's WAV (already rendered by
    `apps/mobile/scripts/gen-sounds.mjs`) at its time, plus a bed WAV.
- **Share:** `expo-sharing` `shareAsync(uri, { mimeType: "video/mp4", UTI: "public.mpeg-4" })`. Optionally
  `expo-media-library` for Save to Photos.
- **The end card:** capture the slip with `react-native-view-shot` (already used, `SlipShare.tsx:1-5`) and draw it as an
  `SkImage` in the last frames.
- **To verify in a spike:**
  - a composition with no video items, only drawn frames and audio items (the README's examples all composite video
    files);
  - fonts and images loaded once and passed into the worklet.
- **Native module:** this needs a **new binary** (EAS / Release build). An OTA can't add it.

**Libraries checked** (`npm view <pkg> version time.modified`, 13 Oct 2026):

| Package | Version | Last modified | Use |
|---|---|---|---|
| `mediabunny` | 1.61.4 | 2026-10-12 | **Web encoder and muxer (chosen)** |
| `mp4-muxer` / `webm-muxer` | 5.2.2 / 5.1.4 | 2025-07-02 | **Deprecated: "superseded by Mediabunny"** |
| `modern-gif` | 2.1.0 | 2026-04-16 | Optional silent GIF loop (Discord, Telegram) |
| `gifenc` | 1.0.3 | 2022-05-03 | Tiny and stable but unmaintained; second choice for GIF |
| `@ffmpeg/ffmpeg` | 0.12.15 | 2025-04-07 | Last resort only (large wasm, slow) |
| `@remotion/web-renderer` | 4.0.535 | 2026-10-12 | Exists, but it is a React-DOM stack, has a company licence beyond small teams, and doesn't cover the phone. Not recommended |
| `@azzapp/react-native-skia-video` | 0.10.1 | 2026-08-04 | **Phone encoder (chosen).** Peers: skia ≥ 2.0.0, reanimated ≥ 4, worklets ≥ 0.10. The repo has skia 2.6.2, reanimated 4.5.1 and worklets 0.10.1 (`apps/mobile/package.json`), so all peers are met |
| `ffmpeg-kit-react-native` | 6.0.2 | 2025-01-21 | **Deprecated, "no longer supported"** |
| `react-native-video-processing` | 1.7.2 | 2022-09-08 | Stale |
| `@shopify/react-native-skia` | 2.14.0 (repo 2.6.2) | 2026-10-01 | Already the phone's chart and replay renderer |
| `react-native-view-shot` | 6.1.1 (repo 5.1.0) | 2026-10-07 | Already used for the slip PNG |
| `expo-sharing` / `expo-media-library` | 57.0.23 / 57.0.5 | 2026-10-12 / 2026-10-05 | Share sheet / Save to Photos (media-library isn't a dependency yet) |
| `skia-canvas` / `@napi-rs/canvas` | 4.0.0 / 1.0.11 | 2026-10-12 / 2026-10-10 | Only if a server render is wanted later (public replays and X previews from `services/card`, which is empty today); not v1. The shared box can thrash under encoding |

### 3.5 Entry points

- **Trade replay:**
  - Receipt (web `CallReceipt.tsx:65`, `RideReceipt.tsx:50`; phone `CallReceipt.tsx:65`, `RideReceipt.tsx:45`), where
    `ReplayFor` already sits. The film becomes the receipt's hero above the slip.
  - **▶ on history rows** when replayable, or rebuilt (Tradash, `SPEC-flow.md:621-625`).
  - **"Watch"** on the result toast right after a close: the strongest moment to share.
  - The share sheet's **Video**.
  - The recent-calls ticker (R8.3) opens a listed trader's rebuilt replay.
- **Recap:**
  - **Play your week** on the Calls record (`apps/web/src/features/calls/StatsCard.tsx`, phone `StatsCard.tsx`).
  - The Home record line.
  - **Profile** (own: Today / Week / All; public profiles for listed accounts, R8.2).
  - A leaderboard row opens the profile, then the recap.
  - Optional: a Sunday "Your week is ready" in the inbox and push (R8.5's channel).

### 3.6 Where it belongs: R8 (social)

Add three steps to `docs/plan/replan-r8-social.md`:

- **R8.10 Replay v2:**
  - the film engine (`film.ts`);
  - the terminal chart in driven mode on both apps;
  - IN / OUT notches, beats and captions;
  - cues from the reaction engine and the `clap` cue;
  - the bow with the slip and stamp;
  - 1 m back-fill with "% recorded";
  - rebuilt replays;
  - reduced motion;
  - ▶ on history rows and "Watch" on the result toast.
- **R8.11 Video export:**
  - web: mediabunny, with the `OfflineAudioContext` soundtrack;
  - phone: skia-video, expo-sharing and media-library, **with a new binary**;
  - 4:5 and 9:16;
  - PnL · ROI · Both;
  - hide-balances gate;
  - "by @handle" and `?r=` on the end card.
- **R8.12 Recap:**
  - `GET /v1/accounts/:owner/timeline` (own and listed);
  - the recap film and the Recap slip;
  - entry points on the Calls record, Home, profile and leaderboard;
  - the Earn line once per-account Earn events are indexed;
  - the balance line once Transfer indexing lands (otherwise "result").

**Why R8:**
1. The export's end card needs the handle and the referral link (R8.2, R8.4). That *is* Fomo's mechanic: every replay
   is an ad with a code.
2. The recap reads the same history and periods as Trader Edge (R8.7) and the leaderboard's day / week / all (R8.1).
   One timeline endpoint serves all three.
3. The Take pinned on the timeline is R8.8.
4. Public and rebuilt replays on profiles need D-297's listing rules.
5. R5 is closed with its handoff written (`replan-r5-live-loop.md` Handoff), and R6 is in progress.

The phone's native module should share one binary build with R8's other native changes.

*A scope choice for the owner:* R8.10 needs no new dependency. It could be pulled forward as a small R5 follow-up if
the feel matters before social. Export and Recap stay in R8.

### 3.7 Uncertain, or to check before building

- mediabunny's exact API and Safari's WebCodecs `AudioEncoder` support: check at runtime with `canEncode` and Context7.
- Whether skia-video exports a composition with no video items.
- Whether rebuilt call values match the receipt's realised figure closely enough: show the realised figure at the bow
  regardless.
- Event-weighted time needs one rule tuned on real episodes (rides 16–19, calls 1019–1021).
- The `clap` cue is new and would need adding to `SOUND_CUES` and `gen-sounds.mjs`.
- What Fomo's own in-app player offers (controls, speed, per-portfolio) is unknown from this clip. A real screen
  recording of Fomo's app would settle it.
