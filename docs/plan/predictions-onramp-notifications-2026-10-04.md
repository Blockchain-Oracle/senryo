# Predictions, on-ramp and notifications — 4 October 2026

[Complete work register](reference-followthrough-2026-10-04.md) · [Prior mainnet plan](stage-08-rwa-mainnet.md)

## Prediction-market conclusion

There is a concrete Monad mainnet candidate to investigate: **Castora**. Its published implementation is a numerical price-prediction pool/contest. It does not establish a liquid binary Yes/No or Up/Down exchange matching the Phantom recording. The source and a read-only chain check establish enough to pursue compatibility; they do not establish an integration ready for Senryo users.

| Candidate | First-party evidence checked on 4 October | Consequence for Senryo |
|---|---|---|
| Castora | Public frontend defines Monad chain 143 and a Castora address; the address has nonempty code on 143. Published contracts describe pooled numeric predictions and admin winner assignment | Strongest verified Monad candidate in this pass. Evaluate a clearly named **price contest** flow. Live pool activity, deployed implementation/ABI, permitted stake assets, resolution reliability, fees, audit and account compatibility remain unverified |
| OPINION | Current SDK models document binary/categorical markets and supported chain IDs `[56]` | Useful binary-market product reference; checked documentation does not establish Monad execution |
| Trendle | Its introduction describes speculation on attention/sentiment rather than event outcomes | Adjacent product category; neither binary settlement nor Monad deployment was verified here |
| Solflare/DFlow/Kalshi | Solflare's official notice says predictions are temporarily paused after Kalshi restricted DFlow access; new purchases are unavailable | The supplied reference establishes UX, not an available or portable provider integration |

Sources: [Castora chain configuration](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/frontend/src/contexts/chains.ts), [frontend addresses](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/frontend/src/contexts/ContractContext.tsx), [contract model and settlement](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/contract/README.md), [OPINION models](https://docs.opinion.trade/developer-guide/opinion-clob-python-sdk/api-references/models), [Trendle introduction](https://docs.trendle.fi/), [Solflare pause notice](https://www.solflare.com/blog/solflare-prediction-markets-temporary-pause/).

### Reproducible Castora evidence and limits

- Repository revision: `6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643`, read-only checkout inspected; no provider code copied into Senryo.
- RPC: `https://rpc.monad.xyz`; `eth_chainId = 0x8f` (143).
- Checked block: `0x694ad47`; published Castora address `0x9E1e6f277dF3f2cD150Ae1E08b05f45B3297bE6D`.
- `eth_getCode` returned 130 bytes. Code SHA-256: `c9b5b5c3dc2f3eadfcb496dd7dce258068f2cea533bf3412fb3451b4f0066780`; no RPC errors. This is an existence check, not a verified proxy implementation, ABI, liquidity or successful settlement check.
- The contract documentation assigns winner identification off-chain and winner-setting to admins. It describes upgradeable contracts. The source declares `SPDX-License-Identifier: UNLICENSED`; do not assume source-copy permission. [Castora source](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/contract/src/Castora.sol)
- The provider website timed out during this pass. No live provider UI, pool transaction, audit or current operator identity was verified. Directory listings and compilation files named `mainnet` were not used as deployment proof.

### Recommended integration sequence

1. Confirm the deployed implementation and its ABI against the pinned published source. Read pool rules, allowed stake tokens, fees, entry deadlines, live/completed pools and claim state. Verify actual successful predictions and settlements from chain history; do not create a paid prediction for research.
2. Validate passkey account calls, native-token/ERC20 staking, allowances, gas sponsorship, geo/provider eligibility, admin/upgrade trust and refunds/disputes. Establish permission to use the integration and brand assets separately from source-copy permission.
3. Use a capability-specific adapter: discovery/detail/entry/position/claim for a contest; quote/buy/sell/redeem only for a verified outcome exchange. An unavailable sell capability must not become a fake Sell button. Stake/position balances belong to their actual chain/provider and must not be counted twice as wallet balance or engine collateral.
4. Build the proper ticket and durable operation lifecycle after the venue model is established. Show rules, cutoff, stake, fees and settlement authority at review. Distinguish entered, resolving, won/lost, claimable, claimed, refunded and failed. The exact transaction/finality/recovery requirements from the main contract apply.
5. Until then, leave execution unavailable. If a discovery entry is introduced, concise copy such as “Predictions · In development” can express intent; it must not imply a launch date, live liquidity or confirmed provider. No new entry was inserted into Markets in this source slice.

FT050–FT054/C24 are reopened for **evaluation**, amending their old exclusion only to this extent. This does not approve sports, an insider-attestation ceremony, or copying every provider-specific prediction feature. The original money/trade/issuer/mainnet plan remains the critical path.

## Fiat on-ramp conclusion

**Ramp is already the selected provider (D-247), and the newer source has hosted buying through `features/money/ramp.ts`.** Ramp's official Monad announcement identifies MON, USDC, AUSD and USDT0 on Monad for buying/selling/swapping. The live supported-assets documentation lists region exceptions; this is coverage evidence, not a successful quote for this user's country or payment method. [Monad announcement](https://rampnetwork.com/blog/monad-live-on-ramp-network), [asset and regional coverage](https://support.rampnetwork.com/en/articles/432-what-cryptoassets-does-ramp-network-support), [integration assets](https://docs.rampnetwork.com/assets).

A read-only call to the [public production asset catalogue](https://api.ramp.network/api/host-api/v3/assets) on 4 October returned MON (native, 18 decimals), USDC/AUSD/USDT0 (ERC-20, 6 decimals) with `chain: MONAD`, `enabled: true`, and `hidden: false`. The three ERC-20 addresses match `MAINNET_TOKENS` in this release. These catalogue rows confirm asset identity; they do not establish country-specific eligibility, a quote or payment finality.

The native flow opens the hosted provider page with the wallet destination and chosen asset. Buying has a keyless hosted fallback; bank cash-out names its support-issued key dependency. The browser return records an arrival with the asset's prior holdings, rather than crediting the balance as a completed payment. The exact asset code, country/payment eligibility, fees/minimum/expiry and completed/cancelled/refunded lifecycle still need real provider/device acceptance. Returning from the browser alone is not settlement.

Transak was considered in the initial older-branch investigation and supports native MON according to its official coverage/Monad announcement. It remains an alternative, not a replacement of the user's existing Ramp selection. No new provider account, paid partnership or real purchase was performed. [Transak coverage](https://transak.com/crypto-coverage), [Monad announcement](https://transak.com/blog/transak-integrates-monad-at-mainnet-launch-unlocking-global-access-to-mon).

## Notification implementation contract

### What exists in the release baseline

D-249's server ledger (`services/common/src/notifications.ts`) owns the inbox and queued deliveries. The mobile Home bell, `/notifications`, preferences and tap routing are present. Keeper delivery/retries/receipts cover money, card, fills, liquidation and level alerts. API social `notify.ts` also implements opt-in `followedTrades` for engine position openings, alongside follows/likes/replies. `feed-poller.ts` filters the actor's network sharing cutoff; the notification insertion filters current visibility, block/mute, enabled token preference and event age, with chain-prefixed unique keys. This is not a spot token purchase notification or a momentum detector.

Two source gaps are concrete: followed-open notifications run **after** the feed/cursor transaction as best effort, so a crash/failure can leave a committed feed event with no notification recovery; and privacy/follow filters are applied at recording, while the inspected push delivery path does not recheck them immediately before delivery. The current push opens the actor's profile rather than an immutable public trade detail. Preserve these as unfinished acceptance/implementation items, not claims of complete Fomo parity. Physical APNs/FCM delivery and killed-app/network taps remain acceptance work.

### Followed-trader events — completion contract

- Channel: explicit “Traders I follow” preference, independent of the owner's fill notifications. Permission request follows a useful opt-in; browsing does not authenticate or request push permission.
- Input: new finalized public fill events. Existing `services/api/src/social/feed.ts` visibility rules are the authority: listed on that chain, sharing enabled since the event, not moderation-hidden, not blocked either way or muted by the recipient. Recheck eligibility before delivery, not just at ingest. An engine open/increase is described as such; it must not be called a token purchase.
- Delivery: durable outbox and transactional cursor, not an in-memory loop or only a live socket. Unique key includes chain, venue, immutable fill identity, recipient and channel; duplicate/restarted ingest cannot enqueue twice. Bootstrap at the current finalized watermark and suppress old history. Turning sharing/follow/notifications back on never republishes historical trades.
- Copy: real handle, actual bought/opened/increased asset and network, with an authentic mark/verified avatar only where platform push supports them. No invented amount or price. Practice is explicit. A tap opens the exact public trade/profile in its network; if privacy changed, it opens a truthful unavailable state.
- Acceptance: duplicate/restart, private/unlisted/muted/blocked, sharing cutoff, unfollow race, chain collision, permission-denied, invalid token, receipt failure and foreground/background/killed-app tap. Spot purchase alerts need an actual spot-fill source; present engine feed alone is insufficient.

### Token momentum — new work

- Channel: explicit “Token momentum” preference with chosen assets/watchlist or a clearly explained discovery scope. Avoid a generic switch that has no producing job.
- A trigger needs a specified percentage/window plus sufficient actual liquidity and volume, a fresh reliable price source and chain/token identity. Compare eligible observations, not a single outlier. Do not treat an unpriced token as zero or a stale/empty market as pumping.
- Maintain a durable baseline, crossing/episode ID and cooldown per recipient/token/network; dedupe during catch-up/restarts. Suppress unavailable, stale, illiquid, unsupported or suspicious input. The threshold must be configurable and described before enabling; this pass does not invent universal numeric defaults without provider data.
- Copy reports the measured change and window (“… rose … in …”), rather than a guaranteed opportunity. Tap opens the actual token detail. Known capability/asset warnings stay in the detail/review instead of verbose push copy.
- Acceptance: stale baseline, clock/window boundary, low liquidity, missing price, event repetition/cooldown, rapid reversal, disabled preference, provider outage and network-specific taps. Source/API coverage is a prerequisite, not a reason to reuse engine oracle alerts for arbitrary tokens.

### Release order

First close delivery/tap acceptance for the existing pipeline and the followed-trader ingest/privacy gaps. Add genuine spot purchase events when their source exists, then momentum once trustworthy price/liquidity coverage exists. No new notification backend was changed or deployed in this layout/release pass. The complete retained work and its owners remain in the linked register.
