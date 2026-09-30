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
| 2026-09-30 | S5 | Android dev build (EAS `development`, APK) | EAS | F-03, F-62 | bb91622 | build e8d03e99-197e-4c8a-a3a5-cb05591d8c76 FINISHED; cert SHA-256 E4:89:…:B1:A5 (v2 block) | 0 (EAS free tier) | ok — install on device pending (user) |
| 2026-09-30 | S0 | Portal registration: project created, Track 01, bounties selected (user) | portal | — | 367857b | project "Senryo 千両"; Agora Onchain Trading · Mera-Powered UX · Aurora Intents · Envio | 0 | ok (user-reported) |
| 2026-09-30T04:40Z | S4 | Perpl cursor pairing replayed on real mainnet logs (`pnpm check:perpl-cursor`, 30 windows × 100 blocks over the last 300k blocks) | mainnet (read) | F-32 | 23563ac | 1,438 Position* · 879 maker + 559 taker fills · paired 1,438/1,438 · unattributed 0 | 0 | ok |
| 2026-09-30T05:01Z | S4 | Indexer full re-index to head on HyperSync (`envio dev -r`, 143 + 10143) | mainnet + testnet (read) | F-30, F-31 | 7ccab6d | both chains `isReady` in 41 s after storage init; 62,243 events on 143 (21,325 oracle rounds, 15,074 Perpl fills paired, 0 unattributed); 48 on 10143 | 0 | ok |
| 2026-09-30T05:05Z | S4 | Portfolio + history via `@senryo/indexer-client` (smoke script) on testnet drive data: deposit 6 AUSD → XAU long (tx 0x9baec89c…d35f) → keeper liquidation (tx 0x6b44a112…c4c3) | testnet (local indexer) | F-33 | 7ccab6d | user 0xba0b…a061: equity 1.080893 AUSD = archive `account()` balance, position LIQUIDATED, penalty 0.435404, liquidator fee 0.217702; candles/markets/stats parse | 0 | ok |
| 2026-09-30T05:08Z | S4 | HyperSync pool analytics, last 7 days (`pnpm hypersync:pools --days 7`) | mainnet (read) | F-35 | 7ccab6d | 2,016,000 blocks · $87.36M maker-side volume · 474,002 fills · 93 liquidations (BTC $51.8M, ETH $10.9M, SOL $8.0M, MON $7.1M) | 0 | ok |
| 2026-09-30T05:24Z | S4 | Coolify-adapted compose smoke (`docker-compose.yaml` + local ports override): build, healthy, sync to head, public-role query | local Docker | F-30 | S4.6 commit | 3/3 healthy; `/healthz` 200 on 9898; Hasura console 404; at head: indexer 423 MiB / 800, Hasura 219 / 384, Postgres 67 / 512; missing `${VAR:?}` blocks `compose config`; first sync 10 min (dev indexer polling the same token concurrently — unverified cause) | 0 | ok |
