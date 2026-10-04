# Prediction continuation — 4 October 2026

The user delegated the provider/model sequence and explicitly retained every requested feature. This continuation amends the earlier evaluation-only boundary: build public prediction discovery now, then complete execution, positions and settlement when their actual prerequisites are satisfied. This does not close the full [work register](../../plan/reference-followthrough-2026-10-04.md).

## Product decision

Use two distinct adapters and market types. Polymarket supplies the reference-compatible binary BTC/ETH Up/Down and Yes/No price events. Castora supplies Monad numerical price contests. Public discovery is available in either Senryo money mode without authentication. The user's Practice/Mainnet setting, wallet balance and engine collateral remain independent of the external venue's settlement network.

The alternatives were a Castora-only contest interface, which would lose the binary reference contract; waiting for a verified Monad binary exchange, which would delay independently buildable discovery; or the selected staged two-adapter approach. The user authorized the agent to make this sequencing decision. Sports remains outside the selected product scope.

Markets gains Predict within its existing stack. Compact two-column cards open a detail page with real entity marks, event timing, outcome prices, observed/provider timestamps, source history, resolution rules and current state. Binary detail labels Polygon settlement; contests label Monad and their fixed stake, pool fee, snapshot deadline, entries, recorded winners/claims and operator/upgrade trust. Provider links are secondary. There is no pretend Buy/Sell/claim control, fabricated activity or implicit money-mode switch.

Predictions also join the existing Watchlist and Search. Long-press a card/row or use the detail's star; saved keys contain venue + immutable id and use the existing per-mode encrypted watchlist sync. Guests retain their list on this phone. Saved events remain addressable after leaving live discovery. Search's All/Predict views filter the bounded BTC/ETH 5m/15m/price-event and listed Monad contest selections; unavailable sources are disclosed independently. Only a venue/id goes into device-only recent searches. Prices/titles are fetched again, never restored as current money. Detail sharing opens the actual public provider URL. Saved rows and Search do not add one polling timer per market. Pull-refresh follows request completion.

## Fidelity ledger

| Contract | This continuation | Remaining work |
|---|---|---|
| FT050 / R2 16–23 s, discovery → BTC detail | Adapted: real BTC/ETH short-window cards, filters, public route, Watchlist, All/Predict Search and Recents | Phone-scale/VoiceOver/Android Back and encrypted cross-device restoration acceptance |
| FT051, expiry/target/chart | Adapted: precise start/end, 5m/15m windows, real outcome-price history and sample inspection | Reference's underlying price/target graph needs the exact settlement source; outcome history is explicitly labeled |
| FT052, detail/rules/sticky outcomes | Adapted: outcome values, resolution rules/source, resolved/disputed/pending states | Chat/moderation and a verified trading action surface remain open |
| FT054, amount/keypad/buy | Planned, execution dependency remains open | Provider eligibility, Polygon wallet/funding/signature/order flow, exact quote/fees/expiry, durable operations and receipts |
| C24, position/sell/claim lifecycle | Planned, retained | Actual holdings, cash-out where offered, settlement/redeem, cancellation/failure/recovery; no fake positions |
| Castora numeric contests | Additive, clearly distinct from binary outcome shares | Full deployed implementation/rules/operator/audit/eligibility/account compatibility and live-entry validation before entry/claim |

## Provider evidence

Polymarket's current primary [discovery](https://docs.polymarket.com/market-data/discover-markets), [market-details](https://docs.polymarket.com/market-data/market-details), [price/history](https://docs.polymarket.com/market-data/prices-order-books) and [contract](https://docs.polymarket.com/resources/contracts) documentation supports public reading and Polygon settlement. Live Gamma keyset discovery and Data API v2 history were checked. Scope is BTC/ETH price events; tags alone do not admit politics/sports. Exact prices 0 and 1 remain prices until explicit resolved state. Outcome values are indicative share prices, not an executable quote.

Castora public source remains pinned at `6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643`. At finalized Monad block `110441038` (timestamp `1791109234`), all 250 pools were read. No entry window was open. Stats reported 95 predictions, 44 winnings, 41 claimed and 3 claimable. These are provider counters, not Senryo users or independently reconciled payments. The last published pool's entry/snapshot deadlines had both passed. Proxy implementation slot returned `0x1cee4bfc463a7cc0016828bcc94e0592c850f97f`; owner returned `0x3961fe1541fc75fBbC3AdAEb018E65FE391333E0`, rules `0xfacA692BfeaFB4c6DCaF95a25E5CBCDB65d6eC41`, paused false. ABI-compatible reads and nonempty code do not prove full implementation equivalence, audit or liveness of future settlements.

The original Senryo read ABI contains only public signatures and tuple shapes. No Castora implementation was copied. The provider's prediction identifiers are not token contracts; MON staking uses the core-address sentinel. Unknown identifiers are not assigned known marks/decimals. Unlisted pools stay out of discovery and detail. Expired empty pools do not appear as activity. Reads pin one finalized block; scans cap at 500 and disclose partial coverage if the venue grows beyond that.

## Verification and release

23 deterministic backend/parser/route checks pass, including zero/missing/malformed/out-of-range prices, false resolution, disputes, private/unknown contests, cache coalescing, input bounds, 404 scope, Data v2 history bounds/deduplication, public codec round-trip and honest 503 outages. No UI tests, user transaction, account creation or real-money prediction was performed.

The first live smoke returned 22 short 15m markets, 64 short 5m markets, 100 Yes/No price-event rows, 10 recently resolved BTC markets and 41 Castora contests with entries. These counts are point-in-time observations, not product metrics or promised liquidity. History returned actual observations; a chart needs at least two distinct samples.

API deployment `mcwcfsslgazxoty6kugo0pyy` finished with `ghcr.io/blockchain-oracle/senryo-api:sha-b28f3f6`, OCI revision `b28f3f64cf79ec2587b432d10cb0ae727bf63cce`, digest `sha256:a79195b4b11073dd1c49a2f0e17197aa35502fcdb40512ffbf0d407c184511e8`. The replacement container was healthy; health/readiness, public list/detail/history, resolved records and invalid-input behavior passed against production. `/v1/config` still advertises only Practice 10143. Card and keeper remain on `sha-34b2af3`. API rollback is that prior image.

iOS and Android Hermes export, affected workspace typechecks, scoped Biome and invariants (0 errors / 0 warnings) passed. The production-environment native fingerprint `02a36e4747eb112b55c3513367b4649727020616` exactly matches TestFlight `0.3.0 (7)`. No native dependency/configuration changed. The first iOS OTA, source `50a73f51e3155ecd29f13e0f1ee7f99417393749`, published as group `316ed01a-a99c-41bd-8d33-db0895cec876`, update `01a10680-8e8d-7ed1-9c16-e90154096b1d`, production branch/runtime `0.3.0`. EAS view and the actual production-channel Expo manifest returned that id/runtime.

The saved/search continuation supersedes it: source `848ca5e54dd4ac1f43faf0338263d60fe66f99a0`, iOS OTA group `a5f2ae78-147d-4dc4-af0c-c67556b1eea1`, update `01a1068a-b78e-7fca-b229-628176b32a89`, published 10:51:56 UTC on production/runtime `0.3.0`. EAS view confirms the release, and a fresh actual production-channel Expo manifest returned HTTP 200 with that exact update id/runtime. Install/update TestFlight build 7, then relaunch so the compatible update can download/apply; its presence on the physical phone has not been observed. Android export passed but no Android OTA was published in this continuation. Client rollback is the prior compatible group above, or build 7's embedded bundle.

Physical-phone acceptance remains unobserved. No source push, real-money transaction, production issuer enablement or App Store production release was performed. The retained execution/positions/sell/claim lifecycle is not implemented by public discovery.

The saved/search continuation passes mobile/query typechecks, scoped Biome (16 files), invariants (0/0), and fresh iOS + Android Hermes exports. A temporary pure-data check passed 12 assertions covering restored venue/id keys, malformed/unsupported identities, over-limit ids, multi-word matching, Unicode normalization and asset/network aliases. This is not a UI or cross-device synchronization test. No additional native modules or dependencies were introduced.

One canonical Git worktree remains. Owned temporary provider checkout, service artifacts, local release images and export output are removed after publishing; the Git recovery bundle and safe release metadata are refreshed in `/Users/abu/.codex/archives/metropolis-20261004`. No unrelated checkout, local container or provider credential is removed.
