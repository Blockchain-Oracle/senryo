# Public on-chain Pyth boundary proof follow-up

8 October 2026. Read-only public RPC research; no credentials, authenticated endpoint requests, signing, funding, deployment, or broadcasts. Only research artifacts in this directory were written.

## Outcome

**Genuine unique-proof verification succeeded for BTC and ETH at two consecutive 900-second aligned boundaries, 1791441900 and 1791442800.** Exact public transaction accumulator bytes passed `parsePriceFeedUpdatesUnique(bytes[],bytes32[],uint64,uint64)` using `[T,T+5]` at the proposed upgraded Monad testnet receiver. Both observations have signed `previousPublishTime=T-1`, `publishTime=T`. This supplies real fixtures for adapter/fork work without acquiring API credentials.

**This is not a sufficient continuous production proof source.** Two sampled adjacent 300-second boundaries, 1791442500 and 1791443100, had their first sampled updated BTC observations at T+6 with signed previous=T+5. These payloads reverted for both BTC and ETH. No consecutive300-second pair was demonstrated. The two successful times are themselves300-second aligned, but this does not prove5-minute-round coverage. Missing-proof rounds must retain the frozen timeout/void behavior. No scan establishes global absence of an exact proof elsewhere; the bounded sampled updater did not supply one.

## Pinned receiver and evidence

- Public RPC: `https://testnet-rpc.monad.xyz`; `eth_chainId=10143`.
- Receiver: `0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379`; code length 177 bytes.
- Finalized simulation block: `69191891`, timestamp `1791443288`, hash `0x20dc4e6997614e9be7d3af692faa71659c787116aea14146b8cca5cb7be112f5`.
- Exact calldata, extracted `updateData`, payload keccak hashes, source block/hash, decoded records, parser return bytes and negative RPC responses are in `public-boundary-proofs.json`. Search-window logs are in `public-boundary-logs.json`.
- `public-boundary-check.cjs` reproduces the main fee/parser checks from the saved bounded logs using public reads. Run from the repository root. It re-pins finalized state on each run and replaces its output JSON, so copy evidence before rerunning if preserving this snapshot. Supplemental negative checks in the JSON were performed separately and are described below.

## Boundary results

| T (UTC) | Source block / timestamp | BTC / ETH result | Actual bundle fee |
|---|---|---|---|
| 1791441900 (2026-10-08T06:45:00+00:00) | 69187360 / 1791441901 | success / success | 0 wei |
| 1791442500 (2026-10-08T06:55:00+00:00) | 69189351 / 1791442509 | revert / revert | 0 wei |
| 1791442800 (2026-10-08T07:00:00+00:00) | 69190308 / 1791442801 | success / success | 0 wei |
| 1791443100 (2026-10-08T07:05:00+00:00) | 69191305 / 1791443108 | revert / revert | 0 wei |

The measured fee is **0 wei for these four complete five-feed bundles at the pinned receiver/block**. Query `getUpdateFee(actualProof)` for every submission; do not hardcode0 or infer unchanged future fees. These are eth_call simulations, not gas measurements or paid transactions.

| Boundary | Source transaction | Source block hash |
|---|---|---|
| 1791441900 | `0xfbf3dccb5e5314fd00506a7f3656553db0a9b77c01e1eb9d5233ea304ee5aca0` | `0xa6d583c3bf46fefe37438e4911c88ed0a4a68aba2e47a096f34f0cf3fdddbb14` |
| 1791442500 | `0xd0a6413181914b5a7a88c93adf60016cc073c32fabca24610f301dab132b162d` | `0x90f6d8afb58664e5dc57f84a2ac9709870abb81861dbca3c38e65230a72a5f42` |
| 1791442800 | `0x32a72258c431cac93aa5b7467be43b269feecc7fb3225e132b23de32e2fc6d31` | `0xd28cbc2272ad5dd77119a5fbb91c5dd39539cd046a41cfc4a5a1fce0dd6312ac` |
| 1791443100 | `0xb985916e03344456d7c37430e005c23081be30c7db197b9cfa1906f5950b6f08` | `0x7ab4e3afba0439f14cb3c8df340ae7d6840050b052b13054c975bfcfb720bfc0` |

## Exact signed observation metadata

BTC feed: `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`.
ETH feed: `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`.

| Boundary | Asset | Raw price | Raw confidence | Exponent | Publish | Previous | Confidence bps |
|---|---|---|---|---|---|---|---|
| 1791441900 | BTC | 8265038525243 | 3348474757 | -8 | 1791441900 | 1791441899 | 4.0514 |
| 1791441900 | ETH | 256071043642 | 129456358 | -8 | 1791441900 | 1791441899 | 5.0555 |
| 1791442500 | BTC | 8289675395489 | 2960204511 | -8 | 1791442506 | 1791442505 | 3.5710 |
| 1791442500 | ETH | 256977535646 | 138464354 | -8 | 1791442506 | 1791442505 | 5.3882 |
| 1791442800 | BTC | 8283108508438 | 3681491561 | -8 | 1791442800 | 1791442799 | 4.4446 |
| 1791442800 | ETH | 256533656200 | 141843797 | -8 | 1791442800 | 1791442799 | 5.5292 |
| 1791443100 | BTC | 8270239960378 | 3191339622 | -8 | 1791443106 | 1791443105 | 3.8588 |
| 1791443100 | ETH | 256054028416 | 146971584 | -8 | 1791443106 | 1791443105 | 5.7399 |

The four successful records satisfy the proposed adapter checks: positive price≤10^16, exponent−8, confidence≤25bps, publish time not in the future. Unique verification succeeded in the actual receiver. This is compatibility evidence for the proposed adapter input rules; the Senryo adapter contract itself was not deployed or invoked in this research. Failed-boundary records have otherwise acceptable price quality but are temporally invalid and must not substitute for missing evidence.

## Public calldata format and bounded extraction

1. Confirm receiver events using the official `PriceFeedUpdate(bytes32 indexed id,uint64 publishTime,int64 price,uint64 conf)` ABI. Initial151-block request was rejected with RPC−32614: range limited to100. One100-block recent discovery window succeeded.
2. Locate blocks near each of four fixed times using at most two timestamp interpolation reads per time. Fetch exactly100 blocks per boundary (`center−20` through `center+79`) with receiver+BTC event filter. No broad history scan was performed. Boundary centers and logs are retained.
3. For each boundary, choose the first sampled event with publish time≥T and retrieve its public transaction with `eth_getTransactionByHash`. Two updater recipients occur: failed-boundary candidates went to `0x9b35856cd35d57b154a8f644070bf18ffc8bfb75`, selector `0x57368ddf`; successful exact-boundary candidates went to `0x9508dcc6ec09975a4f8e3b0897c9b7a4592603f2`, selector `0xa3fb33ad`. Both ABI argument layouts decode as `(uint256[],bytes[])`, with numeric values 1 through 5 and one accumulator bundle. The wrapper function name/semantic meaning of those integers was not verified; no such assumption is needed to extract the second argument. Do not claim this wrapper ABI is an official Pyth SDK method.
4. Extract the second argument unchanged. Bundle begins `0x504e4155` (PNAU), version1.0. Decode the documented accumulator header, length-delimited Wormhole proof, count, length-delimited price messages and20-byte Merkle siblings. Read feed ID, price, confidence, exponent, publish and previous fields. Local decoding only identifies candidates; receiver verification establishes authenticity.
5. Call actual receiver `getUpdateFee(bytes[])`, then actual payable unique parser via `eth_call` with that fee and exact `[T,T+5]`, at one finalized block. Decode the canonical Pyth price-feed tuple result. No receiver storage or balances are changed by eth_call.

## Negative checks and important correction

- Same successful T=1791442800 proof with minimum1791442799 (equal to signed previous) and maximum1791442804 reverted `0x45805f5d`, `PriceFeedNotFoundWithinRange()`. The candidate publish time is within the interval, so this specifically exercises uniqueness.
- Zero/wrong feed ID at `[1791442800,1791442805]` also reverted `PriceFeedNotFoundWithinRange()`.
- T=1791443100 proof candidate published3106 and previous3105 (full epochs in table) reverted the same error for the frozen window. The corresponding2500 candidate likewise failed both assets.
- Older receiver `0x2880aB155794e7179c9eE2e38200202908C17B43` initially reverted at0wei with `0x025dbdd4`, `InsufficientFee()`. **After querying its own actual fee (5wei), the same BTC proof succeeded there too.** Therefore this sampled payload does not establish generation incompatibility; do not mislabel the initial fee error as invalid signatures/wrong-generation rejection. The proposed new address remains documented and directly verified, but older latest-price staleness is separate from parser acceptance.
- No malformed-signature mutation or new receiver gas estimate was attempted; those remain useful bounded Task4C checks.

## Remaining terms and availability constraints

This investigation reads publicly included transaction bytes over a public JSON-RPC endpoint. It neither accesses nor circumvents authenticated Hermes/Benchmarks services. Public observability and successful cryptographic verification do not establish a license to offer a public Pyth data redistribution/archive service. No applicable commercial caching, resale, redistribution or downstream API permission was verified. Confirm those permissions and any RPC provider retention/rate limits before turning this research into a data service.

An operational collector would depend on third-party submission choices, RPC indexing/availability and reorg handling. A current five-feed update cadence does not promise every first boundary observation, and the actual sample already contains missed5-minute boundaries. An archive of these public transactions cannot reconstruct signed payloads that were never submitted. Authenticated direct collection/backfill or a separately authorized distribution arrangement remains needed for dependable coverage; otherwise preserve missing-proof voids. Four selected boundary windows are not an availability distribution or SLA. Historical eth_call availability at this public RPC is also not guaranteed.

## Official references checked

- [Current Core address table](https://docs.pyth.network/price-feeds/core/upgrade/contracts): Monad testnet upgraded receiver and Core/Pro distinction.
- [Unique parser API](https://api-reference.pyth.network/price-feeds/evm/parsePriceFeedUpdatesUnique): first-at/after rule and payable fee requirement.
- [Official IPyth ABI](https://raw.githubusercontent.com/pyth-network/pyth-crosschain/main/target_chains/ethereum/sdk/solidity/IPyth.sol).
- [Official event ABI](https://raw.githubusercontent.com/pyth-network/pyth-crosschain/main/target_chains/ethereum/sdk/solidity/IPythEvents.sol).
- [Official accumulator parser](https://raw.githubusercontent.com/pyth-network/pyth-crosschain/main/target_chains/ethereum/contracts/contracts/pyth/PythAccumulator.sol): PNAU/message layout. GitHub main is a moving reference; actual receiver calls provide the decisive compatibility evidence in this snapshot.
