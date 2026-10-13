# R6 — ⌘K and phone search (replan stage 6)

**Goal:** one search that knows Senryo:
- markets with every lane;
- your open positions, live;
- events, duels, parlays and games;
- receipts by id or hash;
- people.

It ranks well, previews, and is on the phone too.

**Authority:**
- `replan-2026-10-10.md` R6;
- research `03` §3 and take 3, `06` §6;
- UGLYCASH U10 (`docs/design/reference-study-2026-10-07-uglycash/flows.md:59-63`);
- Owarine's `CommandPalette.tsx`;
- the ranking library chosen after reading its docs (Context7);
- 21st.dev first.

**Gate:**
- `pnpm gate` 0;
- the web palette and phone search pass a scripted set of queries:
  - "bitcon" finds BTC;
  - "deposit" finds Add money;
  - a pasted tx hash opens its receipt;
  - an empty query shows Recents, Open positions and Hot;
- an open position opens on the terminal with Cash out ready and never executes;
- one simulator pass.

## Design (13 Oct)
- **Direction:** Codex, `docs/research/replan-2026-10-10/13-search-direction.md`; decisions D-336…D-341.
- **Ranking:** MiniSearch 7.2 in `@senryo/search` (chosen from its docs over Fuse.js and uFuzzy); the gate's queries run
  with `pnpm --filter @senryo/search queries`.
- **Shared:** `@senryo/calls` `useSearch` (entries, lookup, empty view), `marketPageRows`, `useMarketLanes`,
  `useBookPositions`, `setTerminalReady`; `@senryo/config` `HELP`; api `GET /v1/lookup`.
- **People** stay with R8.9 (profile pages arrive there); no empty People group meanwhile.

## Steps
- [x] R6.1 A shared search index in a package: entries for places, markets, positions, events, duels, parlays, games,
  actions and help. The Everything drawer's `searchNav` is deleted.
  - `@senryo/search` + `@senryo/calls` `useSearch`; Everything's search row opens ⌘K; `HELP` is one list (D-341).
- [x] R6.2 Ranking: prefix and symbol boosts, typo tolerance, and frecency from a local recents store.
  - MiniSearch (D-336); visits (D-337) also feed the picker, whose old recents were read in once. 28 scripted queries
    pass (`pnpm --filter @senryo/search queries`).
- [x] R6.3 With nothing typed: Recents, Open positions (live value), Hot movers.
  - Seen on production web as a guest (Recent DOGE · your DOGE ride live · Hot NEAR/DOT/SUI · Go to 1–5) and on the
    simulator (the migrated recents, a guest's BTC ride).
- [x] R6.4 Market rows:
  - every lane, session-aware (`useMarketLine`);
  - change %, a sparkline and a kind label;
  - a nested page per market: Up, Down, Ride, lanes, proof.
  - `useMarketLanes` (four countdowns, the line's words when shut); `marketPageRows` for both apps; "View proof" opens
    `/proof/?market=`. Up on the 5m lane opened ETH (web) and BTC (phone) on 5m with UP ringed; nothing placed.
- [x] R6.5 Groups: Events, Duel, Parlay and Lucky; people and @handles once R8's profiles exist.
  - Events with crests and live scores, Duel with its live queue; people move to R8.9 with profile pages.
- [x] R6.6 Lookups: `deposit` / `add money` / `fund` keywords; a pasted call id or tx hash opens the receipt.
  - `GET /v1/lookup` (D-338). Production: call 1019's fill hash → "Call #1019 · BTC" → its receipt drawer; an
    unknown hash → the explorer; `N° R-10143-000018` → Ride #18 · DOGE; "18" → call 18 and ride 18.
- [x] R6.7 A preview pane for the highlighted market or position.
  - ≥ 1024 px: market (price, 24 h chart, lanes, session), position (live value, facts, "Cash out ready" or why it's
    held), event, help answer; the market page keeps it.
- [x] R6.8 Keyboard and trigger:
  - a footer legend, digit shortcuts on Go-to rows, and ⌘↵ for the alternate action;
  - the platform modifier shown correctly;
  - the trigger visible on the terminal.
  - Keys 1–5 after Tab; ⌘ / Ctrl from the platform in the top line, the terminal, the footer, the keyboard map.
- [x] R6.9 Phone search (UGLYCASH U10): a floating trigger and full-page grouped search on the same index, opened from
  More and Home.
  - Home's launcher reworked after the owner's review (D-342): the dock's material, tucked while reading down, live
    hints. Release simulator pass: launcher, search page, "bitcon", BTC's page, Up on 5m, a position → the positions
    sheet on it, Close untouched.

## Handoff
**R6 is built, accepted and live (13 Oct).**
- **Live:** api `sha-08f35ad` (the lookup route); web `sha-08f35ad` — `sha-c9680b1` (the 3:59:18 countdown) is queued
  behind another project's build that has the shared box swapping (see below); phone OTAs `8a38b62e` then
  `bdbdfe6b` (D-342's launcher).
- **The gate:** `pnpm gate` 0; the scripted queries pass; a pasted hash opens its receipt (production); an empty query
  shows Recent, your positions and Hot; an open position opens with Cash out ready and never executes — ride 20 stayed
  open with nothing paid after search opened it (production api), and on the phone the sheet opened on the ride with
  Close untouched; one simulator pass (plus one for D-342).
- **Open:**
  - The opened-trade toast ("Up BTC ride opened") stays over the phone's dock until dismissed and didn't swipe away on
    the simulator — R5's toast run; it hid the dock during the pass.
  - ⌘↵ for events and games has no alternate yet (no rules anchor, no how-to-play page): the footer shows none.
  - People and @handles: R8.9. The playback the owner sent (Fomo) is R8.10–R8.12 (research 14).
  - The shared box (agari-box) swapped twice on 13 Oct under other projects' Next builds; Senryo went unanswering
    with everything else. Deploys go one at a time, after the load settles.
