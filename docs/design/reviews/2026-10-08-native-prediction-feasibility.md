# Native BTC/ETH prediction execution feasibility

This feasibility snapshot predates the original contract implementation. For current source/review progress and still-open integration/activation gates, use the [continuation record](2026-10-08-uglycash-continuation.md). Historical absence findings below are not a claim that the foundation remains absent.

Research date: 8 October 2026. Read-only repository inspection, official documentation, public HTTP GETs and Monad JSON-RPC reads only. No account creation, credentials inspection, signatures, transaction broadcasts, deployments or source changes. This report is a proposed design and evidence record, not implemented readiness.

## Recommendation

Implement an original, fully collateralized two-outcome share market with a funded constant-product AMM on Monad testnet, using native test MON and the existing Senryo account/review/journal owners. This is the smallest self-contained route I found that preserves native buy, actual holdings, executable early sell, settlement and permissionless claim without building an off-chain matching engine. Each round needs dedicated liquidity. Do not replace this with a parimutuel pool or call a latest oracle value a boundary print.

Polymarket is technically capable of a wholly native integration; its website is not intrinsically necessary for each user's trading lifecycle. However, the current Senryo integration only discovers markets, the money/account network allowlist is Monad-only, and the current venue needs Polygon wallet/authentication/funding, pUSD, version-aware signatures and position operations. There is no evidence in this audit that those account and eligibility dependencies are fulfilled. Prefer the accepted Monad fallback for a test-money implementation; retain Polymarket discovery and Castora numerical contests separately. This is a scope/implementation recommendation, not a finding that Polymarket cannot support native clients.

Two immediate gates precede a truthful live fallback: (1) obtain authorized current Pyth historical payload access and prove unique-boundary verification against the selected receiver by read-only simulation; (2) specify and fund round liquidity. Neither is supplied by deploying an empty market contract.

## Observed code owners

Paths below are relative to `/Users/abu/dev/hackathon/metropolis`.

| Owner | Observed behavior / necessary extension |
|---|---|
| `packages/config/src/predictions.ts` | Polymarket Polygon (137) endpoints and Castora Monad (143) addresses; no Senryo-owned binary deployment |
| `packages/api-client/src/routes/predictions.ts` | Provider union only Polymarket/Castora; `execution` literally `view-only`; binary outcomes carry `tokenId`, no venue version, position ledger, execution quote or user holdings |
| `services/api/src/routes/predictions.ts` | Three public GET routes: list, detail and history; no authenticated trading lifecycle |
| `services/api/src/predictions/polymarket.ts` | Gamma discovery and Data API v2 outcome-price history; bounded caches, not execution/order authority |
| `services/api/src/predictions/castora.ts`, `packages/chain/src/prediction-reads.ts` | Finalized pool/paused reads, minimal original read ABI; not Up/Down trading or a reusable settlement engine |
| `packages/query/src/predictions.ts` | 20-second public refresh, independent of account; history only for Polymarket |
| `apps/mobile/src/features/predictions/{PredictionDetail,OutcomeChart,PredictionsList}.tsx` | Public discovery, outcomes, share-price history and rules. No native owned position/order/review/claim implementation |
| `packages/config/src/networks.ts`, `packages/chain/src/chains.ts` | Network types/config only 143 and 10143; current reserve constant 10 MON |
| `packages/account/src/policy/{decode,evaluate,typed-data,targets}.ts` | Positive transaction value is classified as `native-send` before calldata-specific decoding; session rejects it. Prediction payable buys cannot silently reuse pair-open authority. Foreign typed-data domains also require step-up |
| `apps/mobile/src/lib/account/{sender,step-up,terms-gate,relay-operation}.ts` | Existing protected signing, chain-specific nonce queues, operation recovery seams. Reuse these, including terms/account gating |
| `packages/chain/src/{journal,recovery,receipt-facts,send,fees}.ts` | Durable transaction lifecycle and reconciliation. Add prediction receipt facts, fee budgets and gas actions |
| `packages/query/src/{operations,activity-journal}.ts` | Durable operation/activity owners to extend; transaction journal retention alone is not permanent prediction history |
| `contracts/src/oracle/SessionOracle.sol` | Chainlink push-feed/session/circuit adapter for pair trading; its accepted latest value proves neither boundary of a short crypto prediction round |

## Official provider evidence

Current [Polymarket wallet documentation](https://docs.polymarket.com/trading/wallets-auth) describes signer-controlled Deposit Wallet creation through builder infrastructure, CLOB authentication and native programmatic wallet operations. This supports feasibility, not existing Senryo readiness. Builder credentials belong on a server; do not export the user's private key to reproduce documentation examples.

[Place Orders](https://docs.polymarket.com/trading/place-orders) distinguishes CTF token IDs and Protocol V2 position IDs and exposes market-order and limit-order paths, bid/ask books, minimum sizes, tick sizes and order status. The present `tokenId`-only Senryo schema is insufficient for this mixed ecosystem. A current public liquidity number is not a promised exit quote.

[Manage Positions](https://docs.polymarket.com/trading/positions/manage) supplies split/merge/redemption infrastructure. A complete adapter still needs deposits, authorization, buy/sell, partial fills, cancellation, durable order IDs, authenticated reconciliation, resolution disputes, redemption and withdrawal. Verify eligible markets and end-user eligibility under the current venue requirements; discovery access does not establish trading eligibility. This audit did not connect a venue account, verify jurisdiction acceptance, or measure live executable depth for a selected round.

The [documentation index](https://docs.polymarket.com/llms.txt) points to current pUSD, Protocol V2, Data API v2 and RTDS-to-PolyBolt migration material. Do not start from a historical USDC.e-only, old-CLOB or old-RTDS example. Several direct migration-page fetches failed in the research tool; the working current order/wallet pages already expose material version differences.

## Oracle and network evidence

Use Pyth **upgraded Core**, not its separate Pro verifier. The current [combined address table](https://docs.pyth.network/price-feeds/core/upgrade/contracts) lists:

| Network | Upgraded Core candidate | Observation |
|---|---|---|
| Monad testnet 10143 | `0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379` | Bytecode exists and BTC/ETH reads succeed |
| Monad mainnet 143 | `0xB754BA51E3861Ac0Cb67f73CD046dE790A36508d` | Bytecode exists and BTC/ETH reads succeed; no prediction deployment implied |

Feed IDs used in public reads:

- BTC/USD: `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`
- ETH/USD: `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`

Read results, all pinned to a finalized block using existing installed viem 2.57.0:

| RPC / block | Receiver | BTC publish time | ETH publish time | Block timestamp |
|---|---|---:|---:|---:|
| `https://testnet-rpc.monad.xyz` / 69170691 | Upgraded Core above | 1791436806 | 1791436806 | 1791436810 |
| Same testnet block | Older `0x2880aB155794e7179c9eE2e38200202908C17B43` | 1791403974 | 1791389257 | 1791436810 |
| `https://rpc.monad.xyz` / 111524969 | Upgraded Core above | 1791436810 | 1791436810 | 1791436812 |

Both upgraded Core proxies returned 177 bytes of runtime code. Both feeds returned exponent -8 and positive prices/confidence intervals. These reads establish deployed code and recent stored observations only; they do not establish historical proof verification, source uptime or settlement correctness. `eth_chainId` returned 10143/143 respectively. The table's Pro address `0xACeA761c27A909d4D3895128EBe6370FDE2dF481` has bytecode but `getPriceUnsafe` reverted on both networks, consistent with its different interface.

The [Monad oracle page](https://docs.monad.xyz/tooling-and-infra/oracles) still gives the older testnet receiver above. At observation it lagged roughly 9.1 hours for BTC and 13.2 hours for ETH. Prefer current provider deployment records plus actual reads over that older reference. Neither old nor fresh latest-price reads should resolve historical rounds.

[Pyth's migration guide](https://docs.pyth.network/price-feeds/core/upgrade/preparing) documents the August 26, 2026 upgrade, authenticated Hermes access and the new `https://pyth.dourolabs.app/hermes` endpoint. [Historical data guidance](https://docs.pyth.network/price-feeds/core/use-historical-price-data) likewise requires authentication for Benchmarks. Read-only unauthenticated requests for BTC timestamp 1791436800 returned HTTP 401 at all three URLs:

- `https://hermes.pyth.network/v2/updates/price/1791436800`
- `https://pyth.dourolabs.app/hermes/v2/updates/price/1791436800`
- `https://benchmarks.pyth.network/v1/updates/price/1791436800`

No keys were inspected or created. Payload acquisition and its actual account plan/retention/usage limits remain open. Consequently no signed historical-payload `eth_call` or representative update fee measurement was possible. Do not hardcode a 1-wei update fee or claim oracle settlement is already proven.

The [unique parser](https://api-reference.pyth.network/price-feeds/evm/parsePriceFeedUpdatesUnique) is the useful contract primitive: it enforces `prevPublishTime < boundary <= publishTime <= boundary + tolerance`. It identifies the first update at/after a boundary, not necessarily a print exactly at the requested second. `parsePriceFeedUpdates` alone permits selection among updates in its interval. Calling the unique parser pays `getUpdateFee(updateData)` and does not overwrite the latest shared price.

## Proposed original market semantics

This section is an independently proposed implementation, not claims about a deployed contract or copied provider source.

1. **Round identity:** immutable chain, contract, asset/feed ID, start `T0`, end `T1`, entry/exit cutoff, boundary tolerance, opening-proof deadline, resolution deadline, confidence rule, fees and payout rule. Use deterministic schedule IDs. Start with a versioned 5m/15m configuration only after recording parameters; these durations are candidates, not newly confirmed user choices.
2. **Open:** permissionless submission of the unique opening proof. Trading begins only after valid opening evidence is recorded and liquidity is funded. An opening deadline prevents activating a round after most of its duration has elapsed. Underlying display ticks remain distinct from the immutable opening strike.
3. **Boundary truth:** use the same first-at/after rule for both `T0` and `T1`, with fixed narrow maximum delay and positive bounded-confidence prices. Store feed, price, exponent, publish time and proof identity. Normalize signed integer prices safely before comparison. A bad earliest update must not permit picking the next favorable one; use the declared void policy if the required earliest observation fails quality criteria. Keeper submission time must never select the price.
4. **Cutoff:** forbid buys and sells at/after the declared on-chain cutoff, necessarily no later than `T1`; consider a short disclosed gap before expiry to reduce oracle-latency arbitrage. UI countdown is informational. No live Close after the cutoff. Preserve the held round when the next round appears.
5. **Resolution:** close greater than open pays Up 1 and Down 0 MON per whole share; close less than open reverses it. Proposed equal-price payout is 1/2 to each side. Confirm and version that rule before implementation rather than importing Polymarket's rule implicitly.
6. **Timeout/invalid evidence:** after a fixed deadline, anybody can finalize Void if a mandatory proof is missing/invalid under the precommitted rules. Use half-value redemption of both share classes so total liabilities stay collateralized. For tradable shares this is **void redemption, not full original-stake refund**: users bought/sold at different prices, and retroactive refund of all historical buyers double-counts collateral. State this explicitly in review/rules. If full entry-principal refunds are required, the model needs separate insurance/cost-basis design and is no longer this minimal fungible-share AMM. An unfunded/unopened round accepts no user trades, so there are no such stakes to refund.
7. **Claims:** finalize once, burn/account for claims once, permissionless settlement and self-claim, no mandatory operator co-signature. Credit payouts to a withdrawal balance before external MON transfer; guard reentrancy and let failed transfers remain claimable. Pausing new trades must not grant an admin the ability to seize collateral or permanently disable finalized claims.

## Smallest real liquidity and early-exit mechanism

An original round-specific internal share ledger avoids external ERC-1155 transfer hooks for the first native implementation. One MON collateral mints one Up plus one Down share, and a matched pair burns for one MON. Payout weights always sum to one. Users can buy either side and sell held shares back through the round AMM; no borrowed exposure or pair LP/card collateral is involved.

Seed both AMM reserves with complete sets funded by separately allocated test MON. Lock the initial liquidity through settlement/void to prevent withdrawal eliminating every exit mid-round. Quote actual reserve math, round cutoff, minimum shares/proceeds, expiry, fees and price impact. “Quote” is a read estimate with on-chain slippage bounds, not a guaranteed fill. Use atomic exact-input buy and exact-share sell first: each transaction fills completely or reverts, so no fake partial-fill state is needed for this route.

Possible integer formulation, with Up reserve `x`, Down reserve `y`, and zero fees solely to explain the math:

- Buy Up with `c` collateral: mint `c` complete sets; send the buyer `x + c - ceil(x*y/(y+c))` Up shares, retain remaining reserves. Real implementation separates any declared fee before applying the formula.
- Sell `s` Up shares: return the largest whole-wei amount `c` satisfying `(x+s-c)*(y-c) >= x*y`, positive remaining reserves and collateral bounds. Burn `c` matched pairs and credit `c` MON less the declared sell fee. Use proved bounded integer math (or a bounded monotonic search with measured gas), never floating-point approximations.
- Rounding favors solvency. Maximum exposure/payout and minimum reserves are explicit. Quote and execution use the same library. Fees, collateral, user withdrawable credits and liquidity ownership are separate accounting buckets.

The AMM price is an inventory-derived outcome price. It does not automatically track BTC's move or a statistical probability. A seeded 50/50 pool can be arbitraged as expiry approaches; quantify and cap treasury exposure and trade size. A separate market maker/rebalancer is an optional later price-quality improvement, not invented existing infrastructure. Very small reserves can produce terrible executable exits even though the contract supports selling. Test and display actual full-position proceeds; retain partial-close sizing for users where full close violates their slippage bound.

## Native account, gas, operation and history integration

Add a provider/market kind for owned Monad binary rounds without mutating Castora's meaning. Public market data and authenticated/user-specific holdings must be different schemas. Include chain/address/round identity in every query, quote, review, operation and activity item; include round state and cutoff in invalidation rules.

For initial execution use explicit reviewed passkey step-up through the existing sender. Add exact payable prediction decoding before generic native-send classification, including contract allowlist, round, side, recipient-self, `msg.value`, minimum output and deadline. Do not grant a broad unknown-call/session bypass. MON budgets must use integer wei, not the existing USD6 pair notional field. Keep Terms/Privacy and account/network checks.

The [Monad reserve specification](https://docs.monad.xyz/developer-essentials/reserve-balance) distinguishes ordinary reserve behavior and an undelegated-account emptying exception. Existing Senryo's conservative 10-MON reserve is a reasonable first budget boundary, especially for delegated accounts. Spendable MON subtracts reserve, pending operations, worst-case gas and any explicitly user-paid oracle fee. Do not offer Max = wallet balance. Keeper proof fees use a separate funded service budget by default; charge users only if review itemizes it.

Extend `operations.ts`, chain journal metadata and receipt facts with quote/review fingerprint, round, side, amounts, nonce/hash, purchased/sold shares, MON credit and claim identity. Reconcile by chain receipt and canonical events; app kill/network change never triggers a blind replacement order. All-in-one buy/sell execution is atomic, but transaction submission is still uncertain until receipt/finality. Record finality/reorg handling, duplicate event suppression and operation recovery. Account holdings plus an indexed event history outlive the short device transaction journal. Underlying price, inventory quote, cost basis, realized PnL and claimable MON stay distinct; never infer binary PnL from the BTC percentage move.

## Concrete implementation sequence and acceptance

1. Resolve historical-data access using an authorized Pyth account; pin SDK/interface and exact receiver generation. Fetch BTC/ETH proofs for both boundaries across several rounds. Read-only simulate unique parser plus real `getUpdateFee`, including missing boundary, wrong feed, wrong generation and conflicting-window failures. Record evidence and update-cost measurements. Keep mock fixtures clearly labeled.
2. Write a versioned round/risk specification: durations, cutoff, delays/deadlines, confidence limits, tie/void behavior, fees, liquidity seed, limits, role powers and finality. Confirm the void-redemption economic distinction; do not promise full-stake refunds for tradable positions.
3. Build original isolated Solidity ledger/AMM/oracle adapter and factory/registry as needed. Reuse suitably licensed utility libraries only; no Castora implementation copying. Test collateral conservation, payout bounds, invariant-preserving rounding, adversarial trade cycles, reserve exhaustion, cross-round isolation, cutoff/front-running, delayed/malformed proofs, timeouts, duplicate claims, failed transfers, reentrancy and permission boundaries.
4. Implement round discovery/history/indexing, proof acquisition/keeper with retained signed evidence, event fan-out, quote reads and balances. Keep permissionless on-chain settlement viable if the keeper is offline. API-key outages must lead to truthful delay/void behavior, never operator-chosen market prices.
5. Add native chart/review/approve/pending/position/reduce/claim/history flows using shared owners, with actual MON units and Practice labels. Test interrupted approval/send, expired quote, selected-round rollover, background reconnect, account/network switch and exactly-once receipt feedback.
6. Only after contracts and deployment parameters are concrete, perform the separately authorized testnet deployment/verification and liquidity funding. Record addresses, chain, source/bytecode, constructor config, roles, seed transactions and full in-app open/sell/settle/claim/void/recovery evidence. This research performed none of those writes.
7. Evaluate mainnet independently: receiver/proof endpoints, deployed contracts, funded liquidity and gas, service reliability, accounting/security review and actual user eligibility/distribution requirements. Existing fresh mainnet oracle reads alone prove none of those release gates.

Current blockers are specific and bounded: authenticated boundary-proof access/simulation, frozen economic parameters, original unimplemented contracts, separately funded liquidity, absent prediction account policy/operations/indexing/native flows, and unperformed deployed lifecycle validation. They do not justify trimming away native exit or replacing execution with a website link.

## Follow-up: continuous live proof capture instead of historical retrieval

A continuously running collector can remove dependence on **historical lookup**: retain signed live payloads, select the first proof satisfying `prevPublishTime < T <= publishTime <= T + tolerance`, and allow anyone to submit that exact verifiable proof later. Capture both opening and closing evidence redundantly; persist it before announcing a round ready. The contract must still enforce uniqueness. A collector's first observed tick is not necessarily the oracle's first qualifying tick after a reconnect.

This is viable settlement architecture with an explicit availability tradeoff: if every collector misses the required earliest proof and there is no archive/backfill, the round must follow the predetermined void path. Do not use a later tick merely because it fits the broad tolerance interval; the unique parser should reject it. Timeouts, permissionless submission, multiple collectors and advance closure reduce operational dependence but do not recover a lost signed payload. Price-only display streams cannot be transformed into oracle proofs.

It does **not currently remove the API credential requirement for the official Pyth live services tested**. Follow-up public GETs for BTC returned HTTP 401 at each of:

- `https://hermes.pyth.network/v2/updates/price/stream`
- `https://hermes.pyth.network/v2/updates/price/latest`
- `https://pyth.dourolabs.app/hermes/v2/updates/price/stream`
- `https://pyth.dourolabs.app/hermes/v2/updates/price/latest`

Each request supplied the full BTC feed ID above through `ids[]`. No authentication was supplied or bypassed. Thus “public live stream without a historical key” remains a hypothetical alternative data distribution arrangement, not an available endpoint verified by this audit. An authorized public redistribution/cache of signed payloads could make the app/keeper clients keyless while its upstream collector remains authenticated; verify access and distribution terms rather than assuming that is free. Public on-chain latest reads lack the signed boundary payload. Recovering payloads from third-party update transaction calldata is theoretically another research route but was not audited here and depends on those parties actually submitting the required first boundary observations.

Finally, call the timeout outcome a **void redemption** for the proposed fungible-share AMM. Half-value redemption conserves collateral but differs from refunding the original purchase cost; users who bought above or below half and users who already exited cannot all be made whole from the same locked collateral. A requirement for exact-principal refunds needs additional accounting/insurance economics and explicit acceptance before calling the minimal AMM complete.

## Follow-up: Chainlink push feeds and operator-signed alternatives

Fetched current Chainlink reference directories directly over HTTPS after web-tool JSON retrieval failed: [mainnet](https://reference-data-directory.vercel.app/feeds-monad-mainnet.json), [testnet](https://reference-data-directory.vercel.app/feeds-monad-testnet.json). The [official BTC page](https://data.chain.link/feeds/monad/monad/btc-usd) and [ETH page](https://data.chain.link/feeds/monad/monad/eth-usd) identify the standard mainnet feeds. Read-only `description`, `decimals`, `latestRoundData` and the preceding 12 `getRoundData` calls all succeeded at pinned finalized blocks:

| Network / asset | Standard proxy | Directory heartbeat / deviation | Latest `updatedAt` | Age at block | Last 12 update gaps |
|---|---|---|---:|---:|---|
| Mainnet BTC | `0xc1d4C3331635184fA4C3c22fb92211B2Ac9E0546` | 3600 s / 0.02% | 1791436987 | 15 s | 11–100 s |
| Mainnet ETH | `0x1B1414782B859871781bA3E4B0979b9ca57A0A04` | 3600 s / 0.05% | 1791436990 | 12 s | 30–202 s |
| Testnet BTC | `0x12C0F44368a02081ce58a936d1C1F606BB301715` | 86400 s / 0.5% | 1791433549 | 3460 s | 120–41132 s |
| Testnet ETH | `0x5c8c8482f064049248F86D9F4aFa4B1f2F5b6d31` | 86400 s / 0.5% | 1791436845 | 164 s | 330–18360 s |

All four return 8 decimals and the expected description. Mainnet block 111525596 timestamp 1791437002; testnet block 69171347 timestamp 1791437009. Latest round IDs respectively: BTC mainnet 18446744073710229185, ETH mainnet 18446744073710000383, BTC testnet 18446744073709552323, ETH testnet 18446744073709552718. Testnet directory entries have `docs.hidden: true`; do not interpret successful reads as production service guarantees.

Full observed gap lists (seconds, newest first):

- Mainnet BTC: 70, 90, 100, 21, 39, 21, 19, 40, 11, 40, 60, 90.
- Mainnet ETH: 202, 201, 200, 80, 91, 130, 140, 30, 40, 51, 49, 70.
- Testnet BTC: 240, 4410, 41132, 2490, 3930, 510, 1980, 14010, 14161, 12180, 120, 270.
- Testnet ETH: 2039, 1261, 330, 4350, 7290, 18360, 6931, 1410, 360, 5580, 6300, 1470.

This establishes working free on-chain history reads, but the testnet observations fail the desired narrow-boundary short-round behavior. Mainnet's recent frequent deviation-triggered updates do not guarantee an observation near every 5-minute boundary; the advertised one-hour heartbeat matters during quiet markets. Do not infer reliability from 12 intervals. Extending a boundary window to hours, or reusing the same old answer across many rounds, materially changes the product.

A transparent Chainlink alternative could define settlement as the first published completed round at/after each boundary within a specified tolerance, with permissionless callers supplying candidate IDs and the contract checking on-chain history. It must prove the candidate is the earliest qualifying valid round, including gaps and phase changes, not assume `roundId - 1` always exists. Pin/verify aggregator phases per round or void on unsupported migration; use bounded logic rather than unbounded historical loops. [Chainlink's historical guide](https://docs.chain.link/data-feeds/historical-data) documents proxy phase encoding and invalid/missing IDs. Its `updatedAt` is when an answer was computed, not necessarily the exact trade-price timestamp. Narrow windows would produce frequent voids on observed testnet data; this is a declared availability tradeoff, not a faithful smooth live short-round replacement.

An **explicit operator-signed source** can preserve predictable short-round scheduling using a named public venue/source and an original attestation verifier, but it changes the trust model: Senryo's operator chooses/signs observations and can lie, censor, disappear or be compromised. A signature proves operator authorization, not the underlying exchange's price truth. Specify source instrument (e.g. spot rather than perpetual), timestamp semantics, first-event selection, reconnect backfill, maximum age/deviation, tie/void rules, chain/contract/round-bound signatures, signer rotation only for future rounds, timeout and evidence retention. Pin these semantics in review and label it operator-resolved. A quorum reduces single-key failure only if the collectors/operators are actually independent. Public source permissions and end-to-end source latency still need verification.

Do not quietly replace Pyth with an operator key or relay mainnet Chainlink answers onto testnet and call the latter native Chainlink verification: the testnet contract would trust that relay unless supplied a separately verified cross-chain proof. For test-money UX validation, explicitly labeled operator resolution is a possible separate product decision. For an oracle-verified native testnet binary lifecycle, the upgraded Pyth route remains the best-supported candidate from this audit once authenticated payload access is available. No examined credential-free alternative presently demonstrates equally strong narrow-boundary BTC/ETH evidence and liveness on Monad testnet.
