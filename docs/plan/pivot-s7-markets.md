# S7 — stocks, more coins, Range and Moonshot, baskets, Earn, Proof (pivot plan "S7")

**Goal:** the market universe grows to every price we can prove on chain (crypto, US stocks, gold and silver, the euro),
each window shows its session in words; Range and Moonshot sit beside Up/Down on both apps; baskets of several feeds
are callable markets with their own proven print; anyone can supply test dollars to the pool and withdraw at the next
settled hour; every window has a public Proof page whose prints the browser re-verifies itself.

**Authority:** `pivot-2026-10-08.md` (S7 and the review fixes), D-281 (universe), D-263 (ways to call), D-272/D-280
(one stream, zero RPC, device quotes), D-283 (budgets), this stage's D-284…D-289. Research (9 Oct, read-only):
- `docs/research/pivot/s7-price-sources-2026-10-09.md` — the print path today, RedStone (wire format, signers, the
  keyless gateways closing on 29 Oct), stock sessions in Agari/Mitoshi, the live checks.
- `docs/research/pivot/s7-bands-2026-10-09.md` — Range, Moonshot and Crash are already on chain for all 12 series
  (menus read live), what the client must generalise, how the references differ.
- `docs/research/pivot/s7-baskets-earn-proof-2026-10-09.md` — a basket verifier through the pluggable `recordPrint`, an
  hourly-epoch share contract on `BandPool`, the Proof page's gaps and an in-browser re-verify.
Every new component: 21st.dev search first, recorded in `apps/web/.21st/design.json` (candidates already found: Price
Range Slider #26539, Dual Range Slider #925, Vault Lock #31481, Allocation Sankey #31201, Status Badge #4869).

**Gate:** `pnpm gate` 0 · every listed market opens and settles a window on testnet · a Range and a Moonshot call each
settled from both apps · a basket window settled and re-verified · supply → hourly roll → withdraw on testnet with the
share price equal to the pool's · the Proof page re-verifies a settled window in the browser · ≤ 1 SSE per tab ·
bundles within D-283.

## Decisions taken for this stage (recorded in `decisions.md`)

- **D-284 Two sources, in two steps.** First every feed our Pyth key may stream (D-281): DOGE, XRP, BNB, HYPE · TSLA,
  QQQ · XAU, XAG · EUR/USD, on the existing `PythPrintVerifier` (one per print class). Then RedStone's signed packages
  (5 signers, 10 s grid, its own MIT verifier ported from Mitoshi — never RedStone's BUSL Solidity) for NVDA, AAPL,
  MSFT, META, GOOGL, AMZN, PLTR, AMD and more coins. A RedStone print for time *t* is the grid point `ceil10(t)`, so a
  fill on a RedStone market waits up to 10 s for its print and no contract changes (Pyth's verifier already means "the
  first price at or after *t*"). Coins signed with fewer than 4 significant digits (PEPE, SHIB) are not listed: a
  1-minute window would tie too often. RedStone's keyless gateways refuse in growing windows until they stop on
  29 Oct; the api reads `REDSTONE_GATEWAYS` (a key RedStone issues — the user's request) and falls back to the public
  pair until then.
- **D-285 Range and Moonshot are the menus already on chain.** No contract change: Range is index 2 (±0.5σ√τ around the
  line), Moonshot ▲ index 3 and Crash ▼ index 4 (1σ√τ out); the terminal offers Up/Down · Range · Moonshot (▲ Moonshot /
  ▼ Crash). Free-form ranges and pick-your-multiple Moonshot (Owarine's game pages) need new contract kinds and stay
  with the games (S8). The crowd split becomes each band's share of the window's stake.
- **D-286 Baskets are a verifier.** `BasketPrintVerifier` proves N component prints in one call and returns the basket in
  points (D-124: base 1,000 at frozen base prices, weights in bps, null if any member is missing); `feedId` = the hash
  of the definition, so a re-base is a new market. Pyth baskets first (Crypto majors BTC·ETH·SOL, Alt coins
  DOGE·XRP·BNB·HYPE, Metals XAU·XAG), the Magnificent 7 when RedStone components land.
- **D-287 Earn is hourly epochs on the pool.** `PoolShares` holds the `fund`/`defund` role on `BandPool` (no redeploy):
  deposits and redemptions are requests, settled by a permissionless `roll(H)` once every window ending by the UTC hour
  H is settled (`reservedByExpiry == 0` for each expiry in the hour; no window spans an hour). Value = liquid +
  reserved; a virtual share offset and the house seed as first shares stop inflation tricks. No APY claims, ever.
- **D-288 The Proof page re-verifies in the browser.** The one exception to "no RPC from clients" (D-280), on the
  button only: the browser reads the record transaction, decodes the proof from its calldata, `eth_call`s the verifier
  and compares with `Windows.printOf` and the receipt — trusting neither our api nor our archive.
- **D-289 Calendars are exact, switched at daylight-saving changes.** Each calendar's week is the real UTC session for the
  current offset (the "union" rule would close 09:30–10:30 ET all summer); an ops script schedules `setWeek` before each
  US change (next: 1 Nov 2026) and adds NYSE holidays and early closes. Halts stop quoting and listing only (Pyth
  stale > 15 s or confidence > 50 bps in regular hours), never the chain.

## Steps

### Universe
- [x] S7.1 Catalogue v2: kinds (crypto, equity, metal, fx, basket), a source per market (pyth · redstone · basket), a
      calendar per kind (24/7, US equity, metals, FX), print classes per kind, append-only order (ticks carry the
      index); the Pyth step's markets with σ measured from Hermes history (script) and their menus; identity marks for the
      new coins and QQQ by the scripted fetch; invariant: the catalogue only appends
      _Done (4c90538): DOGE, XRP, BNB, HYPE, TSLA, QQQ, gold, silver, the euro; σ from five days of public 1-minute
      closes ×1.5 (Hermes history rate-limited the shared key — never again for bulk reads); calendars are the feeds'
      own Pyth schedules; `feedIdOf` / `verifierOf` everywhere; `market-order.json` + `catalog-append-only`._
- [x] S7.2 On chain: `AddMarkets.s.sol` (calendars with exact weeks and holidays, a verifier per new print class,
      `registerSeries` per cadence, `setSigma`, `addBand`), run on testnet; export and address book; the keeper and relay
      read each series' verifier and feed from its policy (no hard-coded Pyth); the gateway streams every catalogue feed
      _Done in code: `MarketsBase` (idempotent listing, decoded once — per-field JSON parsing ran a script out of EVM
      memory), `AddMarkets` simulated clean on testnet; keeper `calendars` job under CALENDAR_ROLE. On chain: waits on
      testnet MON._
- [x] S7.3 Sessions on both apps: session words in `@senryo/core` ("Closes 16:00 ET", "Opens Mon 09:30 ET", "Closed
      for the weekend", "Holiday", "Trading halted"), the closed terminal with the next open and Notify me (push on the
      phone, a browser notification on the web), the halt watch in the api, the DST job; Markets grouped by kind with
      search, on both apps
      _Done (4c90538): the session engine in `@senryo/core` (checked on open/close, DST, Thanksgiving, the early close,
      metals' break); Markets grouped with search on both apps; the closed terminal panel; the relay refuses
      closed-market calls in words. Notify me moves to S8 with alerts (a server-side alert and a push)._

### Ways to call
- [x] S7.4 Range and Moonshot on both apps: `@senryo/calls` quotes the whole menu by band index (`open(band)`), the chart
      draws Range's two edges and Moonshot's strike with the zone that wins, reactions and "winning" from `bandOutcome`,
      the crowd split by band, receipts and share cards name the band and its edges, "Not priced now" outside 3–97 %
      _Done (56a9c08)._

### Baskets
- [x] S7.5 `BasketPrintVerifier` (tests: index maths against the TS mirror, a missing member, conf), deploy, the Pyth
      baskets registered with σ from component correlations; keeper, relay and gateway build N-update proofs and archive
      the basket print; the basket screen (members, weights, each member's move, its contribution) on both apps
      _Done (16191bf, 4c48de3): Crypto majors, Alt coins, Metals in points, composed in the gateway from the archive
      only; `catalog-basket-ids`; points everywhere; members under the terminal._

### Earn
- [x] S7.6 `PoolShares` (requests, cancel before the cutoff, `roll`, virtual offset, the seed as first shares; Foundry
      invariants: value conserved across rolls, no withdrawal while the hour is unsettled), deploy and role wiring; the
      keeper's roll job; indexer `PoolEpoch`; api `/v1/earn`; Earn on both apps (supply, withdraw at the next hour, your
      share and value, reserved vs liquid, each hour's result, risk in words)
      _Done (154ce2d, dcaa9cc, d7aa463): hourly rolls, whole-batch withdrawals, relayed EIP-712 requests, the keeper's
      roll and delivery, Earn on both apps. Each hour's result as a list waits for the indexer to index PoolShares
      (with the deploy)._

### Proof
- [x] S7.7 The api serves a window's confidence, resolve tx, void reason, outcome masks and its calls, plus a windows
      feed; public `/proof` and `/proof/[window]` on the web and a Proof screen on the phone; the in-browser re-verify
      (D-288) with every band's outcome recomputed
      _Done (31e8a20): `/proof/` and `/proof/w/`; the phone's receipts open the web proof (re-verify runs in the
      browser)._

### Second source
- [x] S7.8 RedStone: `RedStonePrintVerifier` (≥ 3 of the 5 signers at `ceil10(t)`, median, confidence = half the signers'
      spread) and its tests; the api's RedStone reader (one "latest" a second, shared; archive at window bounds and fill
      points within its ~24 h), the moving line between grid points; the stock and coin markets; the Magnificent 7 basket
      _Done (4cbe571, bdeef34): RedStonePrintVerifier and RedStoneBasketVerifier, tested on live NVDA/AAPL packages
      with the five production signers; NVDA, AAPL, MSFT, META, GOOGL, AMZN, PLTR, AMD, AVAX, LINK, SUI, TON, ADA, LTC,
      DOT, NEAR, AAVE, UNI and Big tech (AAPL, MSFT, NVDA, GOOGL, AMZN, META — TSLA is a Pyth market, so the RedStone
      basket is the other six); the api's RedStoneReader rebuilds payloads byte for byte. The line between grid points
      moves every 10 s (no Alpaca). Microsoft and Amazon marks are recorded gaps._

### Ship
- [ ] S7.9 Deploy (contracts on testnet, api, keeper, indexer, web), the phone's OTA after one simulator run, acceptance
      rows, STATUS handoff

## Handoff
(written at the end of the stage)
