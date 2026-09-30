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
| 2026-09-30T05:17Z | S3 | Fund testnet keeper 0xf6a3…3b10 (0.35 MON) from deployer | testnet | — | 36e884e | 0x121a0afd5229a7a0c51c9ff86746a203515753de522c73e124775385ae95606c | 0.35 tMON + gas | ok |
| 2026-09-30T05:17Z | S3 | Fund testnet trader 0xBa0b…A061 (0.15 MON) from deployer | testnet | — | 36e884e | 0xde38bce3b94bba78be417f6c29c00fac23447453900742912a105c8f44ac0a19 | 0.15 tMON + gas | ok |
| 2026-09-30T05:18Z | S3 | AccessManager.grantRole(MIRROR_ROLE 70 → keeper) | testnet | F-41 | 36e884e | 0x8b1ed4db122d36b67109448a1b964af9fdd9f4a342ec828fc35143a04a99fd0f | 80k gas | ok |
| 2026-09-30T05:20Z | S3 | `@senryo/chain` live send: MirrorXAU.pushAnswer(mainnet XAU 4,176.36) → finalized in 1.8 s; SessionOracle.observe(0) → finalized in 1.2 s; XAU status STALE → OPEN | testnet | F-41 | 36e884e | push 0x12d66e550b9111c5e50bc94243401074686b1f0c849ea72ce6ba0924ab1cb2dc · observe 0xbbb2f7e3230305ba691508afc5d2126b9babf0d04fe8e913b9b09d16629bb659 | 131k + 148k gas | ok |
| 2026-09-30T04:30Z | S3 | Ledger migrations 0001+0002 on local Postgres 17 (Docker), re-run no-op, then re-applied after clearing `schema_migrations` (idempotent SQL) | local | — | (this commit) | 19 tables incl. schema_migrations | 0 | ok |
