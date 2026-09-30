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
- [x] S3.9 Dockerfile (one image, three entrypoints, `HEALTHCHECK`), `.github/workflows/images.yml` → GHCR
      `sha-<short>` (linux/amd64), `deploy/*.env.example` (names only)
- [x] S3.10 Gate + handoff
- [x] S3.12 Wire `@senryo/indexer-client` (after the S4 merge): api indexer bridge (`_meta` progress, account
      `history`) and the keeper's `IndexerSource` (open-position users, PLACED triggers); keeper memory → 256m (D-124)

## Gate
Images build; the keeper liquidates a testnet position (drive script, tx in `acceptance.md`); the swap quote matches the
pool; fast gate green; invariants `explicit-gas` + `finalized-for-money` active (no longer skipped).

## Evidence (gate, 30 Sep)
- Fast gate green at every commit (typecheck 13 tasks · biome · invariants 0 errors; `explicit-gas` and
  `finalized-for-money` **active**).
- Image: `docker build --platform linux/amd64 -f services/Dockerfile .` → **67.5 MB**, linux/amd64; api/card/keeper
  containers from it all reported `healthy` (HEALTHCHECK → `/health`), `node dist/health.mjs` exit 0 inside each,
  api `/v1/markets` + `/ready` answered from the container (acceptance.md). Idle RSS under emulation: api 150 MiB,
  card 168 MiB, keeper 154 MiB.
- Keeper liquidated a testnet position (tx `0x6b44a112…c4c3`); card concurrency pass on a Monad-rules fork; api smoke
  17/17 on the fork; swap output = Quoter quote on a mainnet fork (all in acceptance.md).

## Handoff
- S3.1 public API: `@senryo/config` → `MAINNET`/`TESTNET`/`NETWORKS`/`networkOf`, `RP_ID`, `API_ORIGIN`,
  `INDEXER_ORIGIN`, `WELL_KNOWN`, `parsePublicEnv`; `@senryo/core` → `DECIMALS`, `ONE_USD6/E8/E18`, `BPS_DENOMINATOR`,
  `formatUnits`, `parseUnits` (rejects extra decimals, never truncates), `divRound`, `applyBps`, `rescale`, `toPlot`,
  `Reading<T>`/`fromQuery`, `shortAddress`. Service env schemas live with each service, not in config.

### S3 — what exists (merge `stage/S3-services`)
- **`@senryo/chain`** (only sender; imports viem): `createReadClient/createBroadcastClients/createWsClient`,
  `monadMainnet/monadTestnet/viemChain` (300 ms), `HeadTracker` (monadNewHeads), `createSender`, `sendTx`,
  `sendAndFinalize`, `planGas`, `gasWithHeadroom`, `confirmFinalized/waitForCommit`, `FeeCache`, `LocalNonceSource`/
  `NonceSource`, `MemoryJournal`/`kvJournal`/`TxJournal`, `contractCall`/`externalCall`/`receiptEvents`,
  `addressOf/isDeployed/readContract/CONTRACT_ABIS`, `readAccountSnapshot/readPositions/readOracles`, keeper reads
  (`readLiquidatable/readOracleStates/readFeedRound/readHolds/readBalances`), `verifyClaimSignature/
  verifyVoucherSignature/verifySpendAllowanceSignature/starterDripDomain/coreDomain/voucherCodeHash`,
  `buildSiweMessage/verifySiweSignature/newSiweNonce`, `decodeRevert/describeError` + error classes,
  `signerFromPrivateKey`, Uniswap (`findStablePool/quoteExactIn/encodeExactInSingle/poolIdOf`), viem re-exports.
  Apps plug the Mera signer in as `account` and may wrap `@senryo/account`'s `enqueue` as a `NonceSource`.
- **`@senryo/api-client`**: `createApiClient`, `defineRoute` registry, codecs (bigint ⇄ decimal string), `ApiError`,
  routes auth · starter · prefs/vault · info (config/geo/status/markets/account) · engagement (alerts/events/push) ·
  card · WS (`WS_PATH`, client/server message schemas).
- **Services** (one image, `SERVICE=api|card|keeper`): api `:3000` (all `/v1/*` above + `/v1/ws`), card `:3001`
  (`/v1/card/lithic/asa|events`, `/v1/card/{simulate,freeze,embed,allowance,summary}`), keeper `:3002`
  (`/v1/keeper/status`); all `/health` (liveness) + `/ready`. Ledger migrations 0001–0003 run on boot (advisory lock).
- **Scripts** `@senryo/drive`: `liquidation` (testnet), `card-concurrency`, `api-smoke` (fork), `swap-check`
  (mainnet read + mainnet fork). Commands in each file header.
- **Env**: names in `deploy/{api,card,keeper}.env.example` (secrets as `NAME` or `NAME_FILE`).
- **CI**: `.github/workflows/images.yml` — `workflow_dispatch` only, linux/amd64, `ghcr.io/blockchain-oracle/
  senryo-{api,web}:sha-<short>` (web = S6's `apps/web/Dockerfile`, lands at merge); GHA cache per app.
- **Additive outside S3 packages** (merge risk low): `@senryo/config` `gas.ts`, `markets.ts` (+ index exports);
  `@senryo/core` `typed-data.ts`, `lifecycle.ts` (+ index exports); `pnpm-workspace.yaml` + `scripts/drive`.

### Pending (and why)
- **Indexer** (S3.12, D-124): api `EnvioIndexerBridge` (`INDEXER_GRAPHQL_URL`) + keeper `IndexerSource` run on
  `@senryo/indexer-client`; WS `account:*` still pushes chain snapshots (history deltas over WS are a later refinement).
- **Perpl** WS/proxy (`perpl:*`, `/v1/pub/context`) → S7; **Aurora** proxy/poller → S9; Expo/APNs push delivery and
  ops alert channel are recorded, not delivered (credentials [OK?]); PAN reveal/simulate/freeze need Lithic keys.
- **Geo**: edge headers only; add a Traefik geo middleware or DB-IP Lite lookup (D-121).
- **Latency**: fork p50 is not representative (anvil 0.5 s blocks); the real ASA p50/p99 harness is S10 on testnet.
- **CollateralSwapper**: must add `minHopPriceX36` before S8 (D-122; contracts owner).
- **Capacity**: keeper limit raised to 256m in runbook §4 (D-124); card idles at ~168 MiB vs its 192m — re-measure
  natively on the server after deploy (D-102) and raise it the same way if it stays above ~160 MiB.

### User / [OK?] steps (none done by S3)
1. **Testnet MON** for the keeper relay and StarterDrip float (D-118): claim at faucet.quicknode.com/monad/testnet
   (no account) or faucet.monad.xyz to the deployer `0x52d2…0E6A`; then enable `mirror` in `KEEPER_JOBS`.
2. **Grant roles on testnet** when deploying: RELAYER_ROLE → sponsor `0xb00A…DA99`, CARD_OPERATOR_ROLE → operators
   `0xbB18…BAF6`, `0xbfD5…9138` (deployer tx; the drive used anvil forks for these).
3. **Lithic sandbox account** [OK?] → `LITHIC_API_KEY`, ASA HMAC secret (`GET /v1/auth_stream/secret`), webhook
   secret; register `https://api.<rpId>/v1/card/lithic/asa` and `/events`.
4. **GHCR**: run `images` workflow (manual), then package visibility public or `docker login ghcr.io` on the server [OK?].
5. **Coolify** [OK?]: ledger Postgres 17 → api/card/keeper Docker Image resources from `senryo-api:sha-…` with
   `SERVICE` set, env from `deploy/*.env.example`, secrets runtime-only; card routed at `api.<rpId>/v1/card/*`.
6. **Cloudflare Turnstile** site + secret for the web claim (optional) [OK?].
