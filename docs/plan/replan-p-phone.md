# P — The phone's surfaces, rebuilt (replan stage; added 12 Oct after the owner's phone review)

## Context

**Status:** planned 12 Oct; research in `docs/research/review-2026-10-12/`. Plan mode was switched off by the
owner before an approval prompt; the plan was written down first and building follows it step by step.

The owner reviewed the phone and called five surfaces bad:
- **Parlay:** "even worse" — a long list of grey Up / Down pills, "calls reopen in…" on every row, no prices, no odds,
  no slip in sight.
- **Duel:** "why is it like Warm-up… design it better" — a radio-button form of tiers, then the same swipe deck as
  Warm-up.
- **Earn:** "why is the input showing" — a bare "$ 0.00" input under a guest's screen, six rows of 0.000 %.
- **Status:** "mid" — rows that say "Working".
- **The terminal's market sheet:** it opens low, the dock draws over it, it can't be dragged taller, and the ticket stays
  live above it.

They added: "I hate the phone… go beyond what I mention… use 21st… be creative".

Research is in `docs/research/review-2026-10-12/` (`00-synthesis.md`):
- Owarine;
- Mitoshi, Canton S2 and Tradash;
- Codex at xhigh, with screenshots;
- 21st.dev candidates.

**Root causes:**
- **Shared sheet:** the phone's `Sheet` has no host above the tab shell, so inline sheets render under the dock
  (`app/(tabs)/_layout.tsx` paints `<Dock/>` after `<TabSlot/>`).
- **Flex layout:** inline sheets are flex siblings of the terminal's column (`TerminalScreen.tsx`), so they push the
  ticket up instead of covering it.
- **Height:** there are no detents; every sheet uses max 0.9 content-sized.
- **The four screens:** they were ported as forms and lists.

**Outcome:** each surface becomes an instrument. Parlay builds a chain; Duel stages a confrontation; Earn shows
ownership; Status proves health; the market sheet takes over the terminal. Phone first, the web sharing the same logic
and hierarchy.

## Order

**P1 → P2 → P3 → P4 → P5 → P6 → P7.** It folds in:
- R7.10 (Parlay fly-to-slip) → P3;
- R7.8's leftovers → P4;
- R7.7's meta (N playing, ladder) → P4.

Afterwards the replan continues: R5 → R6 → R8 → R9.

**Each step:**
- `pnpm gate` exit 0, a commit;
- deploys (web / api via Coolify, phone OTA);
- one Release simulator pass per merged area, plus web checks with the preview tools;
- a STATUS line.

## Decisions (D-321 … D-326)

- **D-321 Sheets have a root host and detents (phone).** Our own `Sheet` engine stays (keyboard, a11y and reduced motion
  already work; all three references hand-roll theirs; no new dependency):
  - inline sheets render through a root `SheetHost` above the tabs and the dock (the root-host pattern of
    `app/_layout.tsx:98-107`);
  - the dock hides while any sheet is open (`dock-context` `hide/show`);
  - optional detents: `[0.62, 0.88, 1.0]` of the space under the top safe area; the drag moves between them; content
    scrolls only at the top detent; the drag hands off only at the list's top;
  - existing callers keep content-sizing.
- **D-322 Duel picks on three market lanes; Warm-up keeps the swipe deck.** Both seats stay on screen through every
  phase.
- **D-323 The "Free" duel tier is "No pot"**, with its commitment spelled out (`3 × $10 calls = $30 · no pot`).
- **D-324 Status history is recorded by the api:**
  - a `health_snapshots` table (one row a minute per component, 90-day retention);
  - `GET /v1/status/history` serves 24 hourly and 90 daily buckets;
  - unknown intervals are grey, scheduled closures are not downtime.
- **D-325 Earn never shows a bare input.**
  - Guests see one pool share's value and its observed return.
  - Amounts go in a keypad sheet (Supply / Withdraw), with wallet-scaled chips and MAX.
  - Withdraw is sized to what's free.
- **D-326 Parlay keeps everything live between rounds.**
  - One banner replaces the per-row "reopen in".
  - Legs roll to their next round by themselves (the copy stops saying "pick its next one").
  - Indicative per-side odds come from one shared helper (`indicativeOdds`, `packages/calls`) used by Parlay, Duel and
    the market sheet.

### P1 — The sheet foundation (phone)
- [x] P1 built and deployed — `ff55a2a9`, phone OTA `f2ee0f7b` (12 Oct)

- **Host:** a `SheetHost` at the root (`app/_layout.tsx`) with a portal API (`useSheetPortal()` → `present(node)`);
  `Sheet` renders through it when opened inline. Route sheets already sit above the dock as root transparent modals
  and are unchanged.
- **Dock:** `Sheet` calls the dock's `hide("sheet")` while open, `show` after the close animation.
- **Detents** in `Sheet.tsx`:
  - a `detents?: readonly number[]` prop (fractions of the window minus the top inset);
  - open at the first;
  - drag up moves to the next, drag down to the previous or closes;
  - the spring settles on a detent; light haptic per detent;
  - the inner scroll is enabled only at the top detent.
- **Terminal:** the four terminal sheets (Markets, Stake, CashOut, Exit) and Parlay's slip render through the host.
  The scrim covers the ticket, making it inert (`accessibilityViewIsModal`); the ticket restores only after the
  dismissal completes.
- **Back** closes the top sheet first (keyboard first if open).
- **Files:**
  - `apps/mobile/src/components/sheet/{Sheet,SheetHost,constants}.tsx`;
  - `app/_layout.tsx`;
  - `components/shell/dock-context.tsx`;
  - `features/terminal/TerminalScreen.tsx`;
  - `features/parlay/ParlayScreen.tsx`.

### P2 — The market sheet (phone + web)
- [x] P2 built and deployed — `08649e5e`, web `sha-08649e5`, phone OTA `f2ee0f7b` (12 Oct)

- **Layout:** detents `[0.62, 0.88, 1.0]`, opening at 0.62; search focus expands to 1.0 before focusing.
- **Content, top to bottom:**
  - grab bar;
  - title row with ✕;
  - a 48 pt search pill;
  - chips: Favourites · Hot · All · Crypto · Stocks · Metals · FX · Baskets;
  - grouped rows.
- **Rows:** reuse `MarketRow` (`features/markets/MarketsScreen.tsx:34-63`: mark, name, 24 h line, unit-aware price,
  change chip). Each row adds a 44 pt star; the current market is highlighted.
- **Behaviour:**
  - Hot shows the six biggest movers (`dayChange`);
  - every open resets to All with an empty search;
  - untradable markets are listed faded, with their reason;
  - picking plays a tick and haptic, switches, then closes;
  - empty states: "No favourites yet. Tap a star to add one." / "No markets match that search."
- **Storage:** favourites and recents in new versioned keys (`lib/storage.ts` on the phone, localStorage on the web).
- **Shared code:** `SearchField` becomes a kit component. On the web the same content goes in the existing drawer.

### P3 — Parlay as a chain (both apps)
- [ ] P3 built and deployed

- **Header:**
  - four connected leg sockets, "Pick 2–4 calls. Every leg must come true."; picked sockets carry the mark and
    direction;
  - the lane selector defaults to the network's first listed lane (`lanesOn`);
  - one round strip ("Round settling · next opens in 0:14") instead of the per-row countdown.
- **Market cards:** grouped, with search and chips. Each card shows the mark, name, live price, 24 h line, change, and
  two 44 pt buttons `↑ Up · 1.89×` / `↓ Down · 1.94×` (`indicativeOdds`).
- **Picking:** tap selects, again removes, the other side replaces; one leg per market, max 4.
- **The capture motion (R7.10):** the mark flies along a 320 ms arc into its socket; the socket settles on a spring with
  a tick and a light haptic (21st motion-add-to-basket 24524 as the reference).
- **The slip** is always present as an 88 pt bar above the safe area: "Choose your first leg" → marks, leg count, live
  combined multiplier → "Review parlay". It opens the slip sheet (detents), which holds:
  - the legs (remove, live ahead / behind);
  - the 44 pt multiplier;
  - stake chips and the keypad (shared `AmountPad`, P5);
  - "pays $X if all land" and "about N % chance all land";
  - hold-to-place ("Place parlay · $5", 21st hold-to-confirm 23527), with the button naming its blocker.
- **After placing:** each parlay becomes a settlement track. Legs tick off as they settle, already-settled ones replay
  420 ms apart, and a single miss marks it lost while the other legs keep reporting. Open parlays also show on Calls.
- **Guests** pick and price freely; placing is the passkey step with the slip kept (value first, sign last).

### P4 — Duel as a two-seat arena (both apps)
- [ ] P4 built and deployed

- **Entry stage (220 pt):**
  - your 72 pt portrait vs an outlined "Opponent seat", the pot on the line between;
  - tier tiles in a snapping carousel (132×112, "No pot" / "$10 pot" / …) with "N waiting" per tier;
  - the commitment spelled out;
  - a pinned "Find opponent · $40";
  - the rank ladder (`useDuelLadder`, unused today) with your row pinned;
  - history with portraits.
- **Queue:** the opponent seat becomes the searching ring (the existing radar), with waited time, "N waiting" (zero
  reads "First in this tier") and the band. After 30 s it offers other tiers. Leave stays in the thumb zone.
- **Match found:** the opponent's portrait arrives (240 ms) and VS compresses 1.12→1, with the match chord and an
  impact.
- **The match:** both portraits and running totals stay pinned over three market lanes (about 128 pt each). Each lane
  shows the mark, live price, 24 h line, window and the Up / Down payouts. Your pick locks into your side; the
  opponent's side shows only their progress until it may reveal. The heartbeat runs in the last 10 s.
- **Result:** it takes the stage — the winner's portrait, both totals rolling, the pot award, the rating change — then
  Rematch and Share.
- **api:** `GET /v1/duel/queue` gains `waiting: Record<tier, number>` (a count over the
  `duel_entries_queue` index).

### P5 — Earn as ownership (both apps)
- [ ] P5 built and deployed

- **Hero:**
  - signed in: "Your share value" (52 pt), net earned, ownership %;
  - guest: "Value of one pool share" and its observed return ("Since launch · 7 h" until there's history).
- **Net earned:** the indexer gains handlers for PoolShares' `SupplyRequested`, `WithdrawRequested` and `Claimed` (a
  per-account cost basis; an indexer redeploy re-reads from the start block). Until it serves them, the hero shows value
  and ownership only.
- **Share-value chart** (1D / 7D / 30D), plotting value ÷ supply from the indexer's hourly `PoolEpoch` rows plus the
  live point, with scrubbing and quiet haptics.
  - The api's `epochs()` (capped at 24 today, `history/constants.ts:17`) gains a `since`, and the route a `range`.
  - The chart is new: `sparkGeometry` (`packages/calls/src/spark.ts`) is generalised over a plain series, drawn with
    Skia plus a Pan scrub on the phone and SVG plus pointer events on the web (no chart library).
- **Pool panel:** total value, available, backing open calls, a utilisation meter, the next settlement.
- **Pending requests** as 72 pt receipts.
- **Action tray:** Supply and Withdraw buttons, plus the risk sentence ("The pool pays winning calls. Your share can fall,
  and withdrawals can wait.").
- **`AmountPad` sheet** (shared with Parlay; 21st Number Pad 3711): amount at 48 pt, balance or redeemable, ¼ ½ ¾ All
  chips, the keypad, estimated shares or proceeds, settlement timing, a pinned confirm. Guests can type an amount; the
  confirm is the passkey step.

### P6 — Status as a live evidence board (api + both apps)
- [ ] P6 built and deployed

- **Hero:** the verdict ("Live" / "Delayed" / "Unavailable" / "Unverified"), with the affected count, the last
  observation and a tally of pills.
- **Component tiles:**
  - feeds (per source: live / expected, latest tick age, cadence);
  - settlement keeper (last settle, overdue windows);
  - relay (pending, oldest);
  - chain / indexer (block age, lag);
  - deposits ("Not enabled in Practice").
- **Bars:** each tile has 24 h / 90 d bars from `GET /v1/status/history`. Bar height reads severity (the Owarine pulse
  strip); tapping a bar shows a timestamped detail.
- **Order and liveness:** "Needs attention" comes first, problem systems open. A pulse shows only when a new observation
  arrives. Every figure is timestamped.
- **Health chip** in the shell (beyond the ask), polled only while visible.
- **The web gets its first Status page** (`/app/status`; none exists today).
- **api:** migration 0029 `health_minutes (minute PK, payload jsonb)`, written each minute by the api from:
  - its feed states and process guards;
  - `market_intents` (relay pending and oldest);
  - `market_tickets` (overdue windows);
  - `envio_chains` (indexer lag — it also fills today's always-null `indexerLagBlocks`);
  - block age, measured with RPC latency;
  - `keeper_state` (the keeper's `Runner` starts calling the existing, unused `saveJobState`).
- **Purge** after 90 days in the keeper's retention job.

### P7 — Acceptance and release
- [ ] P7 built and deployed

- **Phone:** one Release simulator pass covering the sheets and market sheet, a parlay placed on testnet, a duel
  queued, the Earn keypad, and Status.
- **Web:** every surface in both themes at phone and desktop width.
- **Release:** api, keeper and web deployed, OTA shipped, parity rows, STATUS and the Handoff.

## Verification

- `pnpm gate` exit 0 every step.
- **Phone:**
  - simulator screenshots of each surface;
  - the market sheet: open, drag to each detent, search, dock hidden, ticket dimmed;
  - a parlay placed with real testnet dollars (`ids-and-txs.md` row);
  - a duel queued and left;
  - an Earn supply on the keypad.
- **Web:** the preview tools (`read_page`, screenshots, console free of errors) on `/app/parlay`, `/app/duel`,
  `/app/earn`, `/app/status` and the terminal's market drawer.
- **api:** `curl /v1/duel/queue` shows `waiting`; `/v1/status/history` returns buckets after the first minutes.

## Handoff
(written at the end of the stage)
