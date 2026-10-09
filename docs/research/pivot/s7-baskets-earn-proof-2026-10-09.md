# S7 research — baskets, Earn and Proof (9 Oct 2026, read-only agent)

**S7 fact sheet: baskets, Earn and Proof (read-only research; nothing edited, no state-changing git, no transactions)**

Path roots: **M** = /Users/abu/dev/hackathon/metropolis, **C** = crypto-world-fair, **A** = stocklana (Agari), **O** = owarine, **Y** = sommina-events (Masayume). C, A, O and Y all sit under /Users/abu/dev/hackathon.

**Gap first.** Mitoshi (C) does not contain the basket, `pickBasketHedges`, D-124 or `ReverifyButton` work. That work lives in Agari (A), and Owarine (O) has a copy of the baskets. In C, `/earn` and `/proof/[market]` are placeholder pages (C/web/src/app/(app)/earn/page.tsx:7-9 and (site)/proof/[market]/page.tsx:7-9). C does have a real vault contract, `MarketMakerVault`. Section 2 covers C plus A and O.

## 1. Senryo now

**`BandPool.sol` (M/contracts/src/markets/)**
- The ledger is `liquid`, `reserved`, `escrowedStakes`, `committedStakes`, `payableTotal`, `totalOwed`, `reservedByExpiry` and `owedOf`, all public (:35-42).
- `fund` (:53-59) and `defund` (:62-69) are `restricted`. `defund` can only take from `liquid`. `fund` pulls with `safeTransferFrom(msg.sender)`.
- `claimOwed` pays the caller only (:72-80). `liabilities()` is the sum of all six buckets (:148-150). `_assertSolvent` checks balance ≥ liabilities (:153-157), so a donation becomes surplus that nobody owns.
- Capacity uses `liquid + reserved` as the pool size: liquid first, then the exposure cap, then the per-expiry cap (:113-118). `_setParams` bounds are at :94-107, with `MAX_EXPOSURE_BPS = 8000` (MarketTypes.sol:94).
- **No role wiring exists for fund/defund.** DeployMarkets only wires `MINTER` (M/contracts/script/DeployMarkets.s.sol:102-107), so fund and defund fall to the admin role. The seed goes in via `reserve.fund(seed)` (:171-178).
- Testnet catalog (M/contracts/script/catalog/10143.json): seed 10M, `maxExposureBps` 6000, `maxExpiryReserved` 500k, stake 1–1000.

**`BandReserve.sol`**
- `settleWindow` (:62-96) settles every band of a window at once:
  - a losing band's payout goes to `liquid`;
  - a winning band's payout goes to `payableTotal`;
  - a refund sends the stake to `payableTotal` and the reserve back to `liquid`.
  - It emits `toPool` and `toHolders`.
- `claimFor` is a permissionless batch (:101-114). `quoteOpen` is at :144-158. The contract is not a proxy; it is immutable (constructor :37-43).

**`Windows.sol`**
- `recordPrint` (:154-161) and `ensurePrint` (:164-176) both go through `_record` (:178-190). It requires a `knownVerifier`, a key from `printKeyOf(verifier, feedId, t)` (:261-263), and admission within `t + admissionSec`. It calls `verifyPrint` and emits `PrintRecorded`.
- `knownVerifier` is set when a policy version is added (:71-72). A source only needs code and `admissionSec() != 0` (:100-103).
- `primarySourceOf` is at :281-284. `resolve` (:197-219) applies the cross-check through `diverges` (:234-238, public pure). `voidExpired` is at :223-231.
- **Every cadence divides 3600 and every window starts aligned to its cadence** (:44, :113; MarketTypes.sol:26-27). So no window ever spans a UTC hour boundary. This is the lever the Earn design below relies on.

**`PythPrintVerifier.sol`**
- `verifyPrint` (:51-79) calls `parsePriceFeedUpdatesUnique` over `[t, t+grace]` with a single id (:59-62). It checks conf ≤ `maxConfBps` (:72) and normalises to e-8.
- It has no access control and no state, so anyone can call it, including through `eth_call`.

**Fills use the same print store.** `finalize` calls `ensurePrint(src.verifier, src.feedId, target, proof)` and refuses a batch that mixes sources (BandBook.sol:153-161). On a close, the pool's realised result is `basisOut − proceeds` (:240-241).

**Baskets: none on chain or in services.**
- `MarketSpec` has one `pythFeedId` and a kind of crypto or equity (M/packages/config/src/catalog.ts:44-55). `PRINT_CLASSES` is keyed by kind (:135-138).
- The keeper hard-codes `addressOf(...,"PythPrintVerifier")` and reads a single feed's archived print (M/services/keeper/src/jobs/settle.ts:53-63, fills.ts:53).

**Can a basket be its own verifier? Yes, with no change to Windows or BandReserve.**
- A `BasketPrintVerifier` implements `IPrintVerifier`, with feedId = basketId.
- The proof is `abi.encode(def, bytes[] updates)`. One `parsePriceFeedUpdatesUnique` call takes N ids, and `IPyth.sol:23-26` already takes `ids[]`.
- It checks each component's publish time and conf, then returns the weighted index, the weighted conf and the latest publish time.
- Policy, `setSigma` and `addBand` stay as they are. Fills and boundaries reuse `ensurePrint`.

**What the pool exposes for Earn**
- Supplier equity is `liquid() + reserved()`: open tickets counted at the pool's cost.
- Excluded, correctly: `escrowedStakes`, `committedStakes`, `payableTotal`, `totalOwed`.
- `reservedByExpiry[e]` is public, so "every window ending by time H is settled" can be checked on chain.
- `params()` gives the risk bounds.

**Indexer (M/indexer)**
- `Window` has `state`, `voidReason`, `openE8`/`closeE8`, the won/refund/lost masks, `toPool`/`toHolders`, `openedTx`, `resolvedTx` and `settledTx` (schema.graphql:18-42).
- `Print` has `feedId`, `t`, `priceE8`, `confE8`, `publishTime` and `txHash`, but **no verifier** (:45-54). The handler drops it (src/handlers/windows.ts:40-51).
- `Ticket.windowId` is indexed (:62). `Pool` holds funded, defunded, `settledToPool`, `settledToHolders` and `heldPayouts` (:132-141; pool.ts:6-37).

**API and query**
- `GET /v1/markets/windows/:windowId` (M/packages/api-client/src/routes/history.ts:82-108; M/services/api/src/routes/history.ts:46-70) returns:
  - open and close prints as `{priceE8, publishTime, txHash}`, without conf;
  - `state`, `settled`, `calls`, `liveCalls`, `volume`, `bandStake`, `openedTx`, `settledTx`.
- The reader looks prints up by `series.market.pythFeedId` (M/services/api/src/history/reader.ts:96-98).
- Not served: `confE8`, `resolvedTx`, `voidReason`, the masks, and the list of calls in a window (calls are listed by owner only, :49-59). There is no endpoint listing windows.
- `/v1/prices/print` returns archived price, conf, publish time and previous publish time, but not the raw update bytes (markets.ts:366-381; prices.ts:55-71). The archive does store the bytes (`update_hex`, archive.ts:36-44).
- `useWindowProof` (M/packages/query/src/history.ts:78-100) returns null on a 404. `usePrint` is at :107-120.
- On the web, `WindowProof.tsx` (apps/web/src/features/calls/WindowProof.tsx:4) says "the full re-verify page is S7". There are no `/proof`, `/earn` or `/baskets` routes.
- Prints are posted through Multicall3 `aggregate3`, so the record transaction's `to` is Multicall3. The close print, resolve, settle and first payouts share one transaction (M/packages/chain/src/markets.ts:106-131, ~148-170).

## 2. Mitoshi, plus where the referenced features actually live

**Mitoshi `MarketMakerVault` (C/contracts/src/products/maker/MarketMakerVault.sol)**
- `supply` mints 1:1 first, otherwise `amount × shares / totalValue` (:107-119).
- `withdraw` pays from `liquid` only and is refused while any window past expiry is unsettled (`unsettledExpired`, :123-139, :276-283).
- `totalValue = liquid + deployed` at cost (:261-263). There is no inflation guard; it relies on internal `liquid` (:11-12).
- No epochs.
- Themes are agent-rebalanced token baskets (C/packages/core/src/themes/index.ts:4), still pending.

**Baskets (D-124, Agari)**
- Index formula: `index_E8 = Σ floor(wBps·p·1e11/(1e4·base))`. It is equal weight, base 1,000 points at frozen base prices, and null if any member is missing (A/packages/core/src/market/baskets.ts:10, :28, :119-127). Owarine has the same code (O/packages/core/src/market/baskets.ts).
- The prints are **attested**: the relay signs one PreStocks read (A/docs/plan/specs/prints.md:214; A/docs/plan/decisions.md:1291-1304). They are not Pyth prints.
- The unit is always points; a re-base means a new feed id and a new series.
- Cover is offered only when the wallet holds at least 2 members (`pickBasketHedges`, A/web/src/features/hedge/basket-cover.ts:22).
- Copy: "a small group of companies bet on together… started at 1,000 points", "N companies · equal weight", Predict / Cover / Hold (A/web/src/features/baskets/copy.ts:9-35).

**Earn (Agari)**
- Copy: "Earn the spread", "withdraw what is idle, any time", "withdraw what no live band is holding", "Locked" / "Deployed", realised vs on-paper, no APY (A/web/src/features/earn/copy.ts:10-67; reserves.ts:45-67).
- On chain: equity = vault balance − user escrow, and withdrawal is limited to the free part (A/anchor/programs/agari-range/src/instructions/liquidity.rs:37-100; state/reserve.rs:62-69).
- Because it reads the balance, a donation moves the share price, and there is no epoch.

**Proof and `ReverifyButton` (Agari)**
- The button sends `POST /api/proof/pyth`. The **server** re-posts the archived update to the Solana devnet receiver, with quotas of 20 an hour overall and 3 per IP, then polls the result (A/web/src/features/proof/ReverifyButton.tsx:10-25; replay.server.ts:4-10).
- It compares the result as "exact match" or "off by N × 10⁻⁸" (copy.ts:55-56).
- Copy: "Print proof", "Re-verify on devnet", "Signed bytes", "sha256", "Signers" (copy.ts:12-64). The `/proof` feed reads "Every settled Window, newest first, with the prints that decided it" (feed-copy.ts:9).

## 3. Owarine and Masayume

**Owarine** (Daml):
- Firm NAV quotes with `validUntil`, no epochs. `NavStatement` (O/daml/abu-pm-main/daml/PM/Reserve.daml:82-128).
- Ticket reserves count open exposure at cost, `maxPayout − stake` (O/daml/abu-pm-tickets/daml/PM/Tickets/Earn.daml:98-122).
- The maker marks each leg at the lower of cost and backing (Maker.daml:78-83).
- `/earn` and `/pool` now redirect away (O/web/next.config.ts:30-32); the comment says Earn is out because its reserves aren't on DevNet.
- Re-verify runs on the server: it re-fetches Coinbase, Kraken and Bitstamp candles and recomputes the median and outcome (O/packages/core/src/proof/reverify.ts:110-179). Copy: "Check it yourself", "Re-verified: N checks pass".

**Masayume** (Solidity):
- `MarketMakerVault` is the same model as Mitoshi's (Y/contracts/src/maker/MarketMakerVault.sol:94-122, :252-273).
- `RangeReserve` values the pool as `liquid + locked` with **no** gate for unsettled windows (Y/contracts/src/range/RangeReserve.sol:47-73, :190-192).
- No epochs, no ERC-4626 or ERC-7540, no virtual shares.

## 4. Proposed S7 design

**Baskets: a new `BasketPrintVerifier` (one per quality class)**
- Keep it stateless as `IPrintVerifier` requires (M/contracts/src/markets/interfaces/IPrintVerifier.sol:8): `feedId = keccak256(abi.encode(ids[], weightsBps[], basesE8[]))`.
- The proof carries that definition plus the N updates. The verifier checks the hash, then one N-id unique parse, then a conf check per component.
- It returns:
  - index = D-124 formula, base 1e11 points;
  - conf = the same weighted sum of confs;
  - publish time = the latest component publish time.
- It emits `BasketPrint(feedId, t, prices[], confs[], times[])` so the Proof page can show each component.
- Register the basket as a normal series with policy primary = (basket verifier, basketId), plus `setSigma` and `addBand`.
- Off-chain gaps:
  - the catalog needs a basket kind with members, weights and bases;
  - basket σ needs correlations;
  - the keeper and relay must build N-update proofs and read the verifier from the policy, not the hard-coded name;
  - the gateway must archive every component at every boundary and fill instant;
  - the indexer must store `verifier`;
  - the reader must look up by basketId.
- Stock baskets need one shared calendar id.

**Earn: a new `PoolShares` contract (ERC-20 shares, ERC-7540-style asynchronous, hourly epochs). BandReserve is not redeployed.**
- **Wiring.** Use `setTargetFunctionRole` to put `fund` and `defund` under a POOL role held only by PoolShares.
- **Requests.**
  - `requestDeposit`: the assets wait in PoolShares, not at risk, and can be cancelled before the cutoff.
  - `requestRedeem`: the shares are escrowed.
- **`roll(H)`** at each UTC hour. Anyone may call it once, for every 60-second expiry `e` in `(H−3600, H]`, `reservedByExpiry[e] == 0`.
  - Because no window spans the hour, every window ending by H is then settled and nothing about it is unrealised.
- **NAV** = `liquid + reserved`. Price = `(NAV+1)/(supply+10^offset)` (a virtual offset).
- **Order at the roll.** Mint deposits first, then pay redemptions with `defund(min(owed, liquid))`. Anything unpaid stays queued at the next epoch's price.
  - A 6000 bps exposure cap keeps at least 40% of equity liquid.
- **Records.** Emit `EpochRolled(H, nav, supply, in, out)`. The indexer adds a `PoolEpoch` entity for epoch PnL. Reserved vs liquid and risk in words come from `params()`.
- **The house seed** becomes the first shares: mint once while supply is 0.
- **Rejected alternative:** public supply/withdraw on BandPool. It needs a redeploy, a new address and re-indexing.

**Proof**
- **Reuse:** the window route, `useWindowProof`, `usePrint` and `WindowProof`.
- **Gaps:**
  - serve `confE8`, `resolvedTx`, `voidReason` and the masks;
  - add `GET /windows/:id/calls` and a windows feed;
  - serve the update bytes, or decode them from the `aggregate3 → ensurePrint` calldata.
- **Re-verify in the browser, free and without quotas:**
  - `eth_call verifier.verifyPrint(proof, feedId, t)`;
  - compare with `Windows.printOf` and the indexed print;
  - recompute each band with `bandOutcome` (M/packages/core/src/market/band-math.ts:110) and `diverges`.

**Accounting risks**
1. **Exiting before a loss is booked.** Instant withdrawal at liquid + locked lets a supplier leave between the close print and settlement (Agari range, Masayume `RangeReserve`). The hourly gate removes this.
2. **Leakage after H.** Windows starting at or after H realise cash-out results (`basisOut − proceeds`) before the roll. The amount is small; it stays small if the keeper rolls promptly.
3. **The admin can drain NAV through `defund`.** Remove that role from people, and bound `setParams`.
4. **Donation or first-depositor inflation.** Blocked by the internal counters plus surplus being unowned. Also add the virtual offset and the house first mint.
5. **A late keeper or a missed print delays the roll.** Missed prints void after about 300 s of admission (catalog.ts:135-138).
6. **Rounding.** Floor minted shares and floor paid assets.

## UNDEFINED / contradictory / dead-end
- The brief places the baskets, `pickBasketHedges`, D-124 and `ReverifyButton` in Mitoshi. They are in Agari and Owarine, and the parity ledger's "C-" rows point there too (M/docs/plan/parity-predictions.md:115, :131).
- No reference product has epochs, so "supply at settled epochs" (M/docs/plan/pivot-2026-10-08.md:92; decisions.md:390) is a new design with nothing to port.
- The reference baskets are relay-signed PreStocks prints. No contract code carries over to a Pyth basket.
- `Pool.settledToPool` is described as "the pool's realised result" (M/indexer/schema.graphql:136-137) but is just the plain sum of `toPool` (M/indexer/src/handlers/pool.ts:24).
- Unknown: how often a metals or stock component's first update after t misses the 5 s grace, which would void the basket window.
- Unknown: whether an `eth_call` re-verify of an old print still passes after Wormhole rotates its guardian set.
- The archive comment says Hermes keeps updates only about 640 s (M/services/api/src/prices/archive.ts:7-8). So re-verify depends on our own archive or on transaction calldata.
- Undefined: how the mainnet USDC seed migrates into shares, which keeper job rolls epochs, and where basket σ and correlations come from.
- Dead ends: Agari's Solana replay (costs SOL, rate-limited) and Owarine's exchange-candle recompute. Neither fits Pyth on Monad.
