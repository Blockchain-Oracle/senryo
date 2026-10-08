> **SUPERSEDED by the prediction-market pivot (D-256, [pivot-2026-10-08.md](pivot-2026-10-08.md)).** Kept for history only; don't build from it.

# Spec: risk maths (enforced in RiskModule; mirrored in packages/core for previews only)

Contract is authoritative; `packages/core` mirrors it for UI previews and must never be trusted for money decisions.

## Collateral
- Per token: `v_t = ⌊bal_t × min(p_t, 1e18)/1e18 × (BPS − h_t)/BPS⌋`. If `p_t < DEPEG_FLOOR`: `v_t = 0` for initial checks; true price for liquidation. `C_adj = Σ v_t`.

## Execution price (pool counterparty)
- ask = P·(1+s), bid = P·(1−s), where `s = max(baseSpreadBps, devSpreadBps) + min(age × AGE_SPREAD_BPS_PER_HOUR / 3600, AGE_SPREAD_CAP_BPS) + impactBps`.
- `devSpreadBps` ≥ the feed's deviation threshold (5 bp for gold) — neutralises round-trip latency arbitrage within the deviation band (feed updates ~every 6 min, D-020).
- `impactBps` only when |skew| grows: `IMPACT_K × (|skewAfter| − |skewBefore|) / (pool × DEPTH_POOL_BPS/BPS)`; revert above `MAX_IMPACT_BPS` (the depth filter).
- CLOSED: `s = CLOSED_BASE_SPREAD_BPS + CLOSED_SPREAD_BPS_PER_HOUR × hoursClosed`, capped at `CLOSED_SPREAD_CAP_BPS`.

## Per position i
- `N_i = ⌈s_i × P_i / 1e30⌉` (usd6) · `uPnL_i = σ_i × s_i × (x_i − e_i)/1e30`, x = conservative exit (bid for longs, ask for shorts), rounded toward −∞.
- `F_i` = borrow (`N_entry × Δ borrowIndex`) + funding (`σ_i × N × Δ fundingIndex`), sign allowed.
- `IM_i = ⌈N_i × imBps × m_i / BPS⌉` with `m_i = CLOSED_IM_MULTIPLIER` (2×) when the market isn't OPEN, else 1 · `MM_i = ⌈N_i × mmBps / BPS⌉`.

## Account
- H = unreleased holds, D = card debt, R = envelope, B = `SAFETY_BUFFER_USD6`.
- **E_init** = `C_adj + Σ min(uPnL_i, 0) − Σ max(F_i, 0) − D` (positive uPnL is never spendable before realisation).
- **E_liq** = `C_liq + Σ uPnL_i − Σ F_i − D − H` (holds are senior liabilities).
- **FreeToTrade** = `E_init − Σ IM_i − max(R, H) − B`.
- **FreeToSpend** = `FreeToTrade + max(R − H, 0)` (unused envelope is spendable instantly), additionally capped by the live spend allowance (D-032).
- **Withdrawable** = `min(FreeToTrade, token balance)`.
- **Liquidatable** iff `E_liq < Σ MM_i`.
- **In Perpl** bucket = display only (D-010): read from Perpl, never counted in FreeToSpend.

## Pool, funding, borrow
- Trader aggregate PnL per market = `(L·P − longEntry) + (shortEntry − S·P)` in O(1).
- Profit cap: realised profit ≤ `N_open × MAX_PROFIT_BPS/BPS`; reserve = Σ that; must stay ≤ `poolCash × MAX_RESERVE_UTIL_BPS/BPS`.
- OI caps: each side ≤ `min(oiCapAbs, pool × oiCapPoolBps/BPS)`; `|L−S| ≤ pool × skewCapPoolBps/BPS`; per trade ≤ `pool × tradeCapPoolBps/BPS`; `MIN_POSITION_NOTIONAL`.
- Funding: `rate = clamp(FUNDING_FACTOR × (L−S)/max(L+S, MIN_OI), ±MAX_FUNDING_RATE)`; longs pay, shorts receive; the pool nets `(L−S)×rate ≥ 0`; accrues only while OPEN.
- Borrow: `(BORROW_BASE + BORROW_SLOPE × utilisation) × N`, always accruing.
- Fees: `feeBps` on open and close; `FEE_TO_INSURANCE_BPS` to insurance, rest to pool.

## Status matrix
| Status | Open/increase | Reduce | Liquidate | Non-envelope hold | Price to reduce |
|---|---|---|---|---|---|
| OPEN | yes | yes | yes | yes | P ± s |
| REOPENING (first `REOPEN_WINDOW` s) | no | yes | no | yes | worse of last accepted / latest |
| CLOSED | no | yes | no | yes (2× IM) | last ± closed spread |
| STALE (age > max or future-dated) | no | yes | no | envelope only | last ± age spread |
| CIRCUIT (clamp breach) | no | yes | no | envelope only | worse of last / latest |
| HALTED (guardian, auto-expires) | no | yes | no | envelope only | worse of |

## Liquidation waterfall
1. Close all positions at bid/ask plus `LIQ_PENALTY_BPS`. 2. Repay card debt to CARD_FLOAT (senior). 3. Holds stay reserved against remaining collateral. 4. Settle trader losses to POOL. 5. Liquidator gets `min(LIQ_FEE_SHARE × penalty, LIQ_FEE_CAP)`; rest of penalty → INSURANCE. 6. Shortfall → INSURANCE, then socialised to POOL (LPs). 7. Later over-capture beyond collateral → INSURANCE covers CARD_FLOAT.

## Serialisation
- Onchain: all actions for an account read/write one `Account` struct in one tx (Monad parallel execution preserves serial semantics); second of two racing actions reverts on I2; `nonce` orders states for backend + indexer.
- Offchain: Postgres `pg_advisory_xact_lock(account)` serialises card authorisations per account.
- Card modes: **strict** = submit `placeHold`, wait for finalized, then APPROVE · **envelope** = approve instantly up to `R − H − pendingOffchain` (R already excluded from trading), onchain hold follows with the same `holdId`.
