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
| 2026-09-30 | S6 | Targeted checks `pnpm --filter @senryo/account check`: derivation parity (web JS PBKDF2 == native pbkdf2Sync path == standard wallet import, fixed vector), session-policy scope, scoped signer, StarterDrip typed data == OZ digest | local | F-02, F-11 | dff168f | 26 passed / 0 failed | 0 | ok |
| 2026-09-30 | S6 | Web passkey flows in real Chrome (CDP virtual authenticator, PRF) on rpId senryo.xyz: create → clear site data → sign in → same address → unlock → step-up phrase → backup passkey vault → fresh-device recovery → same address; host guard on localhost | local | F-02, F-07, F-08, F-12 | 1fbab1c | address identical across create / stateless sign-in / vault recovery; 0 console errors | 0 | ok |
| 2026-09-30 | S6 | `.well-known` through `apps/web/deploy/nginx.conf` (nginx:stable-alpine container) | local | F-02 | df0f559 | AASA + assetlinks 200 `application/json`, no redirect; `/healthz` 200 | 0 | ok |
| 2026-09-30 | S6 | Mobile `expo export -p ios -p android` with `@senryo/account` (Mera 0.2.0, react-native-passkey 3.6.1, quick-crypto PBKDF2) | local | F-01, F-02 | 9a0d2bd | iOS hbc 9.1 MB · Android hbc 9.3 MB (S5: 6.0/6.2; +viem ≈1.3 MB src, noble, scure, ABIs) | 0 | ok |
| 2026-09-30 | S6 | Mobile Release build on the iPhone 17 simulator (iOS 26): onboarding, Create account through the real native passkey path → honest association-failure card, guest portfolio + sheet, Account + Diagnostics (dark/light) | local | F-01, F-02, F-60 | (this commit) | `design/screens/mobile-s6/` (12 shots); Keychain-unavailable hang found + fixed (D-150) | 0 | ok |
