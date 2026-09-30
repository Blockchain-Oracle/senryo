# Acceptance evidence

Every chain action, deploy, spend and flow walk gets a row — including failures. Newest last. Public values only (no secrets).

| UTC | Stage | Scenario | Network (local/testnet/mainnet/sandbox/Coolify) | Flows / F-rows | Commit | Tx / deploy / artifact | Spend | Result |
|---|---|---|---|---|---|---|---|---|
| 2026-09-29T18:40Z | pre-S0 | Live Monad block time | mainnet (read) | — | — | 101 blocks / 30.5 s ≈ 302 ms | 0 | ok |
| 2026-09-29T18:45Z | pre-S0 | Chainlink XAU/USD round cadence (12 rounds) | mainnet (read) | D-020 | — | gaps 60–1081 s, ≈6 min avg | 0 | ok |
| 2026-09-29T18:46Z | pre-S0 | `eth_sendRawTransactionSync` exists | mainnet (read) | D-027 | — | code 5 (not -32601) | 0 | ok |
| 2026-09-29T18:50Z | pre-S0 | Uniswap v4 contracts have code (PoolManager, Quoter, UR 2.1.2, Permit2) | mainnet (read) | D-021 | — | 48021/12239/48763/18307 bytes | 0 | ok |
| 2026-09-30 | S2 | Foundry invariants I1–I7 + PerpMath fuzz + 20 oracle/calendar scenarios on merged main (`forge test --network monad`) | local | F-40, F-41, F-43, F-50 | e164ec9 | 28 passed / 0 failed; SenryoCore 40.6 KB | 0 | ok |
| 2026-09-30 | S2 | Testnet deploy of all contracts (`Deploy.s.sol`, ensure-style) | testnet | F-40, F-41, F-43, F-50 | 0cdd349 | 12 contracts, start block 66856078; `broadcast/Deploy.s.sol/10143/run-latest.json` | ≈2.93 testnet MON | ok |
| 2026-09-30 | S2 | Sourcify verification (all 12 incl. OZ AccessManager) | testnet | F-70 | 0cdd349 | exact_match ×12 | 0 | ok |
| 2026-09-30 | S1 | Domain senryo.xyz registered (namecheap-cli via Coolify static IP, D-051) | — | — | — | order 215459963 | $2.20 (user-approved ≤ ≈$2) | ok |
| 2026-09-30 | S3 | Coolify capacity baseline (read-only: `free -h`, `docker stats`, PSI) | Coolify | — | 57ab490 | 7.8 GiB total · 3.0 GiB available · swap 3.7/8 GiB used · 38 containers · akashi live · PSI some avg300 0.34 | 0 | ok → D-102 |
| 2026-09-30 | S5 | iOS dev build (EAS `development`, ad hoc; iPhone UDID …401C provisioned) | EAS | F-03, F-62 | 225231c | build 0ebf12c4-72c3-42dd-813a-4b1df4316a9b FINISHED (.ipa artifact) | 0 (EAS free tier) | ok — install on device pending (user) |
| 2026-09-30 | S4 | HyperSync token check (`POST /query`, blocks 66856078–80) | testnet + mainnet (read) | — | 225231c | HTTP 200 on monad-testnet + monad HyperSync | 0 | ok |
