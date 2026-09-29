# Acceptance evidence

Every chain action, deploy, spend and flow walk gets a row — including failures. Newest last. Public values only (no secrets).

| UTC | Stage | Scenario | Network (local/testnet/mainnet/sandbox/Coolify) | Flows / F-rows | Commit | Tx / deploy / artifact | Spend | Result |
|---|---|---|---|---|---|---|---|---|
| 2026-09-29T18:40Z | pre-S0 | Live Monad block time | mainnet (read) | — | — | 101 blocks / 30.5 s ≈ 302 ms | 0 | ok |
| 2026-09-29T18:45Z | pre-S0 | Chainlink XAU/USD round cadence (12 rounds) | mainnet (read) | D-020 | — | gaps 60–1081 s, ≈6 min avg | 0 | ok |
| 2026-09-29T18:46Z | pre-S0 | `eth_sendRawTransactionSync` exists | mainnet (read) | D-027 | — | code 5 (not -32601) | 0 | ok |
| 2026-09-29T18:50Z | pre-S0 | Uniswap v4 contracts have code (PoolManager, Quoter, UR 2.1.2, Permit2) | mainnet (read) | D-021 | — | 48021/12239/48763/18307 bytes | 0 | ok |
