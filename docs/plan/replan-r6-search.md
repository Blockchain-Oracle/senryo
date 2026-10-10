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

## Steps
- [ ] R6.1 A shared search index in a package: entries for places, markets, positions, events, duels, parlays, games,
  actions and help. The Everything drawer's `searchNav` is deleted.
- [ ] R6.2 Ranking: prefix and symbol boosts, typo tolerance, and frecency from a local recents store.
- [ ] R6.3 With nothing typed: Recents, Open positions (live value), Hot movers.
- [ ] R6.4 Market rows:
  - every lane, session-aware (`useMarketLine`);
  - change %, a sparkline and a kind label;
  - a nested page per market: Up, Down, Ride, lanes, proof.
- [ ] R6.5 Groups: Events, Duel, Parlay and Lucky; people and @handles once R8's profiles exist.
- [ ] R6.6 Lookups: `deposit` / `add money` / `fund` keywords; a pasted call id or tx hash opens the receipt.
- [ ] R6.7 A preview pane for the highlighted market or position.
- [ ] R6.8 Keyboard and trigger:
  - a footer legend, digit shortcuts on Go-to rows, and ⌘↵ for the alternate action;
  - the platform modifier shown correctly;
  - the trigger visible on the terminal.
- [ ] R6.9 Phone search (UGLYCASH U10): a floating trigger and full-page grouped search on the same index, opened from
  More and Home.

## Handoff
(written at the end of the stage)
