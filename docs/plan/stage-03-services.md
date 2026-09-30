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
- [x] S3.3 Uniswap v4 helper: read the AUSD/USDC pool key onchain, Quoter quote, Universal Router encoding confirmed
      against 2.1.2 on a mainnet fork (D-093)
- [x] S3.4 Ledger: Postgres 17 schema + forward-only idempotent migrations (all tables in `specs/services.md`)
- [x] S3.5 `services/api` (Fastify): health/ready/config/geo/status/markets/account, starter + voucher relay (SIWE,
      rate limits), prefs/vault/alerts/events/push-token routes, WS channels + indexer bridge (stub until S4 merges)
      - S3.5a (early contract for S6, done): `@senryo/api-client` schemas for auth (SIWE), starter claim/voucher/status/
        relay, prefs, vault (D-110, D-111); EIP-712 types + lifecycle stages in `@senryo/core` (D-112)
- [x] S3.6 `services/card`: Lithic ASA responder (HMAC raw body, idempotency, advisory lock reserve, operator shard,
      send-sync, decide by deadline, outbox lifecycle), `card/simulate`, latency samples
- [x] S3.7 `services/keeper`: observe pokes, liquidation scan, triggers, hold expiry, gas top-ups, MirrorAggregator
      relay (testnet), `/health` with `KEEPER_STALE_SEC`
- [x] S3.8 Targeted checks: card concurrency (parallel auths never exceed freeToSpend), `scripts/drive` testnet
      deposit → XAU long → mirror price move → keeper liquidation
      - liquidation drive **done** 30 Sep: keeper liquidated the testnet position in 1.7 s, finalized
        (tx 0x6b44a112…c4c3, acceptance.md); card concurrency **pass** on a Monad-rules anvil fork (acceptance.md)
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

### Resume point (S3 agent, 30 Sep ~05:35Z — paused on the lead's request, usage limit)
**Done:** S3.2 chain · S3.3 Uniswap (D-122) · S3.4 ledger · S3.5 api (+S3.5a contract) · S3.6 card · S3.7 keeper ·
S3.8 checks (testnet liquidation drive + fork card concurrency) — all committed, fast gate green at each commit.
**In progress — S3.9 (wip commit):** `services/Dockerfile` (+ `services/Dockerfile.dockerignore`, BuildKit per-Dockerfile
ignore so S6's root-context web build is unaffected) and `services/common/scripts/bundle.mjs` (esbuild → `api.mjs`,
`card.mjs`, `keeper.mjs`, `run.mjs` dispatching on `SERVICE`, `health.mjs` for HEALTHCHECK). The bundle is verified
locally (bundled api served `/health` + `/v1/markets` on the fork); **`docker build --platform linux/amd64` was started
and stopped before finishing** (`pnpm fetch` of the whole lockfile under amd64 emulation is slow) — not yet verified.
**Next:** (1) finish/verify the image build (consider `pnpm fetch` → `pnpm install --filter …` only, or a `pnpm deploy`
step, if the full fetch stays slow); run the image with `SERVICE=api|card|keeper` and check `HEALTHCHECK` →
`healthy`. (2) `.github/workflows/images.yml`: `workflow_dispatch` only, linux/amd64, matrix `api` (this Dockerfile,
context `.`, image `ghcr.io/blockchain-oracle/senryo-api:sha-<short>`; card/keeper run the same image) and `web`
(`apps/web/Dockerfile` from S6, context `.`, `senryo-web`). (3) `deploy/{api,card,keeper}.env.example` (names only —
list below). (4) S3.10 gate + full handoff (public APIs, env names, user [OK?] steps) + report to the lead.
**Local state:** Postgres 17 container `senryo-ledger-dev` (127.0.0.1:55499, dbs `senryo` + `senryo_fork`) left running;
anvil forks stopped; testnet keys in `~/.config/senryo/testnet-*.key`; local test secrets only in the session scratchpad.

### Handoff notes so far (to be completed in S3.10)
- **Env names** — all services: `NODE_ENV LOG_LEVEL HOST PORT DATABASE_URL CHAIN_ID RPC_HTTP RPC_WS` (secrets as `NAME`
  or `NAME_FILE`). api: `CHAIN_IDS SIWE_DOMAIN SIWE_URI CORS_ORIGINS MIN_APP_VERSION CARD_URL INDEXER_GRAPHQL_URL
  STARTER_PER_DEVICE_PER_DAY STARTER_PER_NETWORK_PER_DAY FEATURES` + secrets `API_SESSION_SECRET SPONSOR_PK
  TURNSTILE_SECRET`. card: `INTERNAL_DEADLINE_MS WEBHOOK_TOLERANCE_S FX_BUFFER_BPS TIP_BUFFER_BPS CARD_ISSUER_LABEL
  CARD_RELEASE_ONLY LITHIC_API_BASE` + secrets `LITHIC_ASA_SECRET LITHIC_WEBHOOK_SECRET LITHIC_API_KEY
  API_SESSION_SECRET OPERATOR_1_PK … OPERATOR_8_PK`. keeper: `KEEPER_STALE_SEC KEEPER_JOBS KEEPER_WATCH_ACCOUNTS
  INDEXER_GRAPHQL_URL SOURCE_RPC_HTTP MIRROR_MARKETS MIRROR_DEVIATION_BPS MIRROR_HEARTBEAT_SEC WALLET_FLOOR_WEI
  OPS_WATCH_WALLETS TOPUP_FLOOR_WEI TOPUP_AMOUNT_WEI LIQUIDATE_MS OBSERVE_MS MIRROR_MS` + secret `KEEPER_PK`.
- **Additive changes outside S3 packages:** `@senryo/config` `gas.ts` (GAS_LIMITS, GAS_HEADROOM_BPS, fee constants),
  `markets.ts` (ENGINE_MARKETS, MAINNET_EXTERNAL); `@senryo/core` `typed-data.ts` (EIP-712 defs), `lifecycle.ts`
  (TX_STAGES); `pnpm-workspace.yaml` adds `scripts/drive`.
- **Blockers / [OK?] for the user:** CollateralSwapper must add `minHopPriceX36` before S8 (D-122, contracts owner);
  testnet keeper float for the mirror relay (D-118; QuickNode faucet needs no account); Lithic sandbox account + keys
  (ASA secret, webhook secret, API key) — [OK?]; Coolify resources/deploys, GHCR visibility — [OK?].
