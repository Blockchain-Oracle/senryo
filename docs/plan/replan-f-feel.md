# F — Feel: sound, haptics, motion, prices with their graphs, the ticket, the network switch, crests (replan addendum, 12 Oct)

**Goal:** the shared feel layer every screen stands on, on both apps:
- every tap, trade, verdict and game moment has its sound and haptic, with music where it belongs;
- everything tappable looks and moves tappable;
- every price carries its 24 h graph and change;
- the ticket reads at a glance;
- Practice ↔ Real is one tap;
- teams wear their crests, with live scores.

**Why now:** the owner's review of production on 12 Oct (v3 live since 07:33 UTC) called the product boring,
mediocre and slop. The audit agreed:
- ten synth blips and no music;
- no game audio;
- no sparkline anywhere (`/v1/prices/day` built and unused);
- teams as abbreviations (D-312);
- the web fixed to Practice at build time (`ACTIVE_NETWORK`, 38 reads; `ModeCapsule` a `<span>`);
- a phone on Real that shows "Markets didn't load" because the api refuses chain 143.

R2 shipped the look's tokens; this stage ships the feel. It runs before R7 and R5 (order: R4 → F → R7 → R5 → R6 →
R8 → R9).

**Authority:**
- the owner's 12 Oct review;
- D-315…D-320;
- research `10-feel-direction.md` (Codex, xhigh) for every number below; `01` §1.8–1.9 and §3 E/F; `02` §2.2–2.4,
  §3.3, §3.5; `03` §2.2 and §2.6; `06` §2.4–2.5;
- port sources:
  - `../owarine/web/src/`:
    - `lib/sound/{trade,music}.ts`, `lib/haptics.ts`;
    - `features/games/{audio,bed}.ts`;
    - `features/terminal/ui/{TradeButtons,ChartControls}.tsx`;
    - `components/shell/app/{ModeChip.tsx,environment.ts}`;
    - `components/kit/Odometer.tsx`;
  - `../owarine/mobile/{src/games/audio.ts,scripts/render-*.mjs}`;
  - `../crypto-world-fair/web/src/components/ui/{sparkline,prediction-ticket,confetti-burst,rolling-clock}.tsx` and
    `lib/feedback.ts`;
  - `../roy-chain/apps/web/src/components/shell/mode-switch.client.tsx`;
- Tradash: numbers and behaviour only (`../canton-season3/context/13-revamp/tradash/SPEC-*.md`), never its code or MP3s;
- 21st.dev first for every component (`21st` CLI, provenance in `.21st/design.json`);
- libraries read through Context7 (`ctx7`);
- licences checked before shipping: Kenney CC0 with `SOURCES.md`; ESPN marks per D-315.

**Gate:**
- `pnpm gate` 0.
- **Web** through the preview tools in light and dark, at 375 px and desktop:
  - every price row and the terminal header with sparkline and chip;
  - the ticket in each mode, priced and unpriced;
  - the switch to Real and back;
  - an events card with crests.
- A dev-only cue log (`window.__senryoCues`) records every mapped cue in one scripted pass: tap, open, win, loss,
  profit step, toggle, sheet, error.
- **Phone:** one simulator pass on a Release build of the same, plus Real showing live prices.
- api, keeper and web deployed; OTA (no native build: `expo-audio`, `expo-haptics`, Skia and Reanimated are already
  in the binary).

## Steps

### Sound, music, haptics
- [ ] F1 One cue map (`packages/tokens/src/sound.ts` grows from 10 cues to the map; gains, patterns and haptic words
  per cue):
  - **Cue groups:**
    - **UI:** tap (±60-cent random detune, ≥ 18 cents from the last), toggle, sheet open and close, success, error.
    - **Trade at Tradash's levels:** open (rising 220 ms with a double impact), close, win, loss (an octave lower than
      today, `01` E2), refund (neutral), the profit ladder, adverse, slump, surge, mega.
    - **Games:**
      - reels: spin, tick, lock and jackpot;
      - cards: deal, flip and slam;
      - countdown beep and go; coin;
      - Line Rider and Candle Hop: landing, scrape loop, gap, combo step, milestone, crash;
      - match found.
    - **Events:** lock and verdict.
  - **Web:** port Owarine's `audio.ts`, `trade.ts`, `arcade-sfx.ts` and `reel-sfx.ts` into `lib/feedback/sound.ts`.
    It keeps today's unlock, silent-buffer and stuck-context handling; Kenney clips are decoded into buffers so repeats
    overlap.
  - **Phone:** a render script turns the same synth definitions into WAVs (Owarine's `render-*.mjs`), and
    `feedback/trade-sound.ts` pools grow to the map.
  - **Mappings:** each app maps the hooks' cues (`fx.current.cue`) to the map, with a dev-only cue log.
  - **Delete:** `feedback/movement.ts`, the unplayed `tap.wav`/`onboarding.wav` and the README's phantom `fill` and
    `liquidation` cues.
- [ ] F2 Music:
  - **Beds:** the games bed (112 bpm, A minor, 8 bars), three terminal tracks (arcade 112, rush 128, night 92) and a
    sparse Duel pulse;
  - **Engines:** code-sequenced on the web (port `music.ts`, `bed.ts`: 25 ms look-ahead timer, 100 ms booking);
    pre-rendered seamless loops on the phone;
  - **Defaults:** games music starts on Play at 20 %; terminal music off by default, behind a ♪ toggle with equaliser
    bars and a "♪ Arcade ›" chip that skips tracks (port `ChartControls.tsx:105-132`);
  - **Mix:** ducks 6 dB over 80 ms for verdicts and recovers over 400 ms; a tense 900 Hz low-pass while ROI ≤ −5 %;
    a speaker control in every game HUD.
- [ ] F3 Haptics and one "Sound & vibration" sheet:
  - **Table:** Tradash's on both apps (tap 8, tick 3, open `[12,20,12]`, close 20, move 6, surge, mega, slump 35, warn
    `[80,60,80]`). This fixes `01` F1 (cash-out as `filled`, surge/mega as `snap`, slump as `warn`).
  - **Phone:** semantic Taptic words on iOS and `performAndroidHapticsAsync` on Android, as today.
  - **Sheet:** effects volume, music volume, haptics, reactions and motion (system/full/reduced), on both apps (port
    `GameSettingsSheet.tsx` and Mitoshi `lib/feedback.ts`). It replaces the two toggles in
    `SettingsDrawer.tsx:103-110`.

### Look and touch
- [ ] F4 The press and affordance kit:
  - **Press:** every tappable element lifts 2 px on hover in 120 ms, sinks 2 px at 0.98 scale in 70 ms on press,
    settles in 160 ms, and sweeps a gloss once on hover (Owarine `.wq-btn`).
  - **Affordance:** a pointer cursor and a 2 px focus ring; rows get a chevron and a whole-row tint.
  - **Shared pieces:**
    - rolling digits: `@number-flow/react` on the web, the Skia odometer on the phone, changed digits only, 180 ms,
      ≤ 5 updates a second, frozen offscreen;
    - a confetti burst (Mitoshi #24692);
    - a rolling clock (#19328);
    - a staggered list entrance.
  - **Enforced:** a new invariant in `scripts/invariants/rules.mjs` refuses `onClick` on a non-interactive element and
    a bare `Pressable` outside the kit.
- [ ] F5 Direction palette (D-316):
  - Up is acid green `#B5F543`, Down is coral `#FF647C`, both with black labels;
  - Range is cyan; Play/selected stays `#FA00FF`;
  - games' arenas are near-black;
  - `palette.ts` stays the only palette, with both themes re-derived and contrast checked.

### Prices with their graphs (D-319)
- [ ] F6 `/v1/prices/day` gains `spark`:
  - 96 fifteen-minute closes per market from the 1-minute table, by one SQL with `date_bin`, inside the existing 60 s
    cache;
  - gaps are kept as gaps, never invented from high/low.
  - `dayPricesRoute`'s schema grows, and `useDayPrices()` (`packages/query/src/markets.ts:194`) finally has callers.
- [ ] F7 `Sparkline` and the shared price row:
  - **Sparkline** (port Mitoshi `sparkline.tsx`, 21st #30538, made passive; Skia path on the phone):
    - 96×32 on desktop, 64×24 on the phone;
    - 1.6 px stroke and an 8 % fill;
    - a dashed baseline at the price 24 h ago; green above, coral below, grey unchanged;
    - a live tail from `packages/live` `history()`.
  - **Change chip:** "↑ +2.34% · 24h", 24 px high.
  - **One row:** 40 px mark → symbol/name → sparkline → price/change → chevron; 72 px tall, 56 px in search.
  - **Used on** Home, Markets, Parlay, Lucky faces, Warm-up cards and ⌘K (R6.4). The terminal header gets the rolling
    price, the chip and a mini sparkline (both apps' `TerminalTop.tsx`).
  - **Stale prices** keep their timestamp.

### The ticket
- [ ] F8 Call buttons:
  - **Buttons** (port Owarine `TradeButtons.tsx`; Mitoshi `prediction-ticket.tsx` for the stake/return hierarchy):
    - 52 px tall, 12 px radius, 10 px gap, equal widths, a 3 px darker bottom edge;
    - label only — ↑ UP, ↓ DOWN, ↔ RANGE, MOONSHOT (rocket), CRASH (plunge) — 16 px condensed, never wrapping;
    - "Pays 2.14×" under each button;
    - the selected stake's line "$5 → $10.70 back, stake included", then fees.
  - **On the chart:** the strikes, the shaded winning region, and "Above $X at close" / "Between $A–$B at close";
    hover and focus preview the region. This replaces `bandWhere` inside the buttons.
  - **Unpriced:** neutral recessed plates that keep their labels with — under them. One sentence outside the buttons
    ("Quote unavailable · retrying", "Calls reopen in 0:12", closed, stale, pending, each its own). This replaces
    `oddsLine()`'s "Not priced now" (`packages/calls/src/quote.ts:173-179`).
  - **Mode control:** Up/Down · Range · Moonshot keeps the 21st segmented control with a sliding thumb.
  - This absorbs R5.4/R5.7's call-button parts. R5.5's TRAIL/CLOSE morph stays in R5 on this structure.

### Practice ↔ Real (D-320)
- [ ] F9 The web switches at run time:
  - **Provider:** `ACTIVE_NETWORK` (`apps/web/src/lib/constants/auth.ts:7`, 38 reads) is replaced by a
    `NetworkProvider` (the phone's `lib/network.ts` pattern).
  - **Switch:** a 44 px two-segment switch replaces `ModeCapsule` (port roy-chain's thumb and keyboard behaviour,
    Owarine's flood transition and stamp).
  - **Switching:** instant and persisted; it keeps the market and window; balances and positions stay separate.
  - **Copy:** Practice reads "Test dollars"; Real reads "Live prices · trading opens with mainnet", and its ticket
    offers "Switch to Practice to play".
  - **Real money gates** stay per D-172, D-267, D-270, D-273 and D-305.
- [ ] F10 Real is never blank:
  - the api serves a read-only catalogue for 143 (markets, sessions and feeds; `listed: false`; no contracts) instead
    of 400 "chain 143 is not served here";
  - prices and the 24 h graph work on Real on both apps;
  - the phone's capsule takes the web's look;
  - `useReadOnlyNetwork()` gets its callers or is deleted.

### Crests and live scores (D-315)
- [ ] F11 Crests:
  - `packages/identity/scripts/catalog.ts` + `fetch-marks.ts` fetch every NHL, MLB, NFL and Premier League team's
    crest from ESPN's team feeds (light `500/` and `500-dark/`) and its `color`/`alternateColor`, pinned by sha256,
    with codegen into `src/generated/{web,native}`;
  - the NFL shield and theScore marks too;
  - `TeamMark` (both apps) draws the crest, and the event feed carries team colours;
  - the abbreviation plate stays only for a club ESPN doesn't list.
- [ ] F12 Live scores:
  - the keeper's ESPN source (`services/keeper/src/events/sources/espn.ts`) also refreshes status
    (scheduled/live/final), score and period/clock every 30 s while a game is on;
  - `market_events` stores them and the `event` topic carries them;
  - `eventSchema` grows `status` and `score`.

### Found on 12 Oct
- [ ] F13 The crowd line stops polling a window nobody has called yet: it starts on the first `Filled`, so there is no
  404 every few seconds. The web's update check gets a 30 s floor between visibility checks.

## Handoff
(written at the end of the stage)
