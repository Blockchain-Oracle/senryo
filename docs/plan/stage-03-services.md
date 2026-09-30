# S3 — Services: config/core/chain, api · card · keeper, ledger, images (wave B)

**Goal:** the off-chain half of the product. `packages/chain` is the only sender (explicit gas, finalized confirmation,
journal, `eth_sendRawTransactionSync` with fallback). Three Fastify containers from one image — `api`, `card`
(latency-critical) and `keeper` — run against a Postgres 17 ledger. Images build in GitHub Actions and push to GHCR.
The keeper liquidates a testnet position driven by a script, and the swap quote matches the Uniswap v4 pool.
- **Plan:** `00-plan.md` §1 (D-013, D-021, D-027, D-030, D-032, D-035, D-036, D-040, D-042), §2.2, §4 (S3 row), §5.
- **Open first:** `specs/services.md` (binding), `specs/client.md` (package table + boundaries), `specs/contracts.md`,
  `specs/risk-math.md`, `specs/deploy-runbook.md`, `context/02-monad/{differences-from-ethereum,network-and-endpoints}.md`,
  `context/09-product/deployment-coolify.md`, `packages/contracts/src/*`, D-093 (Uniswap struct check).
- **Capacity (done by lead):** D-102 — everything on the user's Coolify server; deploy small-first and measure.
**D-number range:** D-110…D-129.

## Steps
- [x] S3.1 (lead) `packages/config` (networks 143/10143, rpc/ws/archive/explorers, `RP_ID` + hosts, `.well-known`
      paths, public env schema) and `packages/core` (bigint units/format/parse, `Reading<T>`, `shortAddress`); web and
      mobile consume them (their duplicate `formatUnits`/`Reading`/units/rpId removed)
- [x] S3.2 `packages/chain`: viem clients from `@senryo/config` (`blockTime` 300), `send.ts` (simulate → gas = estimate
      × `GAS_HEADROOM_BPS`, capped; never `gas: undefined`), `confirm.ts` (`finalized`), lifecycle submitted → proposed →
      voted → finalized, journal interface, `sendRawTransactionSync` to 2 RPCs + fallback (receipt via WS)
- [ ] S3.3 Uniswap v4 helper: read the AUSD/USDC pool key onchain, Quoter quote, Universal Router encoding confirmed
      against 2.1.2 on a mainnet fork (D-093)
- [x] S3.4 Ledger: Postgres 17 schema + forward-only idempotent migrations (all tables in `specs/services.md`)
- [ ] S3.5 `services/api` (Fastify): health/ready/config/geo/status/markets/account, starter + voucher relay (SIWE,
      rate limits), prefs/vault/alerts/events/push-token routes, WS channels + indexer bridge (stub until S4 merges)
      - S3.5a (early contract for S6, done): `@senryo/api-client` schemas for auth (SIWE), starter claim/voucher/status/
        relay, prefs, vault (D-110, D-111); EIP-712 types + lifecycle stages in `@senryo/core` (D-112)
- [ ] S3.6 `services/card`: Lithic ASA responder (HMAC raw body, idempotency, advisory lock reserve, operator shard,
      send-sync, decide by deadline, outbox lifecycle), `card/simulate`, latency samples
- [x] S3.7 `services/keeper`: observe pokes, liquidation scan, triggers, hold expiry, gas top-ups, MirrorAggregator
      relay (testnet), `/health` with `KEEPER_STALE_SEC`
- [ ] S3.8 Targeted checks: card concurrency (parallel auths never exceed freeToSpend), `scripts/drive` testnet
      deposit → XAU long → mirror price move → keeper liquidation
      - liquidation drive **done** 30 Sep: keeper liquidated the testnet position in 1.7 s, finalized
        (tx 0x6b44a112…c4c3, acceptance.md); card concurrency pending (S3.6)
- [ ] S3.9 Dockerfile (one image, three entrypoints, `HEALTHCHECK`), `.github/workflows/images.yml` → GHCR
      `sha-<short>` (linux/amd64), `deploy/*.env.example` (names only)
- [ ] S3.10 Gate + handoff

## Gate
Images build; the keeper liquidates a testnet position (drive script, tx in `acceptance.md`); the swap quote matches the
pool; fast gate green; invariants `explicit-gas` + `finalized-for-money` active (no longer skipped).

## Handoff
- S3.1 public API: `@senryo/config` → `MAINNET`/`TESTNET`/`NETWORKS`/`networkOf`, `RP_ID`, `API_ORIGIN`,
  `INDEXER_ORIGIN`, `WELL_KNOWN`, `parsePublicEnv`; `@senryo/core` → `DECIMALS`, `ONE_USD6/E8/E18`, `BPS_DENOMINATOR`,
  `formatUnits`, `parseUnits` (rejects extra decimals, never truncates), `divRound`, `applyBps`, `rescale`, `toPlot`,
  `Reading<T>`/`fromQuery`, `shortAddress`. Service env schemas live with each service, not in config.
