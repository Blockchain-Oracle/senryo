# Aurora Intents for Senryo deposits and withdrawals (checked live 8 Oct 2026)

Raw data: `raw/aurora-openapi-2026-10-08.json` (live OpenAPI) and `raw/aurora-monad-assets-2026-10-08.json`.

## What couldn't be checked

- **No Aurora key yet.** The quote, status, permanent-address and incident endpoints all need one. Get it at studio.aurora.dev (owner action) and put it in `AURORA_API_KEY` in `.env.local` and Coolify.
- **Instead,** routes were priced with keyless dry quotes against the NEAR 1Click API, which adds a 20 bps keyless fee.

## Facts

| Fact | Value |
|---|---|
| Products | Swap API (one-time address), Intents Deposits (permanent address per user), Intents Connect (deposit, then contract calls) |
| Hosts | `intents-api.aurora.dev` (key in the path: `/api/quote/{apiKey}`); `intents-connect-api.aurora.dev` (`x-api-key` header); SDK `@aurora-is-near/intents-connect@7.25.1` |
| Permanent address | `POST /api/persistent-deposit-address/{key}` `{recipient, sender, depositChain, destinationChain:"monad", destinationAsset}`. Deterministic; one address for all EVM chains; Stellar uses a memo. The API reference says creation is **limited to organisations Aurora approves (403 otherwise)**; the overview says permissionless. Fallback: a one-time Swap quote address. |
| Permanent status | `GET /api/persistent-deposit-status?type=received\|success\|failed&address=`; no ETA, no webhooks; `persistent-deposit-sync` backfills slowly |
| Swap lifecycle | `PENDING_DEPOSIT → KNOWN_DEPOSIT_TX → PROCESSING → SUCCESS`; failures `INCOMPLETE_DEPOSIT`/`REFUNDED`/`FAILED`; details carry tx hashes, `refundedAmount`, `refundReason` |
| Connect lifecycle | `CREATED → DEPOSIT_PENDING → DEPOSIT_PROCESSING → OPERATION_PENDING → OPERATION_PROCESSING → SUCCESS`; failures `EXPIRED` (a late deposit revives it), `DEPOSIT_FAILED`, `OPERATION_FAILED` (funds wait in the intermediary until retry or withdraw) |
| Connect execution | The user's source wallet signs. Steps run on Monad from an intermediary (`msg.sender`), with `{MIN_AMOUNT_OUT}` as the amount placeholder. Aurora pays Monad gas plus a USDC fee. One live execution per wallet per chain. Sources: 18 chains; destinations: arb, base, eth, **monad**, pol, sol |
| Monad USDC asset | `nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx` = `0x754704bc…b603` |
| Fees | Ours 0–500 bps (60/40 in our favour); Aurora's minimum is 2 bps on stablecoins, 10 bps on other tokens |
| Rate limits | 100 per 10 s and 2,000 per hour, per key and endpoint (429 with `Retry-After`) |
| Testnet | none |
| Support | aurora.dev/intents-support (tx hash plus deposit address) |

## Measured dry quotes into Monad USDC

| From | In | Out | ETA |
|---|---|---|---|
| Base USDC | 5 | 4.988 | 37 s |
| Arbitrum USDC | 5 | 4.988 | 27 s |
| Optimism USDC | 5 | 4.988 | 37 s |
| Polygon USDC | 5 | 4.988 | 37 s |
| Ethereum USDC | 5 | 4.989 | 47 s (0.30 refund fee) |
| Solana USDC | 5 | 4.988 | 22 s |
| SOL | 0.05 | 5.61 | 24 s |
| ETH on Base | 0.002 | 5.04 | 39 s |
| DOGE | 60 | 5.18 | 129 s |
| BTC | 0.0002 | 16.39 | **809 s** |

- **Minimums:** Base USDC 0.15. Temporary: BNB Chain USDT **$1,000**, Tron **$100**. TON, XRP and Sui returned errors.
- **On Monad:** 200 MON → 4.988 USDC in 24 s.
- **Out of Monad** (20 USDC): Base 19.958 in 22 s, Arbitrum 19.955 in 19 s, Solana 19.948 in 17 s, Ethereum 19.658 in 27 s, BTC in 467 s.

## Senryo's existing code (to slim in S1, rebuild in S9)

- `services/api/src/anyasset/bridge/aurora.ts`: an incident watcher only. **Bug:** it reads `type`/`value` instead of `scopeType`/`scopeValue`.
- `packages/config/src/bridges.ts`: `AURORA_API`; no route uses Aurora.
- `deposit-address.ts` serves Relay's addresses (Relay's tracking retires on 24 Nov). It is deleted; Aurora is the single provider.
- The `aurora_deposits` table exists unused (migration 0002).
- `AURORA_API_KEY` is missing from `deploy/api.env.example`.

## Design decisions (in the plan)

- **Recipient** = the user's Mera address. It's fixed for good, because changing it changes every address.
- **Arrival signal:** primarily our own watch of USDC `Transfer` to the user, only while a deposit is pending. Aurora status is secondary: every 5 s while the sheet is open, every 30 s while pending.
- **"Place this when it lands"** (web, external source wallet): Mera signs an EIP-712 order. On arrival Aurora calls `BandReserve.depositAndCommit`, which **never reverts**: it credits the user's wallet if the call can't be placed. The order targets the next open window.
- **Withdraw to another chain:** an Aurora Swap quote created at confirm time, then an EIP-3009 transfer to the quote address, relayed.
- **Practice:** a live read-only quote preview, with no fake deposits.

## Still open

1. Whether we're approved for permanent addresses.
2. Refund behaviour for permanent addresses, which isn't documented.
3. Who signs Connect for Solana sources.
4. Where Connect refunds go.
5. Whether fees stack on keyed quotes.
6. Exchange support for USDC on Monad.
