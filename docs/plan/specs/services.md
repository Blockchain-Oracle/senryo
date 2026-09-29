# Spec: services (api · card · keeper) and indexer

Plan §2.2–2.3, D-013/014/035/040. TypeScript, Node 24, **Fastify** (raw-body HMAC, `@fastify/websocket`, `@fastify/rate-limit`, TypeBox/zod validation, pino). Postgres 17 ledger. All three containers from one image, different entrypoints.

## services/card (latency-critical, 192m)
1. **Verify**: raw body; Standard-Webhooks HMAC over `webhook-id.webhook-timestamp.body` with the Lithic ASA secret; constant-time compare; reject skew > `WEBHOOK_TOLERANCE_S` (300).
2. **Idempotency**: UNIQUE `card_auth(issuer, txn_token, kind)`. Duplicate → stored decision; still PENDING → wait up to the deadline then return its result. Lithic retries on 5xx/connection failure → same request may arrive twice.
3. **Reserve** (one Postgres tx): advisory lock on account → `available = snapshot.freeToSpend(finalized, nonce) − Σ pending holds not yet reflected at that nonce` → insert hold RESERVED → commit. `hold_amount = max(amounts.hold, cardholder × (1 + FX_BUFFER_BPS | TIP_BUFFER_BPS by MCC))`; cents × 10_000 → usd6.
4. **Submit**: operator key chosen by `hash(account) mod K`; cached base fee (1 s refresh) + local nonce; `eth_sendRawTransactionSync` to two RPCs in parallel (same signed tx). Holds only within the user's spend allowance (D-032). Mainnet Lithic sandbox = release-only mode (D-036).
5. **Decide**: finalized before `INTERNAL_DEADLINE_MS` (2800) → APPROVE; else envelope covers → APPROVE; else DECLINE `INSUFFICIENT_FUNDS` and outbox `releaseHold` if it landed.
6. **Lifecycle** (Lithic events via outbox, reconciled against Envio `HoldPlaced/HoldCaptured`): CLEARING → `captureHold` (or release in release-only mode) · VOID/REVERSAL → `releaseHold` · RETURN → `refund` · incremental auth → `increaseHold` · BALANCE_INQUIRY → return freeToSpend.
7. **Latency budget** p50 / target: ingress 50 ms · verify 2 · idempotency+lock 10 · finalized snapshot `eth_call` 100–150 · sign 5 · send-sync ~350 · wait finalized ~600–800 · respond 20 → **≈1.2 s p50, <2.5 s p99** (Lithic hard 6 s, recommended 3 s). Every stage logged to `latency_samples`. Load-test our endpoint directly (Lithic sandbox is 1 rps).
8. Routes: `POST /v1/card/lithic/asa`, `POST /v1/card/lithic/events`, `POST /v1/card/simulate` (demo, sandbox only, D-042), freeze (Lithic PAUSE), PAN reveal via Lithic embed URL, allowance helpers.
9. Immersve (testnet): top-up = withdrawal to the user's registered Immersve Funds Storage (Funds Manager `0x1754AE802dCcc5bd4fe2d2b42ac01e2AB3552086`), step-up. Laso: user withdraws to own EOA → Aurora Monad→Base → Mera key signs x402 EIP-3009; a proxy forwards only the signed header if CORS requires.

## services/api (384m)
- `/health` (liveness only — never `/ready` as the container health check) · `/ready` · `/v1/config` (min app version, feature flags, network capabilities) · `/v1/geo` · `/v1/status` (RPC, Perpl, Aurora incidents, oracle ages, indexer lag, card service) · `/v1/markets` · `/v1/account/:addr` (chain + indexer).
- Starter/voucher relay: SIWE challenge signed by the Mera EOA → `StarterDrip.claimFor` / `redeemVoucher`; rate limits per IP /24 + device hash; Turnstile (invisible) on web; practice-mode faucet relay on testnet.
- Aurora: allowlisted proxy adding `x-api-key`; server computes `inboxOf(user)` recipient; `aurora_deposits` table + status poller (resume via `listExecutions`, recover `OPERATION_FAILED` intermediary funds).
- Perpl: `/v1/pub/context` cache 60 s, tickers 1 s; one upstream market-data WS (≤16 subs, no pings) fanned out; encrypted Path-A key blob (HKDF from PRF, client-side) stored as opaque bytes.
- `/v1/prefs` (encrypted blob; server is untrusted storage) · `/v1/vault` (second-passkey vault JSON, signed) · `/v1/alerts` + `price_alerts` · `/v1/events` (first-party analytics) · push token + Live Activity push-token registration (APNs key [OK?]); `push_tokens` carries plaintext per-channel flags.
- WS channels `prices:{market}`, `perpl:{market}`, `account:{addr}` (JWT from SIWE); indexer bridge polls Hasura every 500 ms keyed by `_meta.progressBlock`; conflate 100 ms; drop intermediate ticks under backpressure. Rate limits per IP and address; Traefik middleware on Hasura.

## services/keeper (160m, own container)
Jobs: `observe` pokes on oracle rounds · liquidation scan (read Envio risk snapshots + live price, simulate, send) · TP/SL trigger execution · `healthWatch` (warning push each oracle round) · hold-expiry release · inbox sweep (USDC/AUSD `Transfer` to known inboxes via WS logs) · gas top-ups below floor (capped per address/day) · testnet `MirrorAggregator` relay · price-alert evaluation · ops alerts (Telegram/email [OK?]) when a job stalls or a wallet is below floor. `/health` fails if last tick older than `KEEPER_STALE_SEC`.

## Postgres tables
`card_auth` · `holds` (RESERVED → SUBMITTED → ONCHAIN → FINALIZED/CAPTURED/RELEASED) · `ledger_entries` (double entry) · `outbox` · `operator_nonces` · `starter_claims` · `vouchers` · `aurora_deposits` · `price_alerts` · `push_tokens` · `events` · `prefs_blobs` · `vault_blobs` · `latency_samples`. Daily `pg_dump` [OK?]. Migrations forward-only and idempotent.

## Push (Expo)
Channels fills, liquidation (time-sensitive), deposits, card, price alerts. Sent **only** when the triggering event's block ≤ finalized, idempotent on event id, from the backend (never Envio effects, so re-indexing never re-sends).

## Indexer (Envio HyperIndex V3, self-hosted; `indexer/` outside the workspace)
- config: `address_format: lowercase`, `disable_default_cross_chain: true`, HyperSync `https://monad.hypersync.xyz`; chains 143 + 10143; contracts SenryoCore, LpVault, SessionOracle, StarterDrip, InboxFactory (+ dynamic inbox registration), CollateralSwapper, Chainlink XAU/XAG **aggregators** (`AnswerUpdated`, follow aggregator changes), Perpl Exchange `0x34B6552d57a35a1D042CcAe1951BD1C370112a6F` from `APP_LAUNCH_BLOCK` (subscribe only needed events).
- Entities: `User` (latest `AccountRiskUpdated` + cumulative PnL/fees/funding/volume/cardSpent/perplCollateral), `CollateralBalance`, `CollateralMove`, `Market{venue OURS|PERPL}`, `Position`, `Fill`, `FundingAccrual`, `Trigger`, `Liquidation`, `CardHold` (+ capture/refund), `CardDebt`, `Allowance`, `Voucher`, `LpPosition`, `LpPoolDaily`, `OracleRound`, `Candle` (OHLC from rounds + fills), `OracleStatusEvent`, `PerplAccount`, aggregates `UserDailyStats`, `MarketDailyStats`, `ProtocolStats` (incl. `unattributedFills`), `ProtocolDailyStats`, `PerplCursor @internal`.
- Perpl taker-fill cursor keyed per chain `{txHash, logIndex, accountId, marketId, fillId?}`; every Position* event overwrites; Maker/TakerOrderFilledV2 consume only if txHash matches, cursor.logIndex < event.logIndex, (maker) accountId matches; clear after use; mismatch → `unattributedFills++` (alarm for undocumented ordering changes). Also index Perpl `PositionLiquidated` for app users (F48).
- Side effects only via `createEffect`; aggregates computed in handlers (Cloud has no `_aggregate`). Display only — card authorisation never reads the indexer.
- Compose adapted for Coolify: no `ports`/`container_name`/custom networks; `mem_limit`; `ENVIO_API_TOKEN: ${ENVIO_API_TOKEN:?}`; Hasura console off; health check on the real port (verify 9898 vs 8080).
