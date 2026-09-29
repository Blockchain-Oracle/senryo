# 02-monad: Building on Monad (verified 2026-09-28)

## Monad in one screen
1. **Chains:** mainnet `143` (`https://rpc.monad.xyz`, monadvision.com / monadscan.com) and testnet `10143` (`https://testnet-rpc.monad.xyz`, faucet.monad.xyz). Currency MON, 18 decimals.
2. **Speed:** 300 ms blocks, speculative finality at 300 ms (`safe`), full finality at 600 ms (`finalized`), and a 150M block / 30M per-tx gas limit.
3. **EVM:** full Fusaka bytecode compatibility. Solidity `evmVersion: "osaka"`, **Foundry ≥1.8 with `network = "monad"`**, viem ≥2.40 (`monad`, `monadTestnet`).
4. **Gas:** you **pay for the gas LIMIT, not gas used.** Set `gas` explicitly, since a wallet's inflated fallback limit is a real cost. The min base fee is 100 gwei, so a swap costs about $0.0005.
5. **Reserve balance:** EOAs have a 10 MON buffer. A second MON-spending transaction within about 1.2 s that dips below 10 MON reverts. EIP-7702-delegated EOAs can never be spent below 10 MON. Freshly funded accounts must wait 3 blocks.
6. **Async execution:** receipts appear at `Proposed` (`latest`, speculative). Settle value at `finalized`, and bridges/exchanges wait for `Verified` (+3 blocks).
7. **State:** there's no arbitrary historical state (only ~40k blocks on normal nodes). `eth_getLogs` is capped at 100 blocks on the default RPC. Use events plus an indexer (Envio and others).
8. **EVM deltas:** 128 KB contracts, cold account access costs 10,100, storage is paged at 128 slots per page (MIP-8), memory is linear with an 8 MB cap, type-3 blobs are unsupported, and 3–4 blocks share one timestamp.
9. **Built-ins:** P256/passkey verification at `0x0100`, staking at `0x1000`, reserve check at `0x1001`, EntryPoints v0.6–v0.9, Multicall3, Permit2, CreateX, ERC-8004 registries, and an x402 facilitator.
10. **For agents and passkeys:** the docs MCP at `docs.monad.xyz/mcp` and `skill.md`, plus **Mera** (`@category-labs/mera`), which derives EOAs from passkeys. It is the target of two $2.5K bounties.

## Files
| File | What's inside |
|---|---|
| [network-and-endpoints.md](network-and-endpoints.md) | Chain IDs, all public RPCs with rate, batch, and getLogs limits, explorers, verifier URLs, paid providers, wallet params |
| [architecture-for-builders.md](architecture-for-builders.md) | MonadBFT, async/parallel execution, MonadDb/MIP-8, block states → which `blockTag` to use, tx lifecycle, staking precompile, MON basics |
| [differences-from-ethereum.md](differences-from-ethereum.md) | **Read first.** Gas-limit billing, reserve balance, historical state, getLogs, timestamps, opcode repricing, precompiles, 7702, AA, RPC quirks, tooling versions |
| [dev-quickstart.md](dev-quickstart.md) | Copy-paste Foundry/Hardhat 3/Remix/viem/wagmi setup, deploy, and verify (MonadVision + Monadscan), faucet, CI |
| [contracts-and-tokens.md](contracts-and-tokens.md) | Canonical contract addresses (mainnet + testnet), precompiles, token addresses (USDC, AUSD, USDT0, WETH, …), bridges |
| [realtime-data-and-indexing.md](realtime-data-and-indexing.md) | WebSocket `logs`/`monadLogs`/`monadNewHeads`, speculative data handling, Execution Events SDK, indexer options with configs |
| [mera.md](mera.md) | Everything about Mera: bounties, API, web/RN/extension code, "many keys" patterns, authenticator support, security model, prior art |
| [ai-and-dev-tooling.md](ai-and-dev-tooling.md) | llms.txt, docs MCP, skill.md, MCP tutorials, x402/MPP/ERC-8004, @monad-crypto packages, Ultrafuzz, templates |

## Top gotchas (short list)
1. Always pass explicit `gas`, because the limit is billed.
2. Keep test wallets above 10 MON, and don't chain several MON-spending transactions within 3 blocks.
3. Don't rely on `eth_call` at old blocks or wide `eth_getLogs` ranges. Index instead.
4. `latest` is speculative. Credit value on `finalized`.
5. Foundry without `network = "monad"`, or Hardhat without `evmVersion: "osaka"`, will give you wrong gas or size results. viem's `blockTime: 400` default is stale (the real value is 300).

## Doc inconsistencies noticed (as of 2026-09-28)
- The client version appears as v0.15.2 (network pages), v0.16.1 (ai/current-facts), and 0.16.4 (networks.json). Trust `networks.json`.
- The gas target is "80% (120M)" on the summary page, but the gas-pricing formula says `target = 160M`.
- The MONAD_FOUR changelog says the block gas limit went from 150M to 200M, but current facts say 150M. Trust current facts.
- The Socialscan explorer (monad.socialscan.io) is no longer listed in the docs (unverified whether it's maintained).

## Sources
https://docs.monad.xyz/llms.txt · https://docs.monad.xyz/ai/current-facts.md · https://docs.monad.xyz/developer-essentials/summary.md · per-file source lists at the bottom of each file.
