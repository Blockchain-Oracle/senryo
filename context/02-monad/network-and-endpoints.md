# Monad Network & Endpoints

> Verified against docs.monad.xyz on 2026-09-28, with live `eth_chainId` checks against both public RPCs.
> The docs themselves say: **live docs override model memory**. For versions, check `https://docs.monad.xyz/networks.json`.

## Quick table

| | **Mainnet** | **Testnet** |
|---|---|---|
| Network name | `Monad Mainnet` | `Monad Testnet` |
| Chain ID | `143` (`0x8f`) | `10143` (`0x279f`) |
| Currency | `MON` (18 decimals) | `MON` (testnet) |
| Default public RPC | `https://rpc.monad.xyz` | `https://testnet-rpc.monad.xyz` |
| Default public WS | `wss://rpc.monad.xyz` | `wss://testnet-rpc.monad.xyz` |
| Explorers | https://monadvision.com (BlockVision), https://monadscan.com (Etherscan) | https://testnet.monadvision.com, https://testnet.monadscan.com |
| Network visualizer | https://gmonads.com | https://www.gmonads.com/?network=testnet |
| Faucet | n/a | https://faucet.monad.xyz |
| App hub | n/a | https://testnet.monad.xyz |
| Revision | `MONAD_TEN` (MIP-8 page storage) | `MONAD_TEN` |
| Client version | `0.16.4` per networks.json (docs pages also say v0.16.1 or v0.15.2; they are out of sync) | `0.16.3` per networks.json |

**Watch out:** the testnet RPC is `testnet-rpc.monad.xyz`, not `rpc.testnet.monad.xyz`. The testnet was **reset from genesis on 2025-12-16**, so old testnet addresses from tutorials are gone.

## Performance and limits (canonical, from `/ai/current-facts`)

| Metric | Value |
|---|---|
| Block time | **300 ms** (mean about 302 ms in Sep 2026) |
| Speculative finality | 300 ms (1 slot, block is `Voted`) |
| Full finality | **600 ms** (2 slots, block is `Finalized`) |
| State-root "Verified" | Finalized + 3 blocks (about 1.5 s after proposal) |
| Block gas limit | 150M gas |
| Block gas target | 80% (the summary page says 120M; the gas-pricing formula uses 160M, so the docs disagree) |
| Per-tx gas limit | **30M gas** |
| Gas throughput | 500M gas/s |
| Throughput | 10,000+ TPS (design capacity) |
| Max txs/block | ~3,750 |
| Min base fee | 100 MON-gwei. Live `eth_gasPrice` returned about 102 gwei on 2026-09-28 |
| `eth_maxPriorityFeePerGas` | hardcoded 2 gwei (temporary) |
| Delay factor k (D) | 3 blocks |

The viem chain objects `monad` and `monadTestnet` still say `blockTime: 400`. That value is stale; the real block time is 300 ms. See dev-quickstart.

## Public RPC endpoints: Mainnet

| URL | Provider | Rate limit | Batch limit | Notes |
|---|---|---|---|---|
| `https://rpc.monad.xyz` / `wss://rpc.monad.xyz` | QuickNode | 25 rps | 100 | default |
| `https://rpc1.monad.xyz` / `wss://…` | Alchemy | 15 rps | 100 | `debug_`/`trace_` disabled |
| `https://rpc2.monad.xyz` / `wss://…` | Goldsky Edge | 300 / 10s | 10 | **historical state** lookups (`eth_call` at old blocks) supported |
| `https://rpc3.monad.xyz` / `wss://…` | Ankr | 300 / 10s | 10 | `debug_` disabled |
| `https://rpc-mainnet.monadinfra.com` / `wss://…` | Monad Foundation | 20 rps | **1** | **historical state** supported (eth_call, getBalance, getCode, getStorageAt, getTransactionCount, estimateGas, createAccessList, debug_traceCall) |

## Public RPC endpoints: Testnet

| URL | Provider | Rate limit | Batch | Archive | Notes |
|---|---|---|---|---|---|
| `https://testnet-rpc.monad.xyz` / `wss://…` | QuickNode | 50 rps | 100 | yes | 25 rps for `eth_call`/`eth_estimateGas` |
| `https://rpc.ankr.com/monad_testnet` | Ankr | 300/10s; 12,000/10min | 100 | no | no `debug_*` |
| `https://rpc-testnet.monadinfra.com` / `wss://…` | Monad Foundation | 20 rps | not allowed | yes | |

## Per-method provider limits (mainnet)

| | QuickNode `rpc` | Alchemy `rpc1` | Ankr `rpc3` | MF `monadinfra` |
|---|---|---|---|---|
| `eth_call`/`estimateGas` gas cap | 200M | 200M | 1B | 200M |
| `eth_getLogs` block range | **100 blocks** | 1,000 blocks / 10k logs | 1,000 | **100** |

At 300 ms per block, 100 blocks is only about 30 seconds of chain history per `eth_getLogs` call. Use an indexer for anything beyond that (see realtime-data-and-indexing.md).

`eth_call` has two execution pools: calls with gas ≤ 8.1M go to the high-concurrency pool, larger calls to the limited pool. If you don't set a gas value, the call runs in the low pool first and is retried in the high pool.

## Paid / higher-limit RPC providers (from docs)
Alchemy, Ankr, Blockdaemon, BlockPI, BoltRPC, Chainstack, dRPC NodeCloud, Dwellir, Envio HyperRPC (read-only, data-heavy methods), GetBlock, Node101, OnFinality, QuickNode, Spectrum, Tatum, thirdweb RPC Edge, Triton One, Validation Cloud. For the hackathon, Alchemy is also a sponsor ($1K credits bounty).

## Explorers

| Explorer | Mainnet | Testnet | Verifier API |
|---|---|---|---|
| MonadVision (BlockVision) | monadvision.com | testnet.monadvision.com | Sourcify: `https://sourcify-api-monad.blockvision.org` |
| Monadscan (Etherscan) | monadscan.com | testnet.monadscan.com | Etherscan v2: `https://api.etherscan.io/v2/api?chainid=143` (or `10143`). Explorers page also lists `https://api.monadscan.com/api` and `https://api-testnet.monadscan.com/api` |
| Socialscan | monad.socialscan.io (unverified: returned HTTP 429, and no longer listed in the docs) | monad-testnet.socialscan.io (unverified) | n/a |
| JiffyScan (UserOps) | jiffyscan.xyz/?network=monad | | |
| Tenderly | dashboard.tenderly.co/explorer | | traces/sim |
| Blocksec Phalcon | blocksec.com/explorer | | traces |

## Add to wallet (EIP-3085 params)
```json
{ "chainId": "0x8f", "chainName": "Monad Mainnet", "nativeCurrency": {"name":"MON","symbol":"MON","decimals":18},
  "rpcUrls": ["https://rpc.monad.xyz"], "blockExplorerUrls": ["https://monadvision.com"] }
{ "chainId": "0x279f", "chainName": "Monad Testnet", "nativeCurrency": {"name":"MON","symbol":"MON","decimals":18},
  "rpcUrls": ["https://testnet-rpc.monad.xyz"], "blockExplorerUrls": ["https://testnet.monadvision.com"] }
```

## Official links / help
- Docs: https://docs.monad.xyz (llms.txt, llms-full.txt, `/mcp`, `/skill.md`; see ai-and-dev-tooling.md)
- Dev Discord: https://discord.gg/monaddev
- Source: consensus `github.com/category-labs/monad-bft`, execution `github.com/category-labs/monad`
- MIPs: https://mips.monad.xyz
- Security / bug bounty: Cantina (docs.monad.xyz/security)

## Sources
- https://docs.monad.xyz/ai/current-facts.md
- https://docs.monad.xyz/developer-essentials/network-information/index.md
- https://docs.monad.xyz/developer-essentials/testnet.md
- https://docs.monad.xyz/developer-essentials/summary.md
- https://docs.monad.xyz/reference/json-rpc/overview.md
- https://docs.monad.xyz/tooling-and-infra/rpc-providers.md
- https://docs.monad.xyz/tooling-and-infra/block-explorers.md
- https://docs.monad.xyz/networks.json
- https://github.com/wevm/viem/blob/main/src/chains/definitions/monad.ts
