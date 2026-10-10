# 03 — Canton Season 2 (Sotto) and Mitoshi as references for Senryo

Date: 10 Oct 2026. This is read-only research: nothing in any repo was changed except this file. Nothing was run, built or opened in a browser.

## Path prefixes

| Prefix | Absolute path | What it is |
|---|---|---|
| `canton/` | `/Users/abu/dev/hackathon/canton` | **Sotto** (Canton Season 2) |
| `cwf/` | `/Users/abu/dev/hackathon/crypto-world-fair` | **Mitoshi 見通し** (Crypto World's Fair, Tempo) |
| `senryo/` | `/Users/abu/dev/hackathon/metropolis` | Senryo |
| `ugly/` | `/Users/abu/dev/hackathon/owarine-refs/uglycash` | UGLYCASH screenshots |

Citations are `path:line`. I read and cited the Sotto, Mitoshi shell, ⌘K, colour, and Senryo ⌘K and token files myself. Three read-only research sub-agents read Mitoshi pricing, Mitoshi terminal/games/social and Senryo's current state; I spot-checked their key claims against the files:

- Mitoshi's placeholder routes;
- the 正夢/逆夢/無効 stamps;
- the "tense" music;
- Senryo's unused `useLeaderboard` and `trace.ts`;
- Senryo's "Not enough dollars" toast.

Anything else marked *(unverified)* was not checked.

---

## 0. Gaps and caveats

1. **Canton Season 2 is not a trading product.** `canton/` is **Sotto**, a private payroll app on Canton DevNet (`canton/README.md:7-11`). It has no prices, charts, positions, games, leaderboards, social features, ⌘K or mobile app. For those topics this file says "none". What Sotto gives Senryo is restraint, honest money states and receipts, not market UI.
   - The Canton build that does carry Senryo's real-time loop is **Season 3 (Owarine, `../canton-season3`)**. `senryo/docs/plan/pivot-2026-10-08.md:39,52` already calls it "the user's Canton S3 build". If the owner meant Season 3, this study is the wrong one.
2. **Mitoshi has no mobile app code.**
   - The Expo shell is a spec only (`cwf/docs/specs/mobile.md`, stages SM1–SM5). `cwf/docs/plan/STATUS.md:161` lists SM1–SM5 among "stages with no commits yet".
   - Mitoshi on a phone means its responsive web and PWA (`/download`).
3. **Much of Mitoshi is placeholder.** 42 route files render `<PendingRoute>`, a "Not connected yet · waiting on …" card (`cwf/web/src/components/shell/CapabilityPending.tsx:6-19`). These include:
   - leaderboard, profiles (`u/[address]`), reels, strategies, agents and themes;
   - launch, stats, stocks and `portfolio/edge`;
   - trade-from-x and `proof/[market]`;
   - every game except Moonshot and Range.

   Their creative ideas exist only as plan text.
4. **UGLYCASH is screenshots only.** It has 89 JPEGs and no video, sound, fonts or source (`senryo/docs/design/reference-study-2026-10-07-uglycash/README.md:5`). Motion and timing cannot be recovered from it.
5. **I did not see the owner's comment about "the colour".** §4 identifies what the web build uses today. Which colour the owner meant is an inference.

---

## 1. Canton Season 2 — Sotto (`canton/`)

### 1.1 What it is, its routes and navigation

Sotto settles employer-approved monthly net pay atomically on Canton. Each employee sees only their own pay record, and auditors get forward-only scoped access (`canton/README.md:30-49`). The stack is Next.js 16, Tailwind 4, `@react-pdf/renderer`, Upstash Redis, Resend and react-email (`canton/app/package.json`). There is no mobile app; the web is responsive down to 390 px (`canton/.thoughts/design/2026-07-10-product-surface-map.md`, §7).

| Area | Routes (`canton/app/src/app/`) |
|---|---|
| Public | `/` landing, `/start` (email OTP → company → provisioning), `/signin`, `/join` (invite acceptance), and docs under `(documentation)/` (architecture, privacy, how-it-works, glossary …) |
| Employer | `/payroll` workspace, `/payroll/people`, `/payroll/runs`, `/payroll/runs/[runId]`, `/payroll/auditors`, `/payroll/settings` |
| Employee | `/pay`, `/pay/payslip/[runId]`, `/pay/payslip/[runId]/download` (server-rendered PDF) |
| Auditor | `/auditor` |

**Navigation.**
- Desktop has one top bar: wordmark, pill nav (Overview · Pay runs · People (count) · Audit access · Settings), a `DEVNET` pill and an org-initial workspace menu (`canton/app/src/components/top-nav.tsx:10-16,33-89`).
- Below 900 px the pill nav becomes a two-column grid menu (`top-nav.tsx:91-109`).
- The employee shell is deliberately narrow: "Pay and account/sign-out only. No money-action toolbar" (surface map, Global Shells).

### 1.2 Where Sotto is creative in its own way

Sotto is quiet and editorial, and it stays honest about money.

- **"The whisper."** Each surface carries exactly one Newsreader italic line in a muted ink, "never bolded, never iconed" (`canton/app/src/app/globals.css:52-57`; `components/ui.tsx:76-78`). Examples:
  - "This pay record is private to you, your employer, and authorized payroll reviewers." (`app/pay/portal-client.tsx:86-88`)
  - "Confirmation is valid only while the included people, amounts, and audit access remain unchanged." (`app/payroll/review-modal.tsx:96`)
- **"Amounts are the protagonist."** Figures use tabular numerals with two decimals and are never abbreviated (`globals.css:47-50`). The employee hero is a single 34 px amount (`portal-client.tsx:66-70`).
- **One shadow in the whole app**, used only on modals and the org menu (`components/ui.tsx:1-3`).
- **Review before money moves.** The review dialog shows:
  - the exact payees and total;
  - the active audit access;
  - the projected remainder: "Payroll funds after this run: …" (`review-modal.tsx:47-95`).

  If funds are short, the blocker names its own fix inline: an **Add test funds** button sits inside the warning (`review-modal.tsx:79-87`).
- **Atomic settling overlay.** It reads "Settling atomically… One payment, N recipients. The result appears only after the full run is confirmed." (`app/payroll/run-state-panels.tsx:52-82`).
- **Unknown outcome is its own state.**
  - `PAYROLL_STATUS_UNKNOWN`, `RUN_IN_PROGRESS` and `PAYROLL_ALREADY_RAN` render a calm grey `status` panel with **Check status**.
  - Real failures render a red `alert` with **Try again** (`run-state-panels.tsx:8-49`).
  - A stale review fingerprint forces a re-review (`app/payroll/dashboard-client.tsx:66`; README settlement sequence).
- **Receipts are documents.** Each payslip has a printable page and a server-rendered PDF with a Reference and "Paid to date, YYYY" (`app/pay/payslip/[runId]/pdf-document.tsx:106,120`). Emails say the pay arrived without stating the salary (README sequence diagram; `lib/email/templates.tsx`).
- **The landing shows real product.** It uses a sanitized screenshot from a real-ledger fixture, captioned "Product preview · Employer workspace" (`app/_landing/product-preview.tsx`). The surface map forbids "fake terminal output … decorative gradient artwork" (surface map §1).
- **Copy bans are enforced by lint.** `pnpm lint` runs `check-employee-copy.ts` (`canton/app/package.json` scripts). Employee-facing copy may not say wallet, gas, on-chain, party, contract, blockchain or token (`canton/AGENTS.md`, Hard rules).

### 1.3 Real-time pricing

**None.** Freshness comes from `router.refresh()` after each mutation (`app/payroll/dashboard-client.tsx:48,66,69`; `people/people-client.tsx:46,69`). The only `setInterval` is the OTP resend cooldown (`components/otp-code-actions.tsx:25`).

### 1.4 Positions/PnL, trade flow, receipts, games, leaderboards, social

The only money flow is the payroll run described in §1.2. It is **not a trading flow**, and Sotto has no positions or PnL. The parallels for Senryo are review → settle → receipt → unknown/retry, plus the PDF receipt. There are **no** games, leaderboards or social features.

### 1.5 ⌘K

**None.** The only keyboard handling is the dialogs' focus trap and Escape (`components/accessible-dialog.ts:78`; `app/pay/pay-statement-dialog.tsx:39-69`).

### 1.6 Colours, type, mark, motion, sound

- **Colours:**
  - warm paper `#FAF9F7`, surface `#FFFFFF`, ink `#211E1A`;
  - **laurel green `#315C49`** as the single action colour;
  - oxide `#A34A3E` for errors;
  - sidebar `#F5F3EF` (`canton/app/src/app/globals.css:6-30`).
- **Type:** Instrument Sans for UI and Newsreader for the wordmark and whispers (`app/layout.tsx:5-16`; `globals.css:32-34`).
- **Radii** are 8 / 10 / 12 / 16 (`globals.css:36-40`).
- **Mark:** an ink ring around a laurel dot. The wordmark is "sotto" with a laurel full stop (`components/ui.tsx:7-26`; `app/icon.svg`).
- **Motion:** one spinner (`globals.css:59-69`) and colour transitions on hover (`app/page.tsx:10-12`). Nothing else.
- **Sound:** none.

---

## 2. Mitoshi 見通し (`cwf/`)

### 2.1 What it is, its screens and navigation

Mitoshi offers prediction "Windows" on BTC, ETH, SOL and nine US stocks, plus tokenized stocks on Tempo (`cwf/web/src/app/(site)/page.tsx:9-12`).

- **Revamp.** On 8 Oct the owner redirected it: Markets became a Tradash-style terminal at `/trade/[symbol]`, inside a roy-chain/Slush shell, "in Mitoshi's own colours and type" (`cwf/docs/plan/STATUS.md`, "The revamp"; `cwf/docs/plan/decisions.md:1578-1588`, D-189).
- **Hosting.** Testnet runs on Coolify at `testnet.mitoshi.xyz` (STATUS).
- **Phone.** Mobile is web/PWA only (§0).

**Route groups** (`cwf/web/src/app/`):
- `(site)`: landing, how-it-works, proof, status, download, pitch, demo, news, legal.
- `(app)`: trade/[symbol], markets(/[id]), stocks, games/*, parlay, portfolio(/edge), earn, bridge, reserves, themes, launch, leaderboard, u/[address], reels, agents, strategies, surface, stats, activity, settings.
- `(island)`: trade-from-x.
- Placeholder routes are listed in §0.3.

**Navigation (S22 shell, ported into Senryo).** All destinations come from one registry, `cwf/web/src/components/shell/header/nav-items.ts:33-75`.

- **Rail places:** Trade · Markets · Stocks · Games · Portfolio, on keys 1–5. Key 6 opens **Everything** (`nav-items.ts:125`; `Rail.tsx:31-50`).
- **Rail details:**
  - the active pill slides by CSS transform;
  - the key shows on hover;
  - a Testnet pill sits by the mark;
  - money and account sit in the foot.
  - On `/trade`, the Trade place expands a sub-list (Markets · History · Settings drawers) (`Rail.tsx:52-111`).
- **Top line:** Back below top level, then ⌘K / `/` search, the `?` keyboard map and the theme toggle (`TopLine.tsx:40-108`).
- **Phone dock:** Trade · Stocks · Games · Portfolio · Everything; Markets is left out (`nav-items.ts:127-134`).
- **Everything:** a right-edge drawer with a search row, in nine sections (`nav-items.ts:136-146`; `EverythingDrawer.tsx:22-86`).
- **Overlays rule:** right drawers and centred modals only, no bottom sheets. Drawer state lives in `?d=` (`decisions.md:1590-1595`, D-190).
- **Route-coverage contract:** every navigable path must have a nav home (`nav-items.ts:149-156`).

### 2.2 Where Mitoshi is creative in its own way

**On the terminal:**
- Emoji callouts ("🔥 On fire!", "⚠️ Near the line", "🐐 Tripled!") **ride the price head** with spring physics, and the screen edge glows on a surge (`cwf/web/src/features/terminal/feedback/reactions.ts:33-51,127-157`; `ui/ReactionOverlay.tsx:23-83`).
- Music is **sequenced in code** (three tracks: arcade, rush, night). A **"tense" low-pass** kicks in while the position is down 5 % or more (`web/src/lib/sound/music.ts:1-13,195-196`; `features/terminal/useChartFeedback.ts:50-55`).
- A **pentatonic combo ladder** climbs one note per favourable price step (`web/src/lib/sound/trade.ts:49-50,192`).
- A **rolling-digit canvas odometer** carries the price pill and its PnL row (`features/terminal/chart/canvas-odometer.ts:1-4`; `chart-draw.ts:126-147`).
- A **parallax dot grid** drifts with price speed (`chart/dot-grid.ts:2-6`).
- A **見通し watermark** sits on the chart (`chart/chart-draw.ts:66-82`).

**On cards and receipts:**
- The pending call is a **passport-style Call card** with grain, corner ticks, a folio "N° ‹hash6›" and a countdown over a draining bar (`features/markets/calls/CallCard.tsx:51-97`).
- The **receipt is a cream paper stub** with a perforated tear line. It is the app's only light surface and only drop shadow (`components/receipt/Receipt.tsx:21-58`; `ReceiptStub.tsx:6-15`; `cwf/docs/design/DESIGN.md`, Identity table).
- **Kanji verdict stamps:** 正夢 "it came true", 逆夢, 無効 (void) (`features/markets/verdict/VerdictStamp.tsx:16-26`; `cwf/packages/core/src/copy/verdict.ts:13-15`).
- **Confetti** bursts once per win per session, on the stamp (`components/ui/confetti-burst.tsx:2-6`).

**Elsewhere:**
- A **halftone probability band slider** for Range (`components/ui/band-slider.tsx:1-10`).
- Parlay legs **fly in an arc into the slip** (`components/ui/fly-to-target.ts:2-7`).
- The **Surface** table lists every Window with sparklines, book versus fair model, and an expandable depth chart (`features/surface/SurfaceScreen.tsx:2-8`).
- The **Word board** asks the same Windows as plain Yes/No questions (`features/markets/word-board/WordMarketBoard.tsx:2-7`).
- The markets drawer has a "Hot 🔥" movers tab (`features/terminal/ui/MarketsDrawer.tsx:23-24,70`).
- A **replay drawer** replays a trade in 12 s or less (`ui/ReplayDrawer.tsx:14`).
- Calls can be scheduled before a Window opens (`ui/ScheduledTrade.tsx:1-4`).
- A five-step tour server-renders its first step (`ui/TourStep.tsx:1-4`).

**Honesty grammar:**
- Every failure says whether money moved, e.g. "Nothing was taken." (`features/terminal/copy.ts:98`).
- An unknown result reads "Waiting for the chain … nothing is re-sent" (`copy.ts:94-95`).
- The live ticker shows "waiting" rather than invented numbers (`components/shell/Marquee.tsx:12-20`).

### 2.3 Real-time pricing

Mitoshi runs **two separate pipelines**:

- **Settlement:** trades settle on signed RedStone values on a 10 s grid.
- **Display:** the chart line runs on a display feed of exchange trades at up to 8 Hz per ticker.

Both reach the browser over **one shared SSE connection** from the ops service. Decisions: D-049 (`cwf/docs/plan/decisions.md:285-289`) and D-196 (`decisions.md:1632-1643`).

| Concern | Mitoshi (all `cwf/`) |
|---|---|
| Settlement source | RedStone `latest` every 10 s, including a `-24` key for the 24/7 feed (`services/ops/src/prices/spot.ts:45,51-58,79-109`); signed packages archived every 5 min (`actors/archive/redstone.ts:2-6,30-41`); Chainlink Data Streams only on mainnet with credentials, otherwise `null` — "never a mock" (`packages/markets/src/prices/datastreams.ts:7-8`) |
| Display source | Crypto: Coinbase WS `ticker`; if a symbol is quiet 5 s, the median of 5 venues over REST, polled ≤ every 3 s (`services/ops/src/display/crypto-spot.ts:24-28,85-127`; `crypto-rest.ts:5-7`). Stocks: Alpaca IEX every 1.5 s, 04:00–20:00 ET (`alpaca-trades.ts:21-23`). Any fast source silent 15 s hands over to RedStone (`display/feed.ts:13,52-59`) |
| Transport | SSE read through `fetch` (not `EventSource`), one lazy singleton per page (`packages/markets/src/runtime/sse.ts:2-4`; `stream-hub.ts:1-5,65-87`). Topics are ref-counted; a topic change reconnects after a 50 ms debounce with replay (`stream.ts:170-182`). All display prices share one `ticks` topic, so switching markets never reconnects (`ops display/publish.ts:2-6`) |
| Cadence | Ops coalesces per ticker every 125 ms, ≤ 8 Hz (`publish.ts:13`). The client batches per animation frame (`frame-batch.ts:5-23`). React commits ≤ 5 Hz (`web/src/features/terminal/live.ts:12,54-65`) |
| Auth | 60 s HMAC stream ticket, rate-limited 60/min/IP (`web/src/app/api/stream/ticket/route.ts:16-20`). On a 401 the client drops to public topics and retries after 60 s (`stream.ts:70,125-131`) |
| Reconnect | Backoff `min(30 s, retry·2^n)` (`stream.ts:80,146,159`). A 5,000-event replay ring, but `ticks` are not replayed: a reconnect sends a snapshot (`ops runtime/bus.ts:2-36`; `http/stream.ts:17-18,73-76`). Ping every 15 s (`http/stream.ts:12,61,79`) |
| Hidden tab | The stream closes and reconnects with replay, except while a trailing stop is armed (`stream-hub.ts:29-63`; `TerminalScreen.tsx:174-176`). *(Unverified risk: batches go through `requestAnimationFrame`, which browsers pause in hidden tabs.)* |
| Stale | > 20 s for fast sources and > 45 s for RedStone, rechecked every 5 s. The UI says "Connecting…" / "Reconnecting…" (`live-ticks.ts:24-26`; `live.ts:19,68`). There is no `navigator.onLine` handling |
| Chart | Custom two-canvas engine; lightweight-charts was dropped in D-199 (`decisions.md:1664-1669`). A 600-sample ring on a fixed 60 Hz clock, eased about 84 ms toward the latest price (`chart/engine.ts:12-28`). Catmull-Rom line with glow; the left 32 % fades (`chart-engine.ts:187-222`). About 10 s visible, **no time axis**. Overlays: the Window's opening "Line", **"Signed"** (the latest RedStone value, which is what settles), Entry, Trail, B/E, TP, SL, KO, and the Range band; off-screen levels become edge tags (`useTerminalState.ts:91-96`; `chart-draw.ts:96-111`). A 300-candle view with pinch, pan and a snapping crosshair (`candle-view.ts:221-329`) |

### 2.4 Trade/terminal flow, live positions and PnL, receipts, games, leaderboards, social

**Terminal flow** (`cwf/web/src/features/terminal/`):
- **Layout.** The canvas fills the stage. Glass chips float on top: mark, asset, equity pill, Window chip, settings. On desktop a 320 px side panel holds the Unrealized card, the positions list, mode chips and the buttons (`TerminalScreen.tsx:207-275`).
- **Buttons.** **UP/DOWN** ("pays N×") turn into **TRAIL/CLOSE** with a 180 ms CSS swap (`ui/TradeButtons.tsx:7-73`). A blocked button can still be tapped; a toast says why (`ui/TradeButtons.tsx:9-10`).
- **Tap.** A tap shows an "Opening Up BTC…" toast and calls `bet.place` (`useTerminalOpen.ts:118-138`). This is not optimistic: the row appears from the receipt's exact figures before the indexer catches up (`fresh-fills.ts:2-7,41-61`).
- **Amount.** A Size field with Min/25%/50%/Max chips and "Follow 5 %". A thin book caps the tap at "max $X" (`ui/SettingsDrawer.tsx:27-63`; `useTerminalOpen.ts:63-66`).
- **Boost chips** run up to the reserve's live maximum (`SettingsDrawer.tsx:100-118`).
- **TP/SL drawer.** Tabs for ROI % / Change % / P&L, with presets. The exit can run with the app closed through an exit keeper (`ui/ExitsDrawer.tsx:1-70`).
- **Modes:** Up/Down · Range · Boost · Private · Parlay. In Parlay mode, UP/DOWN add the Window as a leg (`ui/ModePanel.tsx:21-33`; `ui/ParlayMode.tsx:1-40`).
- **Settle toasts.** One app-wide toast per Window, in two phases: "Paying…" then "Paid $X" (`features/markets/calls/SettledToasts.tsx:3-8,57-70`).

**Live positions and PnL:**
- **On the chart.** The price pill gains a PnL row, the line turns the down colour while losing, and a gradient PnL band fills between the line and the entry. PnL is defined as "what Close pays now" (`chart/chart-engine.ts:152-201`; `TerminalScreen.tsx:128-143`).
- **Position rows.** Value, PnL and ROI%, with "≈" while repricing and a per-row CLOSE. Locked rows say "Locked — pays at T". There is also **Close all** (`ui/PositionsPanel.tsx:37-55`; `TerminalScreen.tsx:119-126`).
- **Portfolio.** The page has:
  - a Collect plate;
  - the Trading Balance ledger;
  - bets with **one-tap cash-out** at the fresh floor less tolerance, which becomes "Close for $X" if the price moved;
  - a WIN/LOSS/VOID journal (`features/markets/portfolio/SignedInPortfolio.tsx:67-79`; `BetRow.tsx:26-66`; `BetsPanel.tsx:38-55`).
- **Account drawer.** A P&L curve with 24H/7D/30D/All (`ui/PnlCard.tsx:2-7`).

**Receipts and share:**
- The paper stub and verdict stamp are described in §2.2.
- `ProofLink` never shows a caption without a working link (`components/receipt/ProofLink.tsx`).
- **Share cards are not built.** The CSS points at a `features/share/canvas.ts` that does not exist (`web/src/styles/share-card.css:1-11`).

**Games:**
- Live: **Moonshot** (pick a reach of ×2…×25) and **Range** (the band slider).
- Pending, as plan text only (`lib/capabilities.ts:38-48`; `docs/plan/stage-12-games.md:5-23`): Practice, Duel, Lucky, Line Rider, Candle Hop, Rank, History.
- Streak framing exists in Parlay ("Build the streak") and in the history grid (Win streak, Best streak) (`features/parlay/copy.ts:10-11`; `ui/HistoryView.tsx:43-50`).
- There is no XP or season system in code.

**Leaderboard and social:** all placeholders (`lib/capabilities.ts:21,49-56`). S13 plans takes with Tail/Fade, rooms and the Sensei assistant; none is built.

### 2.5 ⌘K

`cwf/web/src/components/ui/command-palette.tsx` (82 lines) and `styles/command.css` (23 lines).

- **Built from:** 21st.dev 31354 (wensity/command), rebuilt on Base UI `Autocomplete` (inline, `mode="none"`) inside a centred Base UI `Dialog`. It is lazy-loaded on first open (`command-palette.tsx:3-6`; `TopLine.tsx:20,105`).
- **What it searches:** **navigation only.** The groups are "Go to" (the rail places) plus every Everything section (`command-palette.tsx:17-20`).
  - Matching is a substring over name, description and `keywords` (`nav-items.ts:171-176`).
  - Selecting an item routes there or opens an external link (`command-palette.tsx:29-34`).
- **Missing:** no markets, live prices, actions, recents, people or positions.
- **Keyboard:**
  - ⌘K / Ctrl-K toggles it; `/` opens it; `?` opens the keyboard map (`TopLine.tsx:44-62`).
  - ↑↓ and Enter, with a **footer of key hints** (↵ Open · ↑↓ Move · esc Close) (`command-palette.tsx:71-73`).
  - The highlighted row's icon turns vermilion (`command.css:16`).
  - Rows are ≥ 44 px and the input is 16 px (`command.css:9,13`).
  - Reduced motion is respected (`command.css:23`).
  - Single-key shortcuts are blocked while typing or inside a dialog (`Rail.tsx:23-29`).
- **Safety rule:** "No hotkey moves money" (`cwf/docs/plan/revamp-parity.md`, RV-09).

### 2.6 Colours, type, mark, motion, sound

**Colours** (`cwf/packages/tokens/src/tokens.json:3-22`; `cwf/docs/design/DESIGN.md`, Identity):
- **Dark is the default**, on ground `#050505`, with neutral gray surfaces `#171717` / `#262626` / `#404040`.
- **Vermilion `#E04D26` is "the only brand colour"** (pressed `#B83A1B`).
- Profit `#34D399` and loss `#FB7185` are for direction only.
- The light theme is a warm cream ramp (`#F4EEE3`).
- The receipt island is cream `#F4EEE3` on ink `#141210`.
- The owner kept these colours through the revamp (D-189).

**Type:**
- Sora for headings, Inter for body, **JetBrains Mono for every figure**, and **Noto Serif JP for verdict stamps** (`cwf/web/src/lib/fonts.ts:10-21`; tokens.json `fonts`).
- Fonts load lazily, and the hero reserves Sora's line count so the font swap moves nothing (`(site)/page.tsx:20`).

**Mark:**
- 見通し, "the view ahead": a horizon line, a path rising over it, and **exactly one vermilion dot** (`components/shell/MitoshiMark.tsx:1-14`).
- Film grain over the app (`GrainOverlay.tsx`), dropped on coarse pointers.

**Motion:**
- `motion` only inside per-island LazyMotion scopes (`components/motion-scope.tsx:3-21`).
- `@number-flow/react` for the price, equity and ROI digits (`features/terminal/ui/Chrome.tsx:26`).
- The drawer moves in 380 ms on `cubic-bezier(.32,.72,0,1)` and out in 240 ms (`DESIGN.md`, Layout).

**Sound and haptics:**
- All sound is synthesised with Web Audio; no audio files ship. There are six cues plus surge, slump and adverse (`lib/sound/trade.ts:1-47,204`), and the music described in §2.2.
- One "Sound & Vibration" setting covers sound, haptics, reactions and music, with music off by default (`lib/feedback.ts:2-106`).
- iOS has no vibrate API, so haptics click a hidden `<input switch>` (`lib/haptics.ts:2-44`).

---

## 3. ⌘K: Mitoshi vs Senryo

The owner says Senryo's palette "is good but can be better". It is already richer than Mitoshi's. Mitoshi's is navigation only; Senryo's also covers live markets and actions.

Senryo's palette: `senryo/apps/web/src/components/shell/CommandPalette.tsx` (224 lines) and `senryo/apps/web/src/styles/command.css` (133 lines).

| Capability | Mitoshi | Senryo today | Evidence (Senryo) |
|---|---|---|---|
| Engine | Base UI Autocomplete in a Dialog | `cmdk` in a Radix Dialog (21st.dev 382 originui/command), lazy-loaded | `CommandPalette.tsx:2-12`; `TopLine.tsx:19` |
| Open with | ⌘K, `/` | ⌘K, `/`; `?` opens the keyboard map | `TopLine.tsx:46-64`; `ShortcutsModal.tsx:7-17` |
| Markets with live price and countdown | — | Yes: the real mark, the streamed price, and the **1-minute lane only** ("closes in / reopens in") | `CommandPalette.tsx:54-73` (`FIRST_CADENCE`, line 23) |
| Places and Everything | Yes | Yes | `:124-163` |
| Actions | — | Hide/show balances, sounds, vibration, theme | `:164-217` |
| Search semantics | Substring over name, description, keywords | Every typed word must appear (no scattered-letter fuzz) | `:25-34` |
| Footer key hints | Yes (↵ ↑↓ esc) | **No.** Only an `esc` kbd in the input | `:105-109` |
| Digit shortcuts shown on Go-to rows | No (Owarine shows them) | **No** | — |
| Recents / empty-query suggestions | No | **No.** An empty query lists everything | — |
| Your open calls / cash out | No | **No** | — |
| Events, Duel lobbies, Parlay picks | No | **No market group for these.** Only their Everything pages | `:112-123` |
| People / handles | No | **No.** Planned: "⌘K for markets, people and actions" | `senryo/docs/plan/pivot-2026-10-08.md:657` |
| "deposit" / "add money" | — | **Returns nothing.** The Receive item has no `deposit` keyword, though the plan lists "⌘K 'deposit'" as an entry point | `senryo/packages/config/src/nav.ts:186-192`; `pivot-2026-10-08.md:531` |
| Ticket id or tx hash lookup | No | **No** | — |
| Phone equivalent | No (no app) | **No global search screen on the phone.** UGLYCASH U10 is the model | `ugly/Searching/*`; flows.md U10 |
| Hotkeys that move money | Forbidden (RV-09) | ↑/↓ call Up/Down and `C` cashes out on Trade | `ShortcutsModal.tsx:12-14`; `apps/web/src/features/terminal/TerminalScreen.tsx:107-124` (via agent) |

---

## 4. UGLYCASH — what it contributes, and whether Senryo's colours follow it

**What it is.** `ugly/` holds 16 flows and 89 phone screenshots. The approved study is `senryo/docs/design/reference-study-2026-10-07-uglycash/` and the plan is `senryo/docs/plan/uglycash-revamp-2026-10-07.md`. The plan names the order of authority: "Latest instruction > supplied native pixels > actual Senryo capability…" (`:33`).

**What UGLYCASH contributes to Senryo:**
- **Colour.** A light `#F5F5F5` canvas, white `#FFFFFF` cards, `#ECECEC` inputs, black primary actions and a **vivid magenta `#FA00FF`**. Magenta is only for trade, publish and selected controls and limited glow. "Never use magenta to mean a profitable trade." Green and red are reserved for direction (`uglycash-revamp-2026-10-07.md:59-76`).
- **Scenes.**
  - Blue-sky scenes for onboarding, profile and success.
  - A textured monochrome **Send** workspace.
  - A black account header over the Home balance card.
- **Type.** Condensed display type for headings and money. The exact source font is unknown (`:78`).
- **Flows.**
  - Face ID primer, then the iOS permission (U14-S17/S18).
  - The Display Balance privacy sheet (U04).
  - The trade card share and the profile link as separate artifacts (U05, U13).
  - **Trading-clubs leaderboard** with category and period pills (U07).
  - Follow (U08), grouped search across Tokens, Prediction Markets and Users (U10).
  - **Trade thesis** with a magenta Post button (U16).
  - Buy/Sell holding drawer with chart and Share (U01).
  - All are listed in `reference-study-2026-10-07-uglycash/flows.md`.
- **Accessibility.** Magenta behind small text needs **black** text (6.51:1); white is 3.23:1 (`README.md`, Important findings).

**What Senryo uses today:**

| Surface | Source | Default theme | Ground / card | Primary action | Accent | Up / Down | Display face |
|---|---|---|---|---|---|---|---|
| **Phone** | `senryo/apps/mobile/src/theme/native-palette.ts:3-104` ("UGLYCASH native evidence U04/U14/U16. Kept separate from the web's historical palette") | **Light** (`theme/index.tsx:28`; splash and background use `NATIVE_LIGHT`, `app.config.ts:36,53,74`) | `#F5F5F5` / `#FFFFFF` (dark option `#111111` / `#1C1C1C`) | `#000000` (dark: `#F5F5F5`) | `#FA00FF` (ring, action, glow `#FA00FF66`) | Inherited from the shared palette: `#087F3C` / `#C83225` light, `#25CF68` / `#FF5A48` dark | Roboto Condensed Black (a declared stand-in) + Inter / Inter Display + Noto Sans JP (`theme/fonts.ts:11-21`) |
| **Web** | `senryo/packages/tokens/src/palette.ts:90-155` "Living Lacquer" via `tokens.css`, mapped in `apps/web/src/app/globals.css:3,9-92` | **Dark**, no system follow (`apps/web/src/components/shell/theme-provider.tsx:11-13`) | **`#0A0911`** (violet-black) / `#13121A`, sheets `#191822` | **`#414EF4` indigo** | **`#8B95FF` periwinkle** (accent fg, ring, link, chart 1, mainnet), **`#B69DF8` lavender** (practice, chart 2), fan `#C3B5F6` | `#25CF68` / `#FF5A48` | Inter only (`globals.css:10-13,106`) |
| Brand seal (web) | Gold-leaf 千 seal (`packages/identity`, `senryo-seal`) | — | — | Sits on an **indigo disc with an indigo glow** in the rail, top line and dock (`apps/web/src/styles/app-shell.css:97-107`; `shell-parts.css:193-203`) | — | — | — |

**Verdict.**
- **The phone follows UGLYCASH. The web does not.**
- The web still ships the dark-default Living Lacquer palette with indigo/violet action styling. The approved UGLYCASH plan explicitly **supersedes** "the dark-default Living Lacquer palette, violet/blue general action styling" (`uglycash-revamp-2026-10-07.md:33`).
- The plan put the web in "slice 8 — companion and delivery" (`:236`) and warned that shared-token changes must not "silently recolor" the unfinished website (`:242`). That is why the phone was forked into its own palette file rather than changing the shared tokens.
- **Probably "the colour" the owner disliked** on the web dev build (*inference*): the indigo `#414EF4` buttons and glowing seal disc on a violet-black ground, with periwinkle/lavender accents. None of the four references uses it.

**Compared with the references:**
- **Sotto:** warm paper with one green.
- **Mitoshi:** near-black with one vermilion.
- **UGLYCASH:** light gray with black and one magenta.

What all three share is **neutral grounds plus exactly one saturated brand colour**. Senryo's web has a tinted ground and three related blue/violet accents.

---

## 5. Senryo today, in brief (context for the take list)

From the Senryo sub-agent's audit (cited paths are under `senryo/`); status is from `docs/plan/STATUS.md:23,45-63` and `docs/plan/pivot-s8-social-games.md`.

- **Prices.**
  - Pyth Hermes SSE with a watchdog, jittered backoff and rotation (`services/api/src/prices/hermes.ts:93-153`), plus RedStone on a 10 s grid.
  - One SSE per app (`services/api/src/stream/route.ts:7-105`); the client backs off from 3 s to 30 s with jitter (`packages/live/src/sse.ts:7-16`).
  - Stale after 5 s with no tick (`packages/live/src/prices.ts:10,80-84`).
  - The line runs at Pyth's cadence, which is at most once a second on the Starter plan (`docs/plan/pivot-2026-10-08.md`, "Pyth key economics").
- **Charts.**
  - Web: Owarine's two-canvas engine, a 600-sample ring at 60 Hz, with an odometer pill (`apps/web/src/features/terminal/chart/*`).
  - Phone: Skia + Reanimated.
  - A countdown ring (`CountdownRing.tsx`).
- **Call flow.**
  - Shared `useCallFlow` with no confirmation step (`packages/calls/src/use-call.ts:1-4`). Pending is React state only; the intent states are `received…filled/refused/failed`.
  - **No unknown/recovered state.** `packages/query/src/trace.ts` holds that logic but nothing imports it.
  - Shortfall shows a toast only: "Not enough dollars · You have $X" (`packages/calls/src/use-call-flow.ts:133-138`).
- **PnL.**
  - On the terminal only. Lists say "pays $X" (`packages/calls/src/use-call-rows.ts:47-48`).
  - **No portfolio screen.**
  - Cash out is available: 25/50 % on the web, long-press on the phone.
- **Games and social.**
  - Lucky, Warm-up, Line Rider and Candle Hop on the web; Lucky only on the phone. All of this is WIP (`b61d1932`).
  - Duel, Parlay and Events are not on chain.
  - **The leaderboard API exists, but `useLeaderboard` (`packages/query/src/history.ts`) is used by no screen.**
  - No profiles.
  - Share cards exist as a 1080×1350 PNG with QR.
- **Juice.**
  - Synthesised Web Audio cues and a profit ladder.
  - Reactions that ride the price head (`apps/web/src/features/terminal/ReactionOverlay.tsx:4-6`).
  - Confetti, the iOS-switch haptic trick, and `@number-flow`.
  - **No music.**

---

## 6. Take list for Senryo, ranked by impact

| # | Idea (source) | Senryo today (evidence) | Adopt |
|---|---|---|---|
| 1 | **Neutral ground plus one brand colour.** UGLYCASH lock (`uglycash-revamp-2026-10-07.md:59-76`); Mitoshi "the only brand colour" (`cwf/docs/design/DESIGN.md`); Sotto's single laurel | Web on Living Lacquer: `#0A0911` ground, `#414EF4` primary, `#8B95FF` / `#B69DF8` accents, indigo-glow seal disc (`packages/tokens/src/palette.ts:90-155`; `app-shell.css:97-107`; `shell-parts.css:193-203`). The phone already uses the UGLYCASH palette (`apps/mobile/src/theme/native-palette.ts`) | Move `NATIVE_LIGHT` / `NATIVE_DARK` into `@senryo/tokens` as **the** palette and emit them for the web. Black primary; `#FA00FF` only for trade, selected and publish controls, with black text on it; green/red only for direction; black seal disc with no coloured glow. Delete the Living Lacquer action roles in the same stage (one implementation per capability). Bring a condensed display face to the web for headings and money. **Owner choice:** web default light (UGLYCASH) or dark (`#111111` adaptation); the terminal could stay dark full-bleed as Mitoshi's does |
| 2 | **Unknown and recovered outcomes as first-class states.** Sotto: a "Check status" status panel versus a "Try again" alert (`canton/app/src/app/payroll/run-state-panels.tsx:8-49`). Mitoshi: "Waiting for the chain … nothing is re-sent" (`cwf/.../terminal/copy.ts:94-95`) | Pending lives in React state and a reload loses it. `trace.ts` (unknown/TxRecovery) is unused. The failure copy is already honest ("Your stake was not taken.", `use-call-flow.ts:84`) | Persist the pending intent (journal). Add `unknown → checking → recovered (filled / refused)` with Check-status, never re-sending. Same on the phone. Then wire or delete `trace.ts` |
| 3 | **⌘K: "good but can be better".** Mitoshi footer hints (`command-palette.tsx:71-73`); Owarine digit shortcuts and Events group (`../owarine/web/src/components/shell/app/CommandPalette.tsx:92-131`); UGLYCASH grouped search (U10) | See §3: 1-minute lane only; no recents, open calls, people, events, footer hints or tx lookup; "deposit" finds nothing | In order: (a) an **empty-query view** of Recents, Your open calls and Hot movers; (b) an **open-calls group** with a live cash-out value and countdown — select opens the call on the terminal with the Cash-out modal ready, never executing directly (Mitoshi RV-09); (c) market rows with **all lanes** and a sparkline, and a nested cmdk page per market (Up / Down / lanes / proof); (d) **Events, Duel, Parlay** groups; (e) `deposit` / `add money` / `fund` keywords; (f) paste a **call id or tx hash** to open the receipt; (g) a footer of key hints and digit shortcuts on Go-to rows; (h) **people / @handles** once profiles land; (i) a phone search screen with the same groups (UGLYCASH U10) |
| 4 | **Live positions everywhere, with one-tap cash-out.** Mitoshi `PositionsPanel` (per-row CLOSE, Close all, "Locked — pays at T") and Portfolio `BetRow` (cash out at fresh floor, else "Close for $X") (`cwf/.../ui/PositionsPanel.tsx:37-55`; `portfolio/BetRow.tsx:26-66`) | Live PnL only on the terminal; Home/Calls say "pays $X" (`use-call-rows.ts:47-48`); no portfolio | Open-call rows on Home and Calls (and the phone tabs) tick their **live cash-out value and PnL** from the shared live store, with a Cash-out action and Locked/Settled/Void row states |
| 5 | **The blocker names its fix.** Sotto's inline "Add test funds" inside the shortfall warning, plus the projected remainder (`review-modal.tsx:79-95`) | "Not enough dollars · You have $X" as a toast only (`use-call-flow.ts:133-138`), though the plan promises "a sheet with the shortfall pre-filled" (`pivot-2026-10-08.md:529`) | Shortfall opens Add money / Test dollars with the shortfall pre-filled; the panel shows "after this call: $Y" |
| 6 | **A display feed separate from the settlement feed.** Mitoshi D-196: exchange trades at ≤ 8 Hz for the line, a 5-venue median fallback, a 15 s handover to the signed source, and a **"Signed" marker** on the chart (`cwf/services/ops/src/display/*`; `useTerminalState.ts:91-94`) | The line rides Pyth at ≤ 1 Hz (Starter) and is eased (`packages/live`; pivot plan, "Pyth key economics") | Add a display source (Coinbase WS ticker, then a REST venue median, then Pyth) on its own topic, never used for settlement, and draw the Pyth print that settles as a separate "Signed" marker. Keep Senryo's stricter 5 s stale rule for the trade button. Avoid Mitoshi's rAF-in-hidden-tab risk. *(Check provider terms before shipping.)* |
| 7 | **Leaderboard surface.** UGLYCASH U07 (category and 24h/7d/30d/all pills, medals, aligned P&L); Mitoshi has only a placeholder | API route exists (`services/api/src/routes/history.ts:91-93`); `useLeaderboard` is unused; no rail place, although the plan lists Leaderboard (`pivot-2026-10-08.md:241`) | Build the board on both apps: Practice and Real kept separate, with period and category pills. Add a Leaderboard place to the web rail (or Everything) |
| 8 | **The receipt as an artifact with a stamp.** Mitoshi's cream perforated stub and kanji verdict stamp (`components/receipt/Receipt.tsx:21-58`; `VerdictStamp.tsx:16-26`); Sotto's PDF payslip with a Reference | Receipts are a timeline plus window proof (`apps/web/src/features/calls/CallReceipt.tsx`, `CallTimeline.tsx`, `WindowProof.tsx`) | A Senryo receipt "slip" in its own identity: a gold-leaf hanko-style result stamp from the existing Kinpaku materials (`packages/tokens/src/marks.ts:8-27`), the one shadow in the app, the folio number and proof link. Downloadable PDF/PNG. Owner picks the stamp words |
| 9 | **Pending call as an object.** Mitoshi's passport-style Call card: folio "N° ‹hash›", grain, corner ticks, a draining countdown bar (`CallCard.tsx:51-97`) | "Signing…" / "Opening Up…" button text (`use-call-flow.ts:141-151`) | A pending card that becomes the receipt slip (#8) in place |
| 10 | **Music with a mood.** Mitoshi's code-sequenced tracks, a "tense" low-pass while losing ≥ 5 %, and animated EQ bars on the toggle (`lib/sound/music.ts:1-13,195-196`; `ui/ChartControls.tsx:74-83`) | No music; cues and ladder exist (`packages/tokens/src/sound.ts`) | Optional music in the terminal, off by default, under the existing Sound & Vibration setting; the tense filter is driven by live PnL |
| 11 | **Privacy reaches every surface.** Mitoshi RV-10 masks balances and PnL in pills, canvas and toasts, and disables share while masked | `usePrivacy` is read by Home, Calls, TerminalTop, chips and drawers, but not by `ShareCallButton.tsx` or `ResultHost.tsx` | Mask result toasts and block or blur share cards while balances are hidden |
| 12 | **Keyboard safety.** Mitoshi: "no hotkey moves money" (RV-09) | ↑/↓ place calls and `C` cashes out (`ShortcutsModal.tsx:12-14`) | Keep them in Practice; in Real, require a hold or second press (or the one-tap opt-in) before a hotkey moves money. **Owner choice** |
| 13 | **Discovery surfaces.** Mitoshi's Hot 🔥 movers, Surface table with sparklines and depth, the plain-words Word board, scheduled calls, and the ≤ 12 s replay drawer | Markets list plus terminal; no movers, replay or scheduled calls (*not exhaustively checked*) | Hot movers in the markets drawer and ⌘K; replay of a settled call from its receipt (it also suits share video) |
| 14 | **Editorial restraint.** Sotto's one "whisper" line per surface, amounts as protagonist, one shadow, and a landing that shows a real product capture (`globals.css:47-57`; `product-preview.tsx`) | Landing has a live BTC line (`apps/web/src/features/landing/LiveHero.tsx`) | One quiet sentence per surface (privacy, settlement source, "nothing was taken"); no decorative art in operational screens |
| 15 | **Honest ticker.** Mitoshi's Marquee shows "waiting" until a real price arrives (`Marquee.tsx:12-20`); the proof tagline "Don't trust it. Click it." | Health chip "Live / Connecting" (`apps/web/src/components/shell/chips.tsx:73-88`); none on the phone | A phone live-health indicator; a ticker only if it never invents numbers |

**Not worth taking:**
- Sotto's top-bar-only navigation: the Mitoshi rail is already in Senryo and the owner liked it.
- Mitoshi's Sora + JetBrains Mono faces: Senryo's identity is UGLYCASH condensed + Inter.
- Mitoshi's placeholder social, games and leaderboard routes: there is nothing built to copy.
- Mitoshi's "no bottom sheets" rule on the phone: Senryo's phone keeps sheets because UGLYCASH is built on them (`pivot-2026-10-08.md:261`).
