# Monad stack facts for the prediction market (checked 8 Oct 2026)

Sources were checked live with `cast`, Hermes, Context7 (`ctx7`) and the official docs. URLs are inline.

## Chain

- **Chain ids:** 143 (mainnet) and 10143 (testnet).
- **Blocks:** about 300 ms (302 ms measured over 10k blocks). Full finality is about 600 ms. `latest` is only *proposed*, so use `finalized` for money reads, cursors and settlement.
- **Gas:**
  - You pay the **gas limit**, not gas used ([gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing.md)), so always set explicit, tight limits.
  - Base fee 100 gwei; tip hard-coded at 2 gwei. A 400k-limit call costs about 0.041 MON ≈ $0.001 at MON $0.0251.
  - A new storage slot costs 17k gas. A transaction can use up to 30M gas; a block holds 150M.
- **Contract size:** code up to 128 KB, initcode up to 256 KB.
- **Timestamps** have 1 s granularity: 3–4 blocks share one. Boundaries are set by Pyth `publish_time`, never by block.
- **Reserve balance** ([docs](https://docs.monad.xyz/developer-essentials/reserve-balance.md)):
  - Fees in flight for an account (k = 3 blocks) must stay below min(10 MON, balance). Keep each sponsor key at ≥ 12 MON.
  - A 7702-delegated EOA can't make a value-decreasing transaction that leaves it under 10 MON.
- **RPC** ([overview](https://docs.monad.xyz/reference/json-rpc/overview.md)):
  - `wss://rpc.monad.xyz` (QuickNode, 25 rps), `rpc1` (Alchemy), `rpc2` (Goldsky, archive), `rpc-mainnet.monadinfra.com`.
  - `eth_getLogs` is limited to 100 blocks on QuickNode and the Monad Foundation RPC, and to 1,000 on Alchemy. monadinfra rejects both getLogs and batches.
  - Subscriptions: `newHeads`, `logs`, `monadNewHeads`, `monadLogs`.
- **Testnet MON faucet:** https://faucet.monad.xyz.
- **Account abstraction:**
  - EntryPoint v0.6–0.9 at the standard addresses on both networks; EIP-7702 supported; P-256 verify precompile at `0x0100` (6,900 gas).
  - Simple7702Account `0xe6Cae83BdE06E4c305530e199D7217f42808555B` exists on both networks. `0x4Cd241E8…` in `packages/account/src/delegation.ts` exists on **mainnet only**.
- **Phantom dropped Monad on 26 Aug 2026.** For external wallets: MetaMask, Rabby, Backpack, OKX, Coinbase.

## Pyth (settlement and display)

- **Pyth Core receivers** ([table](https://docs.pyth.network/price-feeds/core/upgrade/contracts)):
  - Testnet `0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379` (fresh). `0x2880…` also exists on testnet but is about 3.5 h stale.
  - Mainnet: Pyth's table lists `0xB754BA51E3861Ac0Cb67f73CD046dE790A36508d`; Monad's registry lists `0x2880aB155794e7179c9eE2e38200202908C17B43`. Test a keyed payload against both before choosing.
  - Pyth Pro (formerly Lazer): `0xACeA761c27A909d4D3895128EBe6370FDE2dF481`.
- **Update fee:** 0 (OP-PIP-128).
- **Settlement:** `parsePriceFeedUpdatesUnique(updates, ids, T, T+5)` returns the unique update with `prev_publish_time < T ≤ publish_time`. Already implemented in `contracts/src/predictions/PythBoundaryOracle.sol`.
- **Hermes is paid since 26 Aug 2026.**
  - Starter is $500/month: all crypto, ≤ 1 s updates, "Redistribution: Not permitted".
  - Pro is from $2,500/month (equities; Pyth's blog says about $5k/month for US equities).
  - Keyed rate limits are not published. Public: 10 requests per 10 s per IP.
  - Streams close themselves after 24 h. Hermes keeps about 640 s of history in memory, so archive boundaries immediately.
- **Our keys** (8 Oct): Senryo's and Agari's both return **BTC and TSLA** live, plus the exact 1-minute boundary (`publish = T`, `prev = T−1`). **MON/USD returns 403 (not entitled).**
- **Feed IDs:**

  | Asset | Feed ID |
  |---|---|
  | BTC | `e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
  | ETH | `ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
  | SOL | `ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
  | MON | `31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1` (403 on our key) |
  | TSLA | `16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1` |
  | NVDA | `b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593` |
  | AAPL | `49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688` |
  | QQQ | `9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d` |
  | SPY | `19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5` |
  | EUR/USD | `a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b` |
  | XAU/USD | `765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2` |

- **Equity hours:** feeds follow regular hours only (09:30–16:00 ET on NYSE days). Out of hours the parser returns `PriceFeedNotFoundWithinRange`. Pre-market, post-market and overnight are a Pro-tier offering.
- **Free sponsored push feeds on mainnet:** BTC, ETH, SOL and MON at a 1 h heartbeat and 0.1% deviation. Too coarse to settle 1-minute windows; fine as a sanity check, and as the labelled MON-market source on 15 m+ cadences.

## Other oracles on Monad (references)

- **Chainlink Data Feeds (mainnet):**
  - BTC/USD `0xc1d4C3331635184fA4C3c22fb92211B2Ac9E0546`, ETH `0x1B1414782B859871781bA3E4B0979b9ca57A0A04`, SOL `0x16F8008c3e89f62e5e2b909Ce70999370D38F4F2`, MON/USD `0xBcD78f76005B7515837af6b50c7C52BCf73822fb`; also FX, XAU, XAG.
  - Equities only as tokenised feeds (wTSLAx `0xE42022cCe1913626AE4297B99291d3Ba24Cc9281`, wSPYx `0x2e2dA5717eDE960F8b77Af4cFcBDC4Ca3099006D`).
  - Testnet has only BTC, ETH, LINK, USDC and USDT, at 0.5% deviation and 24 h heartbeat.
- **Chainlink Data Streams:** verifier proxy `0xEd813D895457907399E41D36Ec0bE103E32148c8`; paid (reportedly $150 per stream per month); no testnet verifier found.
- **RedStone:** pull gateway, 10 s-aligned packages, TSLA, NVDA, AAPL, AMZN, GOOGL and META; now keyed (1 rps).
- **Stork:** `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62`.
- **Supra:** push `0x58e158c7…`, pull `0x16f70cAD…`.
- **Chronicle:** push only.
- **Chainlink CRE** supports Monad 143 and 10143; selectors and forwarders are in `cre-setup-2026-10-08.md`.

## USDC

- **Mainnet:** Circle USDC `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`.
- **Testnet:** `0x534b2f3A21130d7a60830c2Df862319e593943A3`.
- Both are name "USDC", version "2", 6 decimals, and support **EIP-2612 permit** and **EIP-3009** (`authorizationState`).
- CCTP domain 15.
- Circle's faucet gives 20 USDC per address every 2 h, behind reCAPTCHA, so it can't fund users at scale. That's why we have our own Test USD.

## External wallets

- Reown AppKit:
  - web `@reown/appkit@1.8.24` + `@reown/appkit-adapter-wagmi@1.8.24` (wagmi 3.7.7);
  - RN `@reown/appkit-react-native@2.0.6` (wagmi 2.19.5, native modules, so after judging).
- Chains come from `viem/chains` `monad` and `monadTestnet`; override `blockTime` to 300.

## Prediction-market mechanisms (references)

| Product | Mechanism | Settlement |
|---|---|---|
| Polymarket 15-min Up/Down | order book; "Up if end ≥ start" | Chainlink Data Stream |
| Kalshi | order book | 60 s average of CF Benchmarks BRTI |
| Limitless (Base) | order book | — |
| Thales / Overtime Speed Markets | fixed odds against an LP pool | Pyth |
| DeepBook Predict (Sui) | LP vault as counterparty | — |
| PancakeSwap Prediction | parimutuel 5-min rounds | Chainlink |

On Monad: Levr Bet (sports), Kizzy, CRSH, Nad.fun Predict, Blinq, GuessOne. Castora mainnet core `0x9E1e6f27…bE6D` runs a numeric contest, not Up/Down.
