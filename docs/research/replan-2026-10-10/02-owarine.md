# 02 — Owarine as the reference: what Senryo must take (10 Oct 2026)

**Scope:** a read-only study of Owarine (`/Users/abu/dev/hackathon/owarine`, HackCanton Season 3, HEAD `90a91d71`), compared with Senryo at HEAD `b61d1932` (`wip(games): S8.8`). Nothing in either repo was modified.

**Path roots:**
- **O** = `/Users/abu/dev/hackathon/owarine`
- **S** = `/Users/abu/dev/hackathon/metropolis`
- `path:line` refers to the file as read today.

## What I could not access or verify (read first)

1. **Owarine's Tradash specs are not on disk.** Owarine's terminal code cites `context/13-revamp/TRADASH-FIDELITY.md`, `tradash/SPEC-chart.md`, `SPEC-flow.md` and `SOUND-analysis.txt` throughout, for example `O/web/src/features/terminal/TerminalScreen.tsx:66`. The `context/` folder is not tracked: it is not in the repo, not in git history, and not anywhere on this machine. I worked from the code that implements those specs and from the commit message of `O@1a54a7db`, which summarises them.
2. **Nothing was run, listened to or measured.** I did not run either app, play any sound, or measure frame time or tick rate. Every statement about how something feels is read from code (durations, curves, gains), not observed.
3. **Senryo's live-price rate is unmeasured.** The number used below comes from Senryo's own comment ("Pyth Starter prints about once a second", `S/apps/mobile/src/features/terminal/chart/constants.ts:24-28`), not from a measurement. It needs a 60-second capture of `/v1/stream` before anyone acts on it.
4. **Owarine's own status is mixed.** Some Owarine evidence runs ended with failures (`O/docs/evidence/c9b-games.md:31-52`), and its THIRD_PARTY_NOTICES still names the products "Agari" and "Masayume" (`O/THIRD_PARTY_NOTICES.md:36`). Owarine is a reference for quality, not proof that everything in it works.

## Bottom line

- **Owarine's fidelity lives in its web trading screen (`/trade/[symbol]`, about 8.6k lines).** That screen re-implements Tradash end to end:
  - the chart is the workspace;
  - one tap opens a position, and the UP/DOWN buttons turn into TRAIL/CLOSE;
  - PnL "breathes" on the price pill and in a positions rail that values every open position live;
  - sounds, haptics, reactions and optional music answer every move;
  - sheets cover markets, settings, account and history, a five-step tour, replays and share.
- **Owarine's native phone app never got that screen.** It has no live chart engine, no Trail/Close, and trade sounds that are wired but never called (`O/mobile/src/lib/sound/trade.ts`; no callers anywhere in `O/mobile/src`).
- **Senryo has already ported the core engine, on both apps.** It has the canvas chart on web and a Skia chart on the phone, the shared synthesised cues, the reaction engine, and the streaming runtime. Its phone chart goes beyond anything Owarine shipped natively.
- **What Senryo still lacks is everything around the chart:**
  - the live positions book and equity;
  - one-tap Trail with the break-even line;
  - candles, the market picker, the tour, replays and music;
  - one visual system on the web;
  - the feel of the games: art, sound and visual effects ("juice");
  - Owarine's social surfaces (leaderboard, profiles, reels, activity).

---

## 1. Product map

### 1.1 Web routes (`O/web/src/app`)

| Area | Route → component | What it is |
|---|---|---|
| Landing | `/` → `features/landing/LandingPage.tsx:11-16` | UGLYCASH sky with Fluent "objects", a condensed headline, one pink button, and a phone running the real trading screen on live prices. The "Tap. Watch. Bank it." loop cards read the trade the hero phone is playing (`LandingLoop.tsx:18,53`). |
| Trade | `/trade` → redirect to `/trade/BTC`; `/trade/[symbol]` → `features/terminal/TerminalScreen.tsx:70` | The Tradash terminal (§1.4) |
| Markets | `/markets`, `/markets/[id]` → `features/markets/MarketsScreen.tsx:46,59-109` | Hero and ticket; §01 cadence lanes; §02 word board; §03 committee events; Sensei; per-market Room |
| Ticker hub | `/tickers/[SYMBOL]` → `features/ticker-hub/TickerHubScreen.tsx:127` | Facts, Room, a feed of calls, verdicts and takes, news |
| More trading | `/baskets`, `/short`, `/parlay` | Pre-IPO baskets, an inverse position, a parlay builder |
| Reels | `/reels` → `features/markets/reels/ReelsScreen.tsx:31-47` | Full-screen vertical snap feed of live Windows and community takes, with a Take composer |
| X | `/trade-from-x`, `/claim` | Trade by mentioning the relay on X; X recovery |
| Money | `/portfolio`, `/portfolio/edge`, `/activity` | MoneyHero, pockets, 01 Bets / 02 Collect / 03 Record; Trader Edge; inbox |
| Proof | `/proof`, `/proof/[market]`, `/stats`, `/status` | Settled-Window feed, per-Window oracle prints with Re-verify, traction, service status |
| Social | `/leaderboard`, `/u/[address]` | Board (podium, field, "you" bar) and profile |
| Automate | `/strategies`, `/agents`, `/desk/*` | Copy strategies, agent desks |
| Games | `/games/*` (layout `GamesShell`) | Hub, practice, duel, lucky, range, moonshot, line-rider, candle-hop, rank, history (§2) |
| Learn | `/how-it-works`, `/demo`, `/download`, `/news`, `/legal`, `/pitch` | — |

### 1.2 Phone routes (`O/mobile/src/app`, expo-router)

- **Launch gate:** `index.tsx:10` sends you to `/markets` if onboarded, otherwise to `/onboarding`.
- **Tabs:** markets, reels, games, portfolio. The tab bar is hidden (`(tabs)/_layout.tsx:12-18`); a floating BlurView pill dock is drawn at the root instead (`components/shell/BottomDock.tsx:16-21,62-78`).
  - Dock cells: Markets, Reels, Games, Portfolio, More (More opens the drawer).
  - Every dock tap fires `Haptics.selectionAsync`.
- **Modals and sheets:** `connect` (take a seat), `ticket` (a bottom drawer at 92 % height, `app/ticket.tsx:32`), `funds`, `account`, `sensei`.
- **Stack pages:** activity, agents, baskets, claim, desk/*, earn, how-it-works, leaderboard, notifications, parlay, seat/link, short, status, strategies, tickers/[symbol], trade-from-x, u/[address].
- **The phone's trade loop is a different, older product:**
  - Markets hero → an SVG `PriceChart` (230 px; `features/markets/hero/PriceChart.tsx:10-74`) → Up/Down → ticket drawer → `CallReceipt`.
  - Positions live in Portfolio rows, refreshed by 15-second polling (`features/portfolio/bets/BetRow.tsx:14-51`; `O/packages/markets/src/react/useReads.ts:112-113`), with a "Cash out" link.
  - There is no Trail/Close. `components/kit/ow/DirectionPill.tsx` defines the buttons, but only `kit/ow/index.ts:17` re-exports it.

### 1.3 Navigation, ⌘K and settings

**Web navigation**
- **One nav source:** `O/web/src/components/shell/nav.ts:9-13,37-269`.
- **Six "places"**, each with a number key 1–6: Trade, Markets, Portfolio, Games, Automate, Leaderboard (`:246-253`; keys at `shell/app/keys.ts:14-27`).
- **Phone-width dock:** Trade · Markets · seal · Portfolio · More (`:256-259`).
- **Shell** (`ShellChrome.tsx:25-69`):
  - A floating rail: icons only from md, labels from xl, with a spring-animated active pill and number-key hints (`AppRail.tsx:30-112`).
  - A top bar with a health chip and the ⌘K pill.
  - One rounded stage.
  - The demo/DevNet colour "flood" (§3.1).
- **Splash:** Tradash's splash shows on the first load of an app route (`Splash.tsx:34-37`).

**Command palette (⌘K)**
- `shell/app/CommandPalette.tsx:39-141`, built on cmdk.
- Opened by ⌘K, `/`, or the `owarine:open-search` event.
- Groups: Go to, Trade (every ticker with a live Window), Events, and the More sections.
- **Navigation only.** It has no actions, and the terminal has no trade hotkeys.

**Settings**
- Owarine has no settings page. The terminal keeps one persisted object at `owarine.trade.settings.v1` (`features/terminal/settings.ts:12-45`):

| Setting | Default |
|---|---|
| Size | follows 5 % of available |
| Trail | 0.1 % |
| Close tolerance | 2 % |
| Sound / haptics / reactions | on |
| Music | off (track "arcade") |
| Tutorial seen | false |
| Favourites | none |
| Chart view / interval | line, 1m |

- Where they are edited:
  - Account sheet → Settings (`ui/sheets/AccountSheet.tsx:205-231`).
  - The per-asset settings sheet (`SettingsSheet.tsx:47-166`): size with a slider and Min/25/50/Max chips, a payout read-out, trail chips, and an order summary.
  - Chart controls.
- Theme: `lib/theme.ts:4,18-21`, light by default.
- Games settings: `features/games/settings.ts:32-40`.

**Phone navigation**
- A right-side drawer, 82 % wide (`components/shell/NavDrawer.tsx:21-55`), with sections from `nav/items.ts:41-83`: Start, Prediction, Arcade, Automate, Trade, Proof, Learn, Account.
- No search or ⌘K.
- No settings in `account.tsx`. Theme is a header toggle. Sound and haptics settings exist only in the Games settings sheet.

### 1.4 The trade loop (web terminal)

`O/web/src/features/terminal/TerminalScreen.tsx` is one full-screen surface.

**Layouts**
- **Desktop** (≥1024 px, "Tradash's one breakpoint", `:37-38`): the chart on the left with the asset chip, Window chip, settings stack and chart controls floating over it. A 20 rem aside on the right holds the sheet row, equity pill, Unrealized card, positions list and buttons (`:297-327`).
- **Phone width:** the chart fills the screen. The header carries the asset chip, equity pill and Window chip. The footer carries the controls, a View-position pill showing count and ROI, and the buttons (`:330-355`).

**The loop**
1. **First visit:** the five-step tour opens automatically: Watch, Tap UP or DOWN, Watch your PnL, Trail, Close (`:95-98`; `ui/sheets/tour-copy.ts:4-10`; `Tutorial.tsx:52-55`).
   - Its illustrations are drawn in code.
   - It ends with "Try Demo" or "Take a seat", and can be reopened from Account → How it works.
2. **Demo mode:** paper trading on the venue's live ladder. 10,000 credits, no fee, persisted, and settled on the real resolution (`mode.ts:7-12`; `TerminalScreen.tsx:175-198`).
3. **UP / DOWN** (`ui/TradeButtons.tsx:7-11,42-73`):
   - Soft-tinted pills, 64 px tall, labels tracked 0.2 em, with "pays 1.9×" under each.
   - When the buttons are disabled, a plain sentence says why (`why.ts:5-9`).
4. **Open feedback:** the toast reads "Opening Up BTC…" and is replaced in place by "Up BTC opened · pays … · staked", with the open cue and the open haptic (`useTerminalTrade.ts:112-152`).
   - Each failure has its own words: requote, nothing filled, waiting for the ledger, resting.
5. **Holding a position:**
   - The buttons cross-fade to **TRAIL** and **CLOSE**. TRAIL stays greyed until the move past break-even beats the trail distance, with the hint "Need +0.1% past break-even" (`TradeButtons.tsx:75-94`).
   - The chart pill grows a second row with live PnL, and a PnL band fills from the line to the entry.
   - Level lines: Entry, Line (the Window's open print), B/E and Trail (`useChartFeedback.ts:33-49`).
6. **Trail** ratchets on every committed price and closes when hit (`TerminalScreen.tsx:172-173`). With the seat package deployed it becomes a resting exit on the ledger that fills with the tab closed (`TradeButtons.tsx:32,88`).
   - A TP/SL sheet sits beside it (`ui/sheets/ExitSheet.tsx:20-25`).
7. **Close:**
   - Takes a firm price within a 2 % tolerance without asking.
   - Plays the win or loss cue, chosen by realised PnL.
   - A win bursts confetti from both bottom corners (`toasts.tsx:8-11`; `useTerminalTrade.ts:169-174`).
8. **Positions rail / phone sheet** (`ui/PositionsPanel.tsx:23-120`):
   - The **Unrealized PnL** card is a rolling odometer with a %. It counts positions it cannot price as "N unpriced", never as 0. It offers **Close all (n)** when more than one position can be closed.
   - Expandable rows offer add, reduce, exits, share and a publish toggle.
   - A parlay slip lives in the same rail (`parlay/*`).
9. **Equity pill:** cash plus the value of open positions, opening the account sheet (`TerminalScreen.tsx:160,312`).

**Sheets** (`ui/TerminalSheets.tsx`; Tradash's bottom sheet at every width, `components/kit/Sheet.tsx`)

| Sheet | Contents |
|---|---|
| Markets | Search; categories Favourites/All/Hot 🔥/Crypto/Stocks/Pre-IPO/Baskets; star favourites; last price and 24 h change (`MarketsSheet.tsx:18-27,71-75`) |
| Account | Menu, settings, trade history with Lifetime PnL, Win rate, Trades, Win streak, Best streak, Volume; replayable rows (`AccountSheet.tsx:184-300`) |
| Leaderboard | Daily/Weekly/Monthly/All time × ROI/PnL (`LeaderboardSheet.tsx:21-23`) |
| Positions | The phone version of the rail |
| Add / reduce | — |
| Exits | TP/SL |
| Share | PnL / ROI / Both, a keychain-charm PNG at 1600×1000, tiered X text (`share-png.ts:5-9`; `PositionSheets.tsx:190-243`) |
| Replay | Plays a recorded trade back in ≤12 s (`ReplaySheet.tsx:12`; recorder `replay.ts:8-14`: a sample every 100 ms with the PnL beside it, ≤150 episodes, about 1.5 MB) |
| Install | PWA install |
| Tour | The five steps above |

**Other pieces**
- **App updater:** a persistent "New version available" toast with Refresh, checked every 5 minutes against `/api/version` (`useAppUpdate.ts:9-13`).

### 1.5 History, receipts, social, leaderboard

- **Receipt:** a cream "ticket stub" (`O/web/src/components/receipt/Receipt.tsx:22-56`) with:
  - a title, a big figure and the settled time;
  - rows with dotted leaders;
  - a proof link ("Don't trust it. Click it.");
  - a perforated tear line and "Only you can cash out."
- **Verdict fields:** paid out, Window, opening print, closing print, settlement transaction, price source → `/proof/<id>` (`features/markets/verdict/VerdictCard.tsx:91-108`).
- **Share:** a 1600×900 PNG, sent to the native share sheet, or downloaded with an X intent (`features/share/useShareCard.ts:23-87`).
- **Leaderboard** (`features/leaderboard/*`):
  - Hero stats; a 2-1-3 podium with gold/silver/bronze medals; a ranked "field" for ranks 4–50; public activity; a **YouBar** (rank, of N, top %, net, win rate, streak).
  - Periods 24h / 7d / 30d / all / session, filterable by ticker.
  - **Defects:** rows don't link to profiles, and the web page only ranks by PnL.
- **Profile:** avatar hue, address, verified X handle, record, published calls and takes (`features/profile/ProfileScreen.tsx:25-95`). Positions are private until published (`terminal/ui/PublishToggle.tsx:8-12`).
- **Takes:** signed posts of ≤240 characters with ≤4 cashtags, composed only on `/reels`.
- **Rooms:** per-market threads, open only to people holding a position.
- **Activity inbox** (polls every 15 s): fill, resting-filled, settled-win, settled-loss, voided, claimable, paid-automatically, take, copied (`features/activity/protocol.ts:8-47`).
- **Phone:** the same leaderboard and profile screens, plus push notifications (per-kind toggles), a Live Activity and a home-screen widget (`O/mobile/src/features/alerts/*`).
  - Push cannot work as configured: `easProjectId` is null (`O/mobile/app.identity.json:11`; `alerts/push.ts:54-55`).

### 1.6 Onboarding

- **Web:**
  - Landing → `/trade` → the automatic five-step tour → "Try Demo" (paper trading) or "Take a seat". Taking a seat creates a browser key and leases a Canton party (`providers/wallet/copy.ts:8-32`).
  - Credits arrive with the seat lease; CreditWelcome is a one-time modal (`features/funding/CreditWelcome.tsx:11-36`).
  - Coach marks: none.
- **Phone:**
  1. `BrandIntro`: the mark springs in, the "intro" chime plays with a heavy haptic, held for 2.1 s (`features/onboarding/BrandIntro.tsx:18-46`).
  2. Four paged screens with a progress rule; each page turn plays the "page" sound and a selection haptic.
  3. "Accept and take a seat" or "Look around first" (`OnboardingScreen.tsx:106-174`).
  4. Finishing plays "done" with a success haptic.
  - There is no handle step, no notification primer and no faucet (`app/funds.tsx:28`).

---

## 2. Games

Sources: `O/web/src/features/games` (about 13.5k lines) and `O/mobile/src/features/games` (about 11.2k lines). The same core lives in `O/packages/core/src/games`.

### 2.1 Mode by mode

| Mode | How it plays and feels | Evidence |
|---|---|---|
| **Hub** | Hero; season banner (pixel trophy with a signal glow, pixel type, pool and countdown); active match or "Pick up where you left off"; Prediction / Duel / Arcade sections; profile card and achievements; history plates. Background is a checker tile drifting over 12 s. Cards use Lucide icons, not art. Occupancy polls every 10 s ("N players searching"). | `GamesHub.tsx:60-128`; `SeasonBanner.tsx:14-32`; `games.css:27-40,330-345`; `duel/useRoomOccupancy.ts:19-71` |
| **Duel** | Elo-banded matchmaking: ±100, widening +50 every 15 s, capped at ±400. Queue screen: a 53×10 pixel "SEARCHING" banner, a breathing border glow (2.4 s), bouncing dots. Lobby: two hue avatars "vs" and the deck commitment hash. Swipe deck: a throw commits past 84 px or 480 px/s; tilt up to 18° (+6° on fly-off); an UP/DOWN stamp after 24 px; the card art flips from coin to bull/bear at scale 1.18. An urgency bar drains and pulses in the last 30 s. Cards settle one by one with win/loss samples. The result modal is tinted, with NES jingles and a share PNG. | `packages/core/src/games/matchmaking.ts:13-61`; `duel/DuelQueue.tsx:20-70`; `stage/SwipeDeck.tsx:69-77`; `motion.ts:27-35`; `stage/stage.css:100-106`; `DuelResult.tsx:56-102` |
| **Lucky** | Three CRT "faces" (asset, side, reach) whose value **swaps every 60 ms**; there is no scrolling strip. They stop at 720 / 980 / 1240 ms, each with a scale "thunk" from 1.06 to 1 over 240 ms on `(.22,1,.36,1)`, a 16 px glow and a 3 px coloured foot bar. A 480 ms lock-in hold, then the deal card. The fairness check is commit/reveal (keccak commit, HMAC draw, browser "Check it"). No near-miss, no confetti. | `lucky/LuckyReels.tsx:23-27,63-86,145-156`; `lucky.css:57-70`; `lucky.server.ts:36-78,196`; `useLuckyCheck.ts:28-42` |
| **Practice** | Swipe 1–5 cards in 90 s, then a 30-second live-spot watch against a seeded coin-flip bot. The copy says "closing prints", which is wrong. | `packages/core/src/games/practice.ts:4-40,192-235`; `copy.ts:72` |
| **Range / Moonshot** | Range is a band build that reads the range reserve. Moonshot has an aim ladder (±2…25, default LONG ×5), plays a swipe sound when the aim crosses sides, and plays confirm then card-win. | `features/range/*`; `games/moonshot/MoonshotBuilder.tsx:80-110` |
| **Rank / achievements / seasons** | Elo starting at 1000 (K=48 for the first 10 matches, then 24). Ten badges (First hand, Winner, Regular, Played for it, On the ladder, Above the line, Arcade debut, Both machines, Rolled the dice, Lucky). Season prize split 40/20/10 then 5 each for ranks 4–9. **No XP or levels.** | `packages/core/src/games/rating.ts:11-64`; `achievements.ts:64-75`; `season.ts:31-36,129-140` |

### 2.2 The arcade: Line Rider and Candle Hop

**Rendering**
- **Web:** Canvas 2D on a fixed 640×360 field, stepped at exactly 60 Hz with an accumulator and render interpolation. Device pixel ratio is capped at 2; a stall is clamped at 100 ms; the loop stops while the tab is hidden (`arcade/useArcadeLoop.ts:8-111`).
- **Phone:** a Canvas2D-subset recorder replays the web draw code into **react-native-svg**, dropping to 30 fps when frames average over 24 ms (`O/mobile/.../arcade/recorder.ts:1-11`; `useArcadeFrames.ts:10-37`).
- **Determinism:** an xorshift32 RNG. The server replays every run and requires an exact score match (`arcade/score.server.ts:72-110`).

**Art**
- Pixel sprites defined as grids in code. **There are no image files.**

| Sprite | Size |
|---|---|
| COIN | 16×15 |
| PIP | 5×5 |
| Bull | 16×14 |
| Bear | 16×13 |
| Coin | 16×15 |
| CardBack | 16×16 |
| SEARCHING banner | 53×10 |
| LockedIn | 12×12 |
| Trophy | 14×14 |

- Sources: `arcade/sprites.ts:17-42`; `art/PixelArt.tsx:37-190`. They are drawn as SVG rects with `crispEdges`.

**CRT effect (CSS only)** (`stage/stage.css:114-127`; `arcade/arcade.css:55-59`)
- Pillow corners and a radial glass gleam.
- Inset vignette.
- 2 px scanlines plus a 3 px RGB subpixel layer in overlay blend mode.
- A 0.18 s flicker.
- Four corner screws.
- The phone rebuilds it in SVG with a Reanimated flicker (`mobile/.../arcade/Crt.tsx:12-65`).

**Font:** m6x11plus pixel font by Daniel Linssen, free with attribution (`O/web/public/fonts/m6x11plus.ttf`, SOURCES.md).

**Palette**
- Web arcade: ground `#050505`, up `#34D399`, down `#FB7185`, accent `#E04D26` (`arcade.css:28-33`).
- Phone: the theme's dark tokens.
- **The two disagree.** The web values look stale.

**Juice**
- Screen shake on a Candle Hop crash: 0.34 s, amplitude 8×strength×life² (`flap-draw.ts:38,77-81`).
- Line Rider sparks and a 160-point trail (`ride-draw.ts:55-87`).
- An impact burst of 8 rays (`flap-draw.ts:147-166`).
- A death vignette, and a low-grip red pulse below 28 % (`ride-draw.ts:178-197`).
- A parallax grid (Candle Hop).
- Combo heat in the line's colour and glow width, with a ×N counter in the HUD.
- Entrances: 280 ms enter and a 260 ms route slide; buttons press to scale 0.97 with a raised edge.
- **Missing:** confetti, number tickers and hit-stop.

**Sound effects**
- **Web**, all synthesised (`arcade/arcade-sfx.ts`):
  - hop "tuiing", climbing a fifth over a streak;
  - a detuned-saw crash with a thud;
  - a ride-start noise sweep with an A-minor bloom;
  - a ride crash;
  - milestone ticks a semitone per multiplier;
  - a regain blip.
- **Phone:** 26 WAVs pre-rendered by `O/mobile/scripts/render-arcade-sfx.mjs`.

**Music:** an 8-bar A-minor chiptune bed at 112 bpm (square lead, triangle bass, saw pad, noise kit), synthesised live on web (`games/bed.ts:1-131`) and rendered to `bed.wav` for the phone (`render-bed.mjs`).

**Controls, HUD and screen**
- **HUD:** score in pixel type at 33 px, Best, and the combo ×N.
- **Overlays:** a title plate; a game-over plate with "★ New best", "Ranked #N" or "Not recorded — why".
- **Web:** no pause and no full screen (the field is a 16:9 box, at most 72 vh).
- **Phone:** a full-screen modal rotated to landscape, with a "turn your phone" cue, pause, resume and quit (`O/mobile/.../arcade/ArcadeFullScreen.tsx:22-152`).
- **Input:** pointer, wheel and arrows on web; pan and touch-down on the phone.

**Interface sounds:** every games control plays a click with randomised detune, gain and filter (`games/audio.ts:42-48,181-225`). The phone's Press component has no click.

### 2.3 Game assets and licences

| Asset | Where | Licence / provenance |
|---|---|---|
| 10 interface/game MP3s: click, modal-open/close, card-win/loss, swipe-up/down, match-found, duel-win/lose | `O/web/public/sounds/`, byte-identical copies in `O/mobile/assets/sounds/` | Kenney CC0 (`THIRD_PARTY_NOTICES.md:47-58`; `public/sounds/SOURCES.md`) |
| 13 trade MP3s (tap, open-up/down, close-win/loss, profit-tick, sheet-open/close, key, swipe-confirm, success, toggle, error) | `public/sounds/trade/` | Kenney CC0. On web only the flow clips are used; the trade cues are synthesised. |
| 12 games MP3s (card-deal/flip/slam, coin, countdown-beep/go, jackpot, reel-spin/stop, rocket-boost/launch, target-hit) | `public/sounds/games/` | Kenney CC0. **Nothing in either app references them.** |
| `bed.wav` and 26 `arcade-*.wav` | `O/mobile/assets` | Rendered by Owarine's own scripts |
| `onboard-{intro,page,done}.mp3` | phone | ElevenLabs (`onboarding-sound.ts:4`); licence not listed (UNVERIFIED) |
| 52 Fluent Emoji 3D images (webp on web, png on phone) | `O/web/public/art/fluent/`, `O/mobile/assets/art/fluent/` | Microsoft, MIT, `microsoft/fluentui-emoji@1ffb34c`. **Not used in games;** they appear in the landing sky and on empty states (`lib/art/fluent.ts:1-4`) |
| `m6x11plus.ttf` | web and phone | Daniel Linssen, free with attribution |
| All game sprites, CRT, music, reel and arcade sounds | code | Owarine's own |

### 2.4 Why the games feel like games

**What creates the feel:**
- **A consistent arcade frame:** the CRT bezel, the pixel font, pixel sprites and the checker background.
- **A distinct synthesised voice for every event:** spin, ratchet tick, lock thunk with a bell climb, win sting with sub-boom, lose sigh; each arcade action has its own sound.
- **One music bed** while on a game screen.
- **Physical motion:** throw thresholds with tilt, stamps, the stop "thunk", screen shake, particles and combo heat.
- **Visible fairness:** commitment hashes on screen and "Check it".
- **Social presence:** occupancy counts and "opponent deciding".
- **Meta-progress:** season banner, achievements and Elo.

**What it lacks:** confetti, number tickers, hit-stop, a near-miss in Lucky, and a pause or full screen on web.

---

## 3. Visual system

### 3.1 Colour: one system on web and phone

Owarine has one palette, called "UGLYCASH × Tradash" in the code. Web and phone resolve the same roles from it (`O/web/src/styles/owarine.css:1-9`; `O/mobile/src/theme/palette.ts:1-4`). The principles:

- Light is the default and dark is a toggle the user chooses. With no stored choice the app is light, whatever the OS says (`web/src/lib/theme.ts` header; `mobile/src/theme/index.tsx:11,24`).
- Power Pink `#FA00FF` is the **one action fill**, with a white label on it.
- Up and down each get two tokens: a darker one for text and a brighter one for lines and fills.

| Role | Light | Dark | owarine.css |
|---|---|---|---|
| Canvas | `#F2F2F2` | `#0A0A0A` | :12, :108 |
| Card | `#FFFFFF` | `#161616` | :13, :109 |
| Recessed / hairline | `#E8E8E8` / `#DCDCDC` | `#222222` / `#2C2C2C` | :14-15, :110-111 |
| Ink / muted / helper | `#000` / `#5E5E5E` / `#888` | `#FFF` / `#A3A3A3` / `#7A7A7A` | :16-18, :112-114 |
| Pink fill (pressed) | `#FA00FF` (`#D600DB`) | same | :21-22 |
| Pink as text | `#B000B5` | `#FF6BFF` | :23, :116 |
| Up text / up line | `#078A2E` / `#19C23E` | `#3DDC5A` | :26-27, :117-118 |
| Down text / down line | `#D21F1F` / `#FF3B30` | `#FF5A52` | :28-29, :119-120 |
| Stickers only | sky `#02BBFF`, lime `#ADFF02`, cream `#E7E3BF` | same | :31-34 |
| Chart break-even | `#D99A00` | same | :46 |
| Medals | `#E8B210` / `#A7AFB8` / `#C77A3A` | same | :47-49 |

The account mode tints the whole frame. With no seat, `data-mode="demo"` turns the canvas and rail sky-hued. With a seat, `devnet` turns them pink-hued. The stage stays white (light) or near-black (dark). A mode change "floods" out from the seat control over 520 ms on `cubic-bezier(0.65,0,0.35,1)` (`owarine.css:68-69,131-188`; `shell.css:89`).

### 3.2 Type

- **Display:** Archivo with its width axis at 62 (extra-condensed), weight 900, uppercase, tracking −0.033 em. It is the free stand-in for UGLYCASH's Helvetica Now Display Condensed (`O/web/src/lib/fonts.ts:3-18`).
- **Body and figures:** Inter, tracking −0.02 em, tabular numerals.
- **Chart axis and pill:** JetBrains Mono (`owarine.css:97-104`).
- **Watermark and seal:** Noto Sans JP 900 for 終値.
- **Phone scale** (`O/mobile/src/theme/type.ts:51-64`):

| Style | Size / line height |
|---|---|
| display | 40/42 |
| headline | 26/30 |
| title | 18/23 |
| body | 15/23 |
| caption | 13/19 |
| labelMicro | 11, uppercase, tracking 1.76 |
| dataHero | 44, Archivo |

### 3.3 Motion constants

| Constant | Value | Source |
|---|---|---|
| Radii | 16 card / 46 feature / 999 pill; no shadows except the receipt stub | `owarine.css:77-79` |
| Sheet spring | `cubic-bezier(0.32,0.72,0,1)` | `:81` |
| Green/red flip | 120 ms | `:82` |
| Odometer | 260 ms on `cubic-bezier(0.22,1,0.36,1)` (NumberFlow); zero reads as up (green) | `components/kit/Odometer.tsx:28-34` |
| UP/DOWN ↔ TRAIL/CLOSE swap | y 12→0 in 0.18 s on `[0.22,1,0.36,1]`; press scale 0.97 | `TradeButtons.tsx:42-46` |
| Toasts | top-centre, ≤3; success/info 3.5 s, error 5 s; a toast with the same id replaces the one shown | `toasts.tsx:8-28` |
| Reaction flash / callouts | 0.9 s; callouts live 1.5 / 1.8 / 2.2 / 2.6 s by tone | `ReactionOverlay.tsx:23-27`; `reactions.ts:54` |
| Splash | held ≥1.4 s, gone by 3.5 s; the chart loop starts only after it lifts | `Splash.tsx:9-37`; `lib/splash.ts` |
| Phone drawer | spring damping 26 / stiffness 260; closes past 25 % drag or a flick faster than 900 | `O/mobile/src/components/drawer/BottomDrawer.tsx:20-24` |

### 3.4 Logos and marks

- **Asset marks:** vendored path data, never fetched at runtime (`O/web/src/components/icons/asset-marks/paths.ts:1-23`).
  - Sources: simple-icons CC0 (16.31.0, plus the last releases that still carried Amazon and OpenAI). Microsoft is drawn as four rectangles. Polymarket's pennant comes from Wikimedia.
  - Names with no open square glyph get the brand-colour monogram.
- **Placement:** the glyph sits on a 32-unit brand disc. Baskets get a member cluster; tokenised stocks get an issuer badge (`features/markets/hero/asset-mark.tsx:78-101`). The phone reuses the same glyphs in native SVG.
- **Sponsor logos:** light and dark SVG pairs (`components/brand/SponsorMark.tsx:15-17`).

### 3.5 Sound library and cue vocabulary

**Trading cues** are synthesised in Web Audio with a 5 ms attack, exponential decay and exponential glides (`O/web/src/lib/sound/trade.ts:5-54`).

| Cue | What it is |
|---|---|
| tap | 1.1 kHz, 45 ms |
| open | 735→1160 Hz |
| close | 817→432 Hz |
| win | 880 / 1102 / 1297 Hz at 0 / 80 / 160 ms |
| loss | 848→566 Hz, plus an octave below |
| profit | 1050 then 1297 Hz |

Cues that come from price movement while you hold a position (`trade.ts:252-266`):

| Cue | What it is |
|---|---|
| Combo ladder | the profit cue climbing a major pentatonic over two octaves |
| Adverse | 262→196 Hz |
| Slump | 330→130 Hz |
| Surge | triangle arpeggio C5 E5 G5 C6; mega adds E6 |

Engine behaviour: the audio context unlocks on the first gesture and resumes when the tab returns; every error is swallowed. The interface flow clips (sheet, keypad key, swipe-confirm, success, toggle, error) are Kenney CC0.

**Music** (`lib/sound/music.ts:5-47`):
- Three tracks sequenced in code: arcade 112 bpm square lead, rush 128 bpm saw, night 92 bpm triangle.
- Gain 0.32; 1.2 s fade-in; 0.5 s crossfade; silent while the tab is hidden.
- A **tense low-pass** drops to 900 Hz while the open position is ≥5 % down (`useChartFeedback.ts:80-81`).

**Haptics** (`lib/haptics.ts:8-65`):

| Kind | Pattern (ms) |
|---|---|
| tap | 8 |
| tick | 3 |
| open | [12,20,12] |
| close | 20 |
| move | 6 |
| surge | [25,35,25,35,45] |
| mega | [40,30,40,30,40,30,80] |
| slump | 35 |
| warn | [80,60,80] |

On iPhone, which has no Vibration API, a hidden `<input switch>` is clicked 1–5 times, 70 ms apart, to get iOS 18's switch haptic.

**What fires on what** (`useChartFeedback.ts:56-78`). The table is fed once per committed price (5 Hz):

| Event | Sound | Haptic | Visual |
|---|---|---|---|
| Favourable step | combo step | move | — |
| Second or later adverse step | adverse | — | — |
| Surge | surge or mega | surge or mega | edge flash |
| Slump | slump | slump | edge flash |
| Callout | — | warn, on a warn callout | emoji riding the price head |

Callout copy, ROI milestones and their emoji are in `feedback/reactions.ts:32-51`.

---

## 4. Real-time

### 4.1 Price relay (`O/services/ops`)

- **Crypto display spot** is the **Coinbase Exchange WebSocket `ticker`**, which carries every trade (`prices/crypto-spot.ts:1-41`).
  - A symbol quiet for 5 s is read from a five-venue REST median, at most every 3 s.
  - Canton Coin comes from Bybit trades × USDT-USD (`bybit.ts:1-12`).
  - Stocks come from Pyth Hermes, RedStone and Alpaca (`spot-feed.ts:1-29`).
- **The display spot never settles anything** (crypto-spot.ts:6-7).
- **Routes** (`http/server.ts:79-97`):

| Route | What it serves |
|---|---|
| `/prices/stream` (SSE) | One frame per symbol at most every **125 ms (≤8 Hz)**, ending on the newest price; a 15 s keepalive; a snapshot on connect (`http/spot-sse.ts:1-19,132`) |
| `/prices/latest` | Latest price, with a freshness flag and an archive fallback |
| `/prices/recent` | The last 30 minutes at 1 sample/s (`recent-ring.ts:1-10`) |
| `/prices/candles` | 1m…1d bars, 300 per read (`chart-candles.ts:1-15`) |
| `/prices/day` | 24 h stats, for the picker's "24h change" and "Hot" (`day-stats.ts:1-8`) |

### 4.2 Client runtime (`O/packages/markets/src/runtime`)

- **One shared `EventSource` per tab** (`spot-stream.ts:1-160`):
  - It lingers 5 s after the last subscriber leaves, closes after 60 s hidden, and reopens with a 5 s → 60 s backoff.
  - Duplicate ticks are dropped.
- **The phone** uses `react-native-sse` through the same door. It disconnects in the background and reconnects on the foreground (`O/mobile/src/lib/sse-source.ts:27-85`).
- **Seed merge:** `/prices/recent` is merged into the live series wherever there is no point within 1 s (`live-series.ts:63-127`).
- **React vs chart:**
  - React state commits at most every 200 ms per symbol, on the leading edge plus a trailing tick (`features/terminal/live.ts:24-54`).
  - The chart takes every tick directly and never renders React (`chart/LiveChart.tsx:105-115`).

### 4.3 Chart engine (web canvas, `O/web/src/features/terminal/chart`)

**Sampling and easing**
- The eased price goes into a **600-sample ring on a fixed 60 Hz sample clock**, so the plot shows about the last 10 s.
- Frame-time correction: `sampleDebt` adds up `dt/16.67`; at most 8 samples are pushed per frame; `dt` is capped at 250 ms (`chart-engine.ts:19,124-146`).
- **Ease:** 0.18 per sample (τ ≈ 84 ms), as `easeFor = 1-(1-k)^(dt/16.67)` (`engine.ts:11-27`).
- Unlike the reference, the window does not halve on a 120 Hz screen.

**Axis and line**
- The y-axis re-centres every frame at ±7.5 "nice" steps. One step is 0.01 % of price, rounded to a nice number and frozen per symbol (`engine.ts:19-38`).
- The line is Catmull-Rom → Bézier with tension 1/6, drawn as a 6 px glow at 0.18 alpha under a 2 px line.
- The left 32 % of the line dissolves via `destination-out`.
- A 3.5 px head dot (`chart-engine.ts:173-226`).

**Pill, band and levels**
- **Pill:** a capsule whose digits roll per slot, upward on a rise and downward on a fall, with ease 0.22 (`canvas-odometer.ts:1-30`). It grows a second row with a position open.
- **PnL band:** a gradient from 0.22 to 0.02 alpha (`chart-engine.ts:189-198,258-265`).
- **Levels** (`chart-style.ts:47-52`):

| Level | Dash | Width | Alpha |
|---|---|---|---|
| Entry | [4,4] | 1 | 0.55 |
| B/E | [1,3] | 1 | 0.75 |
| Line | [2,3] | 1 | 0.7 |
| Trail | [6,3] | 1.5 | 1 |

- **Colour follows the position's PnL sign only** (`chart-engine.ts:149`).

**Backdrop and other views**
- A parallax dot field on a second canvas: 34 px spacing, drift measured in grid steps (`dot-grid.ts:1-12`).
- A 終値 watermark at 0.07 alpha.
- A **candle view**: 300 candles; pan, pinch, wheel and axis-drag; a tap crosshair with haptic detents; double-tap to recentre. Switching views crossfades the canvas (`candle-view.ts:1-6`; `chart-engine.ts:109-121`).

### 4.4 Live PnL

- **Value = what Close would pay right now.** It is the venue's own exit walk over the published ladder.
- **Between ladder updates the ladder is re-priced** from the live spot: Δfair comes from `fairYesTicks(spot, open, secondsLeft, σ)`, and every level shifts by it (`O/packages/markets/src/runtime/live-exit.ts:1-55`).
- **`useLiveBook`** values **every open position in every market at 5 Hz**. It keeps each ladder and spot stream open, and replaces the map only when a number changes (`features/terminal/live.ts:56-113`).
- **Break-even** is found by 26-step bisection within ±10 %, cached per (position, ladder, second). It drives the B/E line and Trail eligibility (`live.ts:115-156`).
- **Totals and equity:**
  - Totals skip positions that cannot be priced (`PositionsPanel.tsx:30-42`).
  - Equity is cash + Σ exit values + parlay fair value (`TerminalScreen.tsx:160`).
- **Close tolerance:** 2 % (`O/packages/markets/src/react/useLivePnl.ts:37-65`).

---

## 5. Senryo today, in one view

### Already at or past Owarine — keep, and don't regress

- **Chart engine on both apps.**
  - Web canvas: `S/apps/web/src/features/terminal/chart/*`. Constants match Owarine's: 600 samples, 60 Hz, Catmull-Rom, 32 % fade, ±7.5 steps (`constants.ts:7-93`).
  - Phone: Skia on the UI thread via `useFrameCallback` (`S/apps/mobile/src/features/terminal/chart/LiveChart.tsx:1-8`; `state.ts:1-25`). STATUS reports a 1.23 ms average frame. Owarine's phone app never had this.
  - Senryo adds adaptive τ = max(84 ms, 0.5 × the measured tick interval) for a slow feed (`constants.ts:13-16`).
- **Shared cue definitions**, used by both apps (`S/packages/tokens/src/sound.ts:1-60`). The web synthesises them; the phone plays pre-rendered WAVs including the 11-step profit ladder (`S/apps/mobile/src/feedback/trade-sound.ts:1-30`).
- **The reaction engine** ported with the same thresholds (`S/packages/calls/src/reactions.ts:1-8`), with an overlay on both apps.
- **Live cash-out** computed every tick from the contract's own maths (`S/packages/calls/src/quote.ts:201-272`). It mirrors `BandBook._fillClose`.
- **Streaming runtime:** one SSE with tickets and `Last-Event-ID` replay, a 125 ms coalescer, linger, hidden-close and jittered backoff (`S/services/api/src/stream/*`; `S/packages/live/src/sse.ts:7-12,123-137`).
- **⌘K with actions, plus terminal hotkeys.**
  - The palette has Markets, Go to, Everything and Actions groups (`S/apps/web/src/components/shell/CommandPalette.tsx:113-164`).
  - ↑ / ↓ open, C cashes out (`S/apps/web/src/features/terminal/TerminalScreen.tsx:107-124`).
  - Owarine had neither actions nor trade hotkeys.
- **Asset marks** from 57 vendored sources (`S/packages/identity`).
- **On-chain exits:** TP, SL and trail kept by the keeper with the app closed (S8.4; `ExitModal.tsx` / `ExitSheet.tsx`). Like the rest of S8, they go on chain only with the S8.9 deploy.
- **Phone onboarding** with a handle, test dollars, a first live call inside the terminal, one-tap, and a notifications primer (`S/apps/mobile/src/features/setup/setup-order.ts:6`).
- **Working push** on the phone.
- **Receipts** with a transaction timeline and Window proof.
- **Lucky's reel actually tumbles and decelerates** (21st `handle-reel`, `S/apps/web/src/components/ui/slot-reel.tsx:1-6`). That is better motion than Owarine's face swap.

### Behind Owarine — see the take list

The positions book, Trail, levels, candles, picker, tour, replays, music, web palette, games feel and social surfaces.

---

## 6. Take list, ranked by impact on product feel

**Status key:**
- **has** — present at Owarine's level.
- **partial** — some of it is there.
- **missing** — not in Senryo's source.

Port means "carry the logic or behaviour over". Under Senryo's build rules every new UI component is still searched on 21st.dev first; the Owarine file is the behavioural spec.

### A. The trading loop

**1. A live positions book on the terminal — partial**
- **Owarine:** every open position in every market is valued at 5 Hz (`terminal/live.ts:56-113`). The terminal shows:
  - an **Unrealized PnL** card with a rolling odometer and %, counting "N unpriced" instead of 0;
  - **Close all (n)**;
  - an **equity pill** (cash + exit values);
  - expandable rows (add, reduce, exits, share, publish);
  - on phones, a **View-position pill** showing count and ROI that opens a positions sheet (`ui/PositionsPanel.tsx:23-120`; `TerminalScreen.tsx:160,312-344`).
- **Senryo today:** the terminal sees only the call in the current window for the current market (`S/packages/calls/src/use-call-window.ts:31-36`). Its value appears as the pill's second row and the Cash out figure. Home lists open calls. There is no equity, total, Close all, or positions rail or sheet.
- **What to build:**
  - A `useLiveBook` in `@senryo/calls` that runs `quoteClose` on every open ticket at 5 Hz from `live.prices`, replacing the map only when a value changes.
  - On web, the aside: equity pill, Unrealized card, rows, Close all.
  - On the phone, a View-position pill and a positions sheet.

**2. A chart that moves on real ticks — partial**
- **Owarine:** the crypto display line was **Coinbase trades** coalesced to ≤8 Hz (`O/services/ops/src/prices/crypto-spot.ts:1-41`; `http/spot-sse.ts:18-19`). That density is what makes the line and pill "breathe".
- **Senryo today:** the engine is identical, but the feed is Pyth Hermes, about 1 tick/s by Senryo's own note (UNVERIFIED; `S/apps/mobile/src/features/terminal/chart/constants.ts:24-28`; `S/services/api/src/prices/constants.ts:3,20`). τ is stretched to half a second so the line glides rather than steps.
- **What to do:**
  1. Measure the Hermes tick interval per feed on `/v1/stream`.
  2. If it is about 1 s, choose between two options:
     - **(a)** add a display-only exchange trade feed to the api gateway: Coinbase WS ticker, with Owarine's five-venue REST fallback. Coalesce it at 125 ms and label it as display. Pyth stays the source for K, prints, quotes and settlement.
     - **(b)** keep Pyth only and accept the 1 Hz glide.
  - Option (a) means the displayed cash-out can drift from the next-print fill. Owarine accepted this with a 2 % close tolerance.

**3. One-tap TRAIL / CLOSE, with B/E and Trail levels — partial**
- **Owarine:**
  - The buttons cross-fade from UP/DOWN to TRAIL/CLOSE. TRAIL stays greyed with "Need +x% past break-even" until it qualifies, then reads TRAILING while armed (`ui/TradeButtons.tsx:27-94`).
  - B/E is found by bisection (`live.ts:115-156`).
  - B/E is drawn as an amber `[1,3]` line and Trail as a `[6,3]` 1.5 px line (`chart-style.ts:47-52`).
- **Senryo today:**
  - Trail exists only inside the exit modal or sheet (`ExitModal.tsx`, `ExitSheet.tsx`).
  - Chart levels are only line, entry and edge (`S/apps/web/src/features/terminal/chart/constants.ts:77-79`).
  - There is no break-even computation.
- **What to build:**
  - Port the bisection against `quoteClose`.
  - Add the B/E and Trail levels to both chart engines.
  - Add the TRAIL/CLOSE morph to `CallPanel` on both apps, driving the S8.4 `setExit` trail.

**4. Feedback switches, defaults and music — partial**
- **Owarine:**
  - Sound, haptics and reactions are on by default; music is opt-in. Three tracks, plus the tense low-pass at −5 % (`settings.ts:42-45`; `lib/sound/music.ts:5-47`; `useChartFeedback.ts:80-81`).
  - Size defaults to 5 % of available (`settings.ts:115-120`).
- **Senryo today:**
  - Sound and vibration toggles exist on both apps.
  - The phone's **"Live position reactions" switch defaults off and nothing reads it**: it is only set in `S/apps/mobile/src/app/account/preferences.tsx:29,75-81`, and `useReactions.ts` never reads it. Reactions always fire.
  - `S/apps/mobile/src/feedback/movement.ts` is unused.
  - There is no music.
  - Stakes are fixed presets of $1/5/10/25/Max.
- **What to do:**
  - Wire the reactions setting on both apps, default it on to match Owarine and Tradash, and delete `movement.ts`.
  - Port `music.ts` to the web. Render loops offline for the phone, as Owarine's `render-bed.mjs` did.
  - Add the tense filter.
  - Consider a "% of balance" default stake.

**5. One visual system on the web — partial**
- **Owarine:** one palette on web and phone (§3.1): light default, `#FA00FF` as the one action fill, condensed black display type, mode tints, and the 520 ms flood.
- **Senryo today:**
  - The phone is UGLYCASH: black primary, `#FA00FF` accent, light default, Roboto Condensed Black display (`S/apps/mobile/src/theme/native-palette.ts:4-47`; `S/packages/tokens/src/fonts.ts`).
  - The **web is still "Living Lacquer"**: indigo `#414EF4` primary, dark default, Inter only (`S/packages/tokens/src/tokens.css:13-15,248-268,314-334`; `S/apps/web/src/components/shell/theme-provider.tsx:11`).
- **What to do:** move the web to the phone's UGLYCASH tokens and display face, light by default. Decide whether the pink is a fill with a white label (Owarine) or an accent with a black label (Senryo's phone). Add the practice/real mode tint to the shell.

**6. A first-visit five-step tour — partial**
- **Owarine:** the tour opens automatically on the terminal, has drawn illustrations, ends with Try Demo / Take a seat, and can be reopened from Account (`ui/sheets/Tutorial.tsx:52-115`; `tour-copy.ts:4-10`).
- **Senryo today:** the setup flow has a first live call with a coach line on the phone (`S/apps/mobile/src/app/setup/first-call.tsx`). The web setup just links to the terminal. There is no tour on either app, and nothing to reopen.
- **What to do:** port the tour, rewording it for Senryo's calls (Trail → exits). Let Settings reopen it on both apps.

**7. Market picker: categories, Hot, favourites, 24 h change — partial**
- **Owarine:** `ui/sheets/MarketsSheet.tsx:18-27,71-75`, fed by ops `/prices/day`.
- **Senryo today:** the phone's `MarketsSheet.tsx` is 80 lines. The web uses a `MarketList` slide-over. There are no favourites and no 24 h figures (no match in `S/apps/*/src`).
- **What to do:** add `/v1/prices/day`, porting `O/services/ops/src/prices/day-stats.ts`. Add the categories, star favourites and a Hot sort to both pickers.

**8. Candle view with gestures — missing**
- **Owarine:** `chart/candle-view.ts:1-6` and `candles.ts`, with a crossfade between views and haptic detents.
- **Senryo today:** none in the terminal. The data exists: `/v1/prices/candles` (`S/packages/api-client/src/routes/markets.ts:359`).
- **What to do:** port it to the web canvas, and build a Skia equivalent on the phone.

**9. Trade stats and replays — partial**
- **Owarine:** the Account sheet shows Lifetime PnL, Win rate, Trades, Win and Best streak, and Volume. Replayable rows play back at ≤12 s (`AccountSheet.tsx:239-300`; `replay.ts:8-14`; `ReplaySheet.tsx:12`).
- **Senryo today:** the Calls tab has a record row, history and filters. There are no replays (no match).
- **What to do:** port the replay recorder and sheet. Show the record stats on the terminal as well.

**10. Splash, PWA install and the "new version" toast on the web — missing**
- **Owarine:** `components/shell/Splash.tsx:9-37`; `InstallSheet.tsx:29-32`; `useAppUpdate.ts:9-13`.
- **Senryo today:** none in `S/apps/web/src` (grep finds no splash or install prompt).
- **What to do:** port all three. The splash also gates the chart's first frames.

**11. Share: PnL / ROI / Both, with tiered X text — partial**
- **Owarine:** `ui/sheets/PositionSheets.tsx:190-243`.
- **Senryo today:** one 1080×1350 card, sent through the share sheet or downloaded (`S/apps/web/src/features/calls/share-card.ts:1-15`).
- **What to do:** add the figure choice and the X text tiers, and share from an open call as well as a closed one.

### B. Games

**12. The arcade package — partial on web, missing on the phone**
- **Owarine:** the CRT bezel, the m6x11plus pixel font, sprite grids, sparks and trail, impact bursts, shake, combo heat, a grip vignette, synthesised sound effects, a chiptune bed, and a full-screen landscape mode with pause and quit on the phone (§2.2).
- **Senryo today:**
  - **Web:** primitives only — a line and a dot, rounded candles and a circle (`S/apps/web/src/features/games/arcade/draw.ts:52-97`). The only sounds are the shared cues. There is no CRT, pixel font or full screen.
  - **Phone:** no arcade and no Warm-up (`S/apps/mobile/src/features/games/GamesScreen.tsx:14`, `ON_PHONE = {lucky}`). The config lists phone routes that don't exist (`S/packages/config/src/games.ts:33,41,49`).
- **What to do:**
  - Port `ride-draw.ts`, `flap-draw.ts`, `sprites.ts`, `art/PixelArt.tsx`, `arcade-sfx.ts`, `bed.ts`, and the CRT CSS (`stage/stage.css:114-127`) along with the font.
  - On the phone, use **Skia** rather than Owarine's SVG recorder, and pre-render the sounds using Owarine's `render-arcade-sfx.mjs` approach.
  - Add full screen and pause to the web too, fixing Owarine's gap.

**13. Lucky's sound and stop "thunk" — partial**
- **Owarine:** a synthesised spin sweep, a 70 ms ratchet tick, a lock thunk with a bell climb, win and lose stings, staggered stops at 720 / 980 / 1240 ms, a glow and a foot bar, and a result modal with a streak line (`lucky/reel-sfx.ts`; `LuckyReels.tsx:23-27`; `lucky.css:57-70`).
- **Senryo today:** the motion is better (a tumbling reel), but there is no sound design for the reels and no staggered lock.
- **What to do:** keep Senryo's reel. Add the reel sounds and the per-reel haptic tick, stagger the landings, and add the glow and lock-in hold. Add confetti on a win, which Owarine never had.

**14. Games hub meta — missing**
- **Owarine:** the season banner, occupancy counts, the achievements plate, the profile card, "pick up where you left off", interface clicks with randomised detune, and a games settings sheet with effects and music volume, haptics, motion and accent (§2.1; `games/audio.ts:42-48,181-225`; `GameSettingsSheet.tsx`).
- **Senryo today:** plain cards (`S/apps/web/src/features/games/GamesHub.tsx`, 46 lines; `S/apps/mobile/src/features/games/GamesScreen.tsx`, 67 lines). No achievements, seasons or volume controls.
- **What to do:** port the hub sections and the settings sheet. Adding achievements and seasons needs indexer facts; Senryo already has Elo in `DuelRating`.

**15. Duel feel — partial**
- **Owarine:** the queue screen (pixel SEARCHING banner, breathing glow, bouncing dots, band readout), the "vs" lobby with the commitment hash, the swipe-deck physics, the coin → bull/bear card flip, the urgency bar, a tinted result with jingles, and a share PNG (§2.1).
- **Senryo today:** the screens are built on 21st's Swipe Deck and Progress Bar. They are read-only and have not been rendered against a live match (S8.6 note in `S/docs/plan/pivot-s8-social-games.md`).
- **What to do:** after S8.9, add the queue, lobby and result effects and the sounds (Kenney CC0 jingles or our own). Render a full match on both apps.

### C. Social and breadth

**16. Leaderboard and public profiles — missing (S8.1, planned)**
- **Owarine:** a podium with medals, the ranked field, the YouBar, periods and a ticker filter, a terminal sheet with ROI/PnL, and `/u/[address]` (§1.5).
- **Senryo today:** the API and `useLeaderboard` exist (`S/packages/query/src/history.ts:164`), but there is no screen. There is no `/u` route.
- **What to do:** build S8.1 to Owarine's layout. Rows must link to profiles, and both PnL and ROI rankings must be offered, fixing Owarine's two gaps.

**17. Reels: a vertical feed of live windows — missing (not in Senryo's plan)**
- **Owarine:** a vertical snap feed in which only the near cards stream, each with a live chart and Up/Down. It hints "Swipe up for the next market" and gives a haptic per page (`O/web/src/features/markets/reels/ReelsScreen.tsx:31-47`; `O/mobile/src/app/(tabs)/reels/index.tsx:106-124`).
- **What to do:** add it as a Markets mode, or a dock place, on both apps, reusing the terminal's chart at card size.

**18. Activity ticker and per-call publishing — missing (S8.2, planned)**
- **Owarine:** activity kinds and a public feed (`activity/protocol.ts:8-47`); `PublishToggle` (`terminal/ui/PublishToggle.tsx:8-12`).
- **Senryo today:** only `CrowdLine` on the terminal. "Show my calls" is a profile-level setting.
- **What to do:** build S8.2, adding a per-call publish choice on top of the profile default.

**19. Trader Edge report — missing**
- **Owarine:** a curve, four metrics, session-hour bars and a payoff shape (`features/edge/*`).
- **Senryo today:** none.
- **What to do:** port it over the indexer's history.

**20. Takes and Rooms — missing (not planned)**
- **Owarine:** signed takes of ≤240 characters with cashtags; a per-market thread open to holders only (`takes/*`, `room/*`).
- **Senryo today:** none.
- **What to do:** treat it as a later social layer. It pairs naturally with Reels.

**21. Search on the phone — missing on both**
- **Owarine:** on the web at phone width, the More sheet opens the palette. The native app has nothing.
- **Senryo today:** none on the phone.
- **What to do:** add a search field at the top of More that searches markets and destinations.

### What not to copy (Owarine defects found)

**Phone app**
- Trade sounds are wired but never called.
- `DirectionPill` is dead code.
- The `/welcome` tour promises Trail and Close, which the phone doesn't have.
- Push is dead: `easProjectId` is null.
- Universal links are claimed but not configured (`O/mobile/src/app/(tabs)/markets/[id].tsx:16`).

**Games and assets**
- 12 Kenney "games" sounds and the Fluent art ship but are unused in games.
- The arcade palette differs between web and phone.
- The web arcade has no pause and no full screen.
- Lucky has no near-miss and no win confetti.
- Practice's copy says "closing prints" but play is scored on a 30-second spot watch.

**Web**
- There are two toast systems (the app one and the terminal one).
- Leaderboard rows don't link to profiles, and the web board ranks by PnL only.
- Phones have no theme toggle.
- There is leftover Solana faucet code (`useFaucet` "sol").

### Unverified items

- Senryo's Hermes tick interval (row 2).
- The licence of Owarine's ElevenLabs onboarding sounds.
- Which arcade palette Owarine intended.
- Whether Senryo's sonner toasts replace a pending toast by id the way Owarine's terminal toasts do. Senryo shows "Opening Up…" in the panel instead (`S/packages/calls/src/use-call-flow.ts:3,27,64`).
- How everything feels on a real phone. None of the above was played or measured.
