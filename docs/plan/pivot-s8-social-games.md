# S8 — social, games, exits that run with the app closed, events (pivot plan "S8")

**Goal:** Senryo is a place people come back to: a public leaderboard and profiles, streaks, a live feed of calls, a
referral that pays test dollars, a push when a closed market opens; calls that close themselves (take-profit,
stop-loss, trail) with the app shut; Parlay, a head-to-head Duel, Lucky, a free warm-up and two arcade games; and yes/no
event markets settled by a named committee. Ships with S7 as one testnet deploy of the markets contracts (D-291).

**Authority:** `pivot-2026-10-08.md` (S8), this stage's D-291…D-297. Research (9 Oct, read-only):
`docs/research/pivot/s8-social-2026-10-09.md`, `s8-games-2026-10-09.md`, `s8-exits-events-2026-10-09.md`.
Every new component: 21st.dev search first, recorded in `apps/web/.21st/design.json`.

**Gate:** `pnpm gate` 0 · forge tests 0 failing · on testnet: a TP and an SL each fired by the keeper with the app
closed, a two-leg parlay settled and paid, a duel played to its pot, a yes/no event resolved by its committee · the
leaderboard, a public profile and the ticker live on both apps · a referral paid · a market-open push received.

## Decisions taken for this stage (recorded in `decisions.md`)

- **D-291 Markets v2: one fresh testnet deploy carries S7 and S8.** S8 changes `BandReserve` (exits, parlay), which is
  not upgradeable, so S7's listing waits and both go out together through `DeployMarkets` (every series, five
  verifiers, PoolShares, DuelArena, the event book). The indexer reads the old and the new reserve, so Practice history
  stays. Testnet MON needed: ~25–30.
- **D-292 Exits live on chain, on the ticket.** `setExit` (an owner-signed intent, or one-tap) stores take-profit,
  stop-loss, a floor and a trail flag on a ticket; `fireExit` is permissionless (the keeper) and commits a close of every
  remaining share at the next print; the fill checks the kind — TP: proceeds ≥ take-profit; SL: floor ≤ proceeds ≤
  stop-loss (the timing is enforced, not trusted); Trail: proceeds ≥ floor (the stop is the keeper's, ratcheting only).
  A refused fill leaves the exit standing; closes stop pinning `configVersion` (opens still do). Exits keep working
  after the one-tap session ends.
- **D-293 Parlay is a book inside the reserve.** 2–4 legs on open windows (one per series), priced as the product of
  the legs' band probabilities from the same maths (`BandMath`), the spread applied once; the house share reserved
  against every leg's expiry (so Earn's roll waits); legs decided in close order; a tied leg is dropped (its odds
  divided out), a void leg refunds the ticket. Paid by the shared pool, so Earn values it.
- **D-294 Duel is `DuelArena`.** Two players, a sealed deck of three windows (keccak commitment, revealed at start),
  each swipes Up or Down on every card as a real call the arena places and owns (ERC-1271); best total result takes
  both pots (tie splits; a no-show forfeits; both absent refunds). Matchmaking and the deck are the api's; the keeper
  settles. Elo ranks on the indexer.
- **D-295 Lucky, Warm-up, arcade need no contract.** Lucky draws (market, side, reach) from a committed seed and
  places one ordinary call at the band whose multiple is nearest the reach (max 20× — the 3 % floor plus spread).
  Owarine's no-stakes "Practice" game is named **Warm-up** here (Practice is our test-dollar mode). Line Rider and
  Candle Hop score on a seeded field the api replays before it ranks a score ("checked · not on chain").
- **D-296 Yes/no events are their own book.** A committee verifier (M-of-N named signers, each signing the
  statement hash of question, answer and time; disagreement or silence voids and refunds), and a parimutuel book
  (Yes stakes vs No stakes, winners share the pool of both less a fee; no cash-out; calls close before the event):
  `BandBook` prices from a moving price and can't price news. Labelled "Yes / No · settled by a committee of N
  signers, M must agree — not a price feed", the signers named, Senryo-run on Practice.
- **D-297 Social is privacy-first.** The leaderboard ranks only accounts listed on that network (Practice and Real
  apart); `?owner=` call history honours "show my calls"; the ticker shows listed accounts' calls only (others as
  "someone"); referral bonus is $100 test dollars to both, on the referee's first filled call, and raises that day's
  top-up cap by the bonus; Notify me is a server alert and a push on the phone, an in-tab notification on the web; the
  unbuilt "price you set is crossed" copy is removed.

## Steps

### Social (no contract)
- [ ] S8.1 Leaderboard (podium, the field, "you" bar; day · week · all; listed accounts only) and public profiles
      (`/u?h=` web, `/u/[handle]` phone: identity, record, streak, public calls) on both apps; profile editing on the
      web; current streak beside best; the share card says "by @handle" and carries `?r=`
- [ ] S8.2 Recent-calls ticker (the `markets` topic, first paint from the indexer) on Home and Markets; one crowd split
      helper for every band on the terminal
- [ ] S8.3 Referral (`?r=` capture, claim, the bonus on the first fill, a push) and Notify me (alerts table, keeper
      `opens` job, push; the closed panel's button on both apps); the halt watch from S7.3

### Contracts (markets v2)
- [x] S8.4 Exits in `BandReserve` (D-292) with tests; keeper `exits` job (TP/SL/trail on live prices); exits UI on the
      terminal and receipts of both apps
      _Done: `ExitOrders` + `BandBook` (`setExit`, `fireExit`, `fireTrail`; closes no longer pin the config), 8 Foundry
      tests (69 in all); the watcher is the api's (`relay/exits.ts`, live prices in memory, sponsor lane holds `EXIT`),
      `market_exits`, `/v1/markets/exits`, exits on tickets; the indexer's `ExitSet`/`ExitFired` and `closedBy`; the
      exit modal/sheet on both apps (21st Quantity Stepper #29940) and "Closed by" on receipts. On chain with S8.9._
- [x] S8.5 `ParlayBook` (D-293) with tests; relay, keeper settle of leg windows; Parlay builder and slips on both apps
      _Done: `ParlayBook` + `ParlayMath` inside the reserve (11 Foundry tests, 80 in all); `ParlayRelay` (gates per leg,
      leg windows opened in the commit's batch, the multi-feed fill), `market_parlays`/`market_parlay_legs`, the keeper's
      `parlays` job (backup fills, leg verdicts, settle), the indexer's `Parlay` and records; Parlay on both apps (picker,
      slip with the 21st Odds Display #36173, your parlays) in More / Everything → Play. On chain with S8.9._
- [ ] S8.6 `DuelArena` (D-294) with tests; matchmaking, deck, relay, keeper, indexer Elo; Duel on both apps
- [ ] S8.7 Events (D-296): committee verifier + `EventBook` with tests; the first events (Practice, Senryo-run
      committee); events on both apps, honestly labelled

### Games without a contract
- [ ] S8.8 Lucky (api draw + one call), Warm-up (client), Line Rider and Candle Hop (canvas/Skia, api score replay and
      board); a Games hub on both apps

### Ship
- [ ] S8.9 Markets v2 deploy (D-291) with every S7 and S8 contract; indexer on both reserves; services, web, phone OTA;
      acceptance rows for S7 and S8; STATUS handoff

## Handoff
(written at the end of the stage)
