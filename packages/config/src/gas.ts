/**
 * Gas budgets (Monad charges the gas LIMIT, not gas used — context/02-monad/differences-from-ethereum.md §1).
 * `packages/chain/send.ts` sets gas = estimate × (1 + GAS_HEADROOM_BPS), capped at the action's budget, and refuses to
 * send when the estimate alone is above the budget (something is wrong; a huge limit would be charged in full).
 *
 * S8.6 (D-185): core/periphery budgets = max(`eth_estimateGas` on a Monad-rules fork of mainnet 143 and testnet
 * 10143) × 1.10, rounded up to 10k (`contracts/test/fork/GasProfileFork.t.sol`, `--isolate`). Every SenryoCore action
 * ends in the account-risk pass, which reads each held market's oracle view (and, on mainnet, the AUSD/USDC Chainlink
 * feeds), so position-scaled actions carry the budget for ONE open position here and `positionGasLimit` adds
 * `POSITION_GAS` per extra position. Entries marked (S3) came from S3 and were not re-measured in S8.6.
 */

/** +10 % over `eth_estimateGas`: small on purpose — the whole limit is paid. */
export const GAS_HEADROOM_BPS = 1_000n;
const GAS_BPS = 10_000n;

/** Plain MON transfer (fixed cost). */
export const NATIVE_TRANSFER_GAS = 21_000n;

/**
 * Per-position increment of the liquidation budget (`liquidate` base + this × open positions).
 * (S8.6) estimates 474.1k (1 position) / 637.0k (2), mainnet fork: 350k + 180k × n covers both with 10 %.
 */
export const LIQUIDATE_GAS_PER_POSITION = 180_000n;

export const GAS_LIMITS = {
  transfer: NATIVE_TRANSFER_GAS,
  /** Wallet ERC-20 send; estimated per token and refused above this conservative ceiling. Fork acceptance required. */
  erc20Transfer: 150_000n,
  /**
   * (S3, D-122) raised from 80k: mainnet USDC (FiatToken proxy) `approve` estimates 87k on a Monad-rules fork.
   * (S1b.16) every J11 spot token's `approve(Permit2)` on a 143 fork: worst 96.0k (cbBTC) — inside.
   */
  approve: 110_000n,
  /** (S8.6) 1 position: estimate 460.6k mainnet (both stable feeds read) · 267.5k testnet; 0 positions 287.3k. */
  deposit: 510_000n,
  /** (S8.6) 1 position: 462.8k mainnet · 271.7k testnet; 0 positions 289.5k. */
  withdraw: 510_000n,
  /**
   * (S8.6) 1 position: 490.8k mainnet · 397.3k testnet (lead's 10143 fork, 2 positions: 498.7k → positionGasLimit).
   * (S8.18 rehearsal) the FIRST position in a freshly deployed mainnet market estimates 550.35k — its aggregate slots
   * go zero → non-zero. (S8.23, 7 markets on a 143 fork) the first EUR position, including that market's first
   * oracle write (STALE → OPEN) and the I4 reserve loop over every listed market, estimates 624.1k → cap 690k; the
   * limit sent is still estimate + headroom.
   */
  increase: 690_000n,
  /** (S8.6) 1 position: 440.5k mainnet · 283.6k testnet. */
  decrease: 490_000n,
  /** (S8.6) 1 position: 414.9k mainnet · 260.1k testnet. */
  close: 460_000n,
  /**
   * (S8.6) 1 position, non-envelope: 446.0k mainnet · 352.6k testnet (envelope hold, no position: 332.8k). D-119's
   * 260k (a first hold on a position-free testnet account) is superseded. The card sends placeHold with a FIXED
   * limit, so pass `positionGasLimit("placeHold", positions)`.
   */
  placeHold: 500_000n,
  /** (S8.6) 1 position: 375.5k mainnet · 282.1k testnet. */
  increaseHold: 420_000n,
  /** (S8.6) 1 position, over-capture (risk pass): 449.0k mainnet · 344.1k testnet. */
  captureHold: 500_000n,
  /** (S8.6) 1 position: 356.6k mainnet · 265.1k testnet. */
  releaseHold: 400_000n,
  /** (S8.6) anyone after expiry + grace; 2 positions 490.4k mainnet → 1 position ≈ 377.3k. */
  releaseExpiredHold: 420_000n,
  /** (S8.6) refund repays card debt first, then credits the user: 1 position 422.8k mainnet · 331.3k testnet. */
  refund: 470_000n,
  /** (S8.6) `liquidateGasLimit(positions)` = this + LIQUIDATE_GAS_PER_POSITION × positions. */
  liquidate: 350_000n,
  /**
   * ERC-4626 deposit: two poolValue passes peek EVERY listed market, so it scales with the market count, not the
   * depositor's positions. (S8.6, 2 markets) 544.2k mainnet · 460.8k testnet; (S8.23, 7 markets, 143 fork) 1,041.2k.
   */
  lpDeposit: 1_150_000n,
  /** (S8.6) escrow shares: 156.5k (both). */
  lpRequestRedeem: 180_000n,
  /**
   * allMarketsOpen + a poolValue pass over every listed market. (S8.6, 2 markets) 415.9k testnet, ≈ 499.2k mainnet;
   * (S8.23, 7 markets, 143 fork) 1,045.8k.
   */
  lpClaimRedeem: 1_160_000n,
  /** (S8.6) mainnet claim = MON drip only: 162.1k. */
  claimFor: 180_000n,
  /** (S3, D-119) testnet claim also mints practice AUSD and deposits it (first-time account): estimate 417k. */
  claimForPractice: 480_000n,
  /** (S8.6) signature check + depositFor: 436.1k mainnet · 285.5k testnet. */
  redeemVoucher: 480_000n,
  /**
   * InboxFactory.sweep (S8.24): first use deploys the inbox, then a depositFor per stablecoin held. 10143 fork, fresh
   * account: deploy + AUSD 501.6k · deploy + AUSD + USDC 583.2k · deployed, both 277.6k. Mainnet depositFor also reads
   * both stable feeds (+~193k each, see `deposit`) → worst ≈ 970k.
   */
  sweepInbox: 1_200_000n,
  /** (S8.6) StarterDrip.topUp, capped native send: 143.6k. */
  topUp: 160_000n,
  /**
   * SessionOracle.observe: (S8.6) fresh round 163.1k mainnet · 135.1k testnet; the CIRCUIT confirm walk over all
   * CONFIRM_LOOKBACK_ROUNDS adds 53.9k (testnet mirror) → mainnet worst ≈ 217k; the S3 budget stands.
   */
  observe: 250_000n,
  /**
   * SenryoCore.poke = observe + funding/borrow accrual — the keeper's poke where a market has open interest (S8.23).
   * 143 fork: 231.0k (first accrual) · 164.5k after; + the 53.9k CIRCUIT confirm walk → worst ≈ 285k.
   */
  poke: 320_000n,
  /** (S8.6) TriggerOrders.executeTrigger ≈ a decrease + bookkeeping: 1 position 476.8k mainnet · 317.9k testnet. */
  executeTrigger: 530_000n,
  /** (S8.6) placeTrigger (relayed EIP-712 TP/SL): 165.7k, no risk pass. */
  placeTrigger: 190_000n,
  /** (S3) testnet MirrorAggregator.pushAnswer (two fresh slots). */
  pushAnswer: 150_000n,
  /** (S3) testnet MockStable.faucet(). */
  faucet: 120_000n,
  /** (S8.6) setSpendAllowance relay (EIP-712 + risk pass): 1 position 372.5k mainnet · 281.1k testnet. */
  setSpendAllowance: 410_000n,
  /** (S8.6) setCardEnvelope (risk-checked): 1 position 373.5k mainnet · 218.6k testnet; 0 positions 200.5k. */
  setCardEnvelope: 420_000n,
  /**
   * revokeSpendAllowance (the card freeze, D-039): not fork-measured yet; bounded by setSpendAllowance — the same
   * risk pass (`_emitRisk`) without the EIP-712 recovery — so it carries that budget.
   */
  revokeSpendAllowance: 410_000n,
  /**
   * repayCardDebt (E4 Repay, user-sent): not fork-measured yet; bounded by `withdraw` — the same balance charge plus a
   * risk-checked pass (`_emitRiskChecked`) — so it carries that budget.
   */
  repayCardDebt: 510_000n,
  /**
   * (S8.6) SenryoCore.swapCollateral via CollateralSwapper → Universal Router (mainnet only): 0 positions 592.3k,
   * 1 position 765.2k.
   */
  swapCollateral: 850_000n,
  /** (S3) Permit2.approve(token, Universal Router) before a v4 swap. (S1b.16) spot tokens, 143 fork: worst 53.5k. */
  permit2Approve: 120_000n,
  /** (S3) Universal Router V4_SWAP exact-in single (fork-measured in the S3.3 swap check). */
  uniswapSwap: 600_000n,
  /**
   * (S1b.16) Universal Router V4_SWAP exact-in along a J11 spot route, ONE hop (SWAP_EXACT_IN · SETTLE_ALL · TAKE to
   * the user). 143 fork, `--network monad`, every listed token bought and sold back at $10 and $1,000: worst 313.8k
   * (cbBTC buy) → 350k. More hops and larger trades: `spotSwapGasLimit`.
   */
  spotSwap: 350_000n,
  /**
   * Perpl direct path (D1). Measured 2 Oct 2026 on mainnet state with `eth_simulateV1` (a fresh wallet credited AUSD
   * by state override; binary search on each call's gas for the smallest that still succeeds with its event), × 1.10,
   * rounded up to 10k. AUSD `approve(Exchange)` zero → non-zero: 71.2k.
   */
  perplApprove: 80_000n,
  /** `createAccount(amount)` (AccountCreated + CollateralDeposit): 202.1k. */
  perplCreateAccount: 230_000n,
  /** `depositCollateral(amount)` on an existing account: 135.9k. */
  perplDeposit: 160_000n,
  /**
   * IOC `execOrder`, open or close: scales with the resting orders matched — 1 maker 0.28–0.31M, 2 makers 0.42–0.49M,
   * 4–5 makers 0.99M (BTC/ETH/SOL/MON/HYPE, $20 and $250). Orders cap the walk at `PERPL_ORDER_MAX_MATCHES` (8):
   * ≈ 0.3M + 7 × 0.2M = 1.7M → 1.9M. The limit sent is still the estimate + headroom (an estimate at the minimum fills
   * in full: exhaustion reverts, it never cuts the fill short).
   */
  perplOrder: 1_900_000n,
  /** `withdrawCollateral(amount)`: 135.0k (0, 1 or 3 open positions alike); 151.9k when it resets the rate window. */
  perplWithdraw: 170_000n,
   * (D6) Monorail / KyberSwap router call, floor. Routes vary from one pool to 3+ hops, splits and order books, so a
   * quote's budget is `aggregatorSwapGasLimit(quote.gasEstimate)`. 143 fork, 2 Oct: Monorail USDT0 → XAUt0 (one
   * PancakeSwap v3 pool) 435.9k; KyberSwap 100 MON → AUSD 1,221.1k (its own metering 1,243.9k).
   */
  aggregatorSwap: 600_000n,
  /**
   * (D2) Relay deposit. 143 fork, 2 Oct: depository — native MON 24.8k, AUSD 81.6k, USDC 109.5k; Relay's router
   * (USDT0 swapped in before bridging) 714.8k → 800k.
   */
  relayDeposit: 800_000n,
  /** (D2) CCTP v2 `depositForBurnWithHook` (Forwarding Service): 273.8k on a 143 fork (USDC → Base). */
  cctpBurn: 330_000n,
  /** (D2) Across spoke deposit (swap/approval `swapTx`): 170.3k on a 143 fork (USDT0 → Arbitrum). */
  acrossDeposit: 250_000n,
  /**
   * (D2) LI.FI diamond call: XAUt0 → Ethereum over glacis (LayerZero OFT) 1,274.0k on a 143 fork; LI.FI's own limit
   * for it was 2,515.6k.
   */
  lifiBridge: 1_500_000n,
  /** (S6.12, D-155) sponsor-sent type-4 tx, one authorization: fork-measured 46.0k used, 50.7k sent. */
  delegate: 100_000n,
} as const;

export type GasAction = keyof typeof GAS_LIMITS;

/**
 * (S1b.16) Each pool past the first on a spot route (a MON-quoted token bought with USDC crosses two): the 2-hop worst
 * at $10–$1,000 was 346.5k (shMON buy) → 390k = `spotSwap` + this.
 */
export const SPOT_SWAP_GAS_PER_HOP = 40_000n;

/**
 * (S1b.16) What a spot swap spends beyond the pools' own swaps (router decode, Permit2 pull, settle, take, the token
 * transfers): `eth_estimateGas` − the Quoter's `gasEstimate` for the same swap. 143 fork, 55 swaps from $10 to $10,000:
 * 170.6k (MON buy) … 322.5k (a $10,000 USDT0 buy that crosses ~2.2M gas of ticks) → 330k.
 */
export const SPOT_SWAP_OVERHEAD_GAS = 330_000n;

/**
 * Budget for a spot swap crossing `hops` pools: the flat measured budget, or — when the quote's own gas metering is
 * given — that plus the overhead, with headroom, whichever is larger (tick crossings scale with the trade's size).
 */
export function spotSwapGasLimit(hops: number, quotedSwapGas?: bigint): bigint {
  const flat = GAS_LIMITS.spotSwap + SPOT_SWAP_GAS_PER_HOP * BigInt(Math.max(hops - 1, 0));
  if (quotedSwapGas === undefined) return flat;
  const sized = ((SPOT_SWAP_OVERHEAD_GAS + quotedSwapGas) * (GAS_BPS + GAS_HEADROOM_BPS)) / GAS_BPS;
  return sized > flat ? sized : flat;
}

/**
 * (D6) What an aggregator swap spends beyond the aggregator's own gas metering (router entry, token pulls, the
 * native wrap/unwrap): `eth_estimateGas` − the quote's gas. 143 fork, 2 Oct: Monorail 435.9k − 205.5k = 230.4k;
 * KyberSwap's metering already covers its overhead (1,221.1k estimated vs 1,243.9k metered).
 */
export const AGGREGATOR_SWAP_OVERHEAD_GAS = 250_000n;

/** Budget for an aggregator swap: the flat floor, or the quote's metering + overhead with headroom when larger. */
export function aggregatorSwapGasLimit(quotedSwapGas?: bigint): bigint {
  const flat = GAS_LIMITS.aggregatorSwap;
  if (quotedSwapGas === undefined) return flat;
  const sized = ((AGGREGATOR_SWAP_OVERHEAD_GAS + quotedSwapGas) * (GAS_BPS + GAS_HEADROOM_BPS)) / GAS_BPS;
  return sized > flat ? sized : flat;
}

/**
 * (S8.6, D-185) Extra budget per open position beyond the first, for actions whose risk pass reads every held market.
 * Measured p2 − p1 on the mainnet fork (the larger chain) × 1.10: 113.1k for one risk pass; increase 146.6k (skew +
 * caps); placeHold 199.9k (hold guard + risk pass both read each market); holds/refunds 113–134k.
 */
export const POSITION_GAS: Partial<Record<GasAction, bigint>> = {
  deposit: 130_000n,
  withdraw: 130_000n,
  increase: 170_000n,
  decrease: 130_000n,
  close: 130_000n,
  placeHold: 220_000n,
  increaseHold: 140_000n,
  captureHold: 150_000n,
  releaseHold: 130_000n,
  releaseExpiredHold: 130_000n,
  refund: 130_000n,
  executeTrigger: 130_000n,
  setSpendAllowance: 130_000n,
  revokeSpendAllowance: 130_000n,
  repayCardDebt: 130_000n,
  setCardEnvelope: 130_000n,
  swapCollateral: 130_000n,
  /** Two depositFor risk passes (AUSD and USDC) when both are swept. */
  sweepInbox: 260_000n,
};

/**
 * Budget for `action` on an account holding `positions` open positions (count the traded one; for an opening
 * increase, count it after the open). 0 or 1 → the flat GAS_LIMITS value; actions without a risk pass never scale.
 */
export function positionGasLimit(action: GasAction, positions: number): bigint {
  const extra = POSITION_GAS[action] ?? 0n;
  return GAS_LIMITS[action] + extra * BigInt(Math.max(positions - 1, 0));
}

/**
 * Proposed per-account cap on open engine positions (S8.23, D-189) — NOT enforced onchain: SenryoCore (immutable)
 * has no count check, so its bound is the listed market count (7 with FX). At 4 positions every action stays
 * ≤ ~1.2M gas (increase 690k + 3 × 170k; placeHold 500k + 3 × 220k; liquidate 350k + 4 × 180k): an increase needs
 * 1.2M × 127 gwei (the signed user max fee at the floor) = 0.152 MON, inside the mainnet 0.2 MON per-day top-up
 * cap; at 7 it needs 0.217 MON. Clients may block a 5th distinct market; budgets (keeper, card, top-ups) must still
 * scale with the ACTUAL count via `positionGasLimit` / `liquidateGasLimit`.
 */
export const MAX_OPEN_POSITIONS = 4;

/** Open positions in an `Account.positionBitmap` (one bit per market). */
export function positionCount(bitmap: number): number {
  let n = 0;
  for (let bits = bitmap >>> 0; bits !== 0; bits &= bits - 1) n += 1;
  return n;
}

/** Liquidation budget for an account with `positions` open positions. */
export function liquidateGasLimit(positions: number): bigint {
  return GAS_LIMITS.liquidate + LIQUIDATE_GAS_PER_POSITION * BigInt(Math.max(positions, 1));
}

/**
 * A gas top-up (S8.16c, D-171) funds this many of the user's next sends at their budget (limit × max fee), so a
 * practice session isn't a top-up per trade; the api clamps it to the drip's per-day cap.
 */
export const GAS_TOPUP_ACTIONS = 3n;

/**
 * Mainnet gas top-ups need real collateral in the account: the anti-sybil cost instead of a bot check (D-171). The api
 * enforces it, and the app's mainnet start card names it.
 */
export const MAINNET_TOPUP_MIN_EQUITY_USD6 = 10_000_000n;

/** Monad's `eth_maxPriorityFeePerGas` is a hard-coded 2 gwei (network-and-endpoints.md). */
export const PRIORITY_FEE_WEI = 2_000_000_000n;

/**
 * Base-fee multiplier for `maxFeePerGas` (bps): 2× absorbs a few blocks of base-fee rise. The charge is
 * gas LIMIT × effective price (base + priority), so a higher cap costs nothing unless the base fee really rises.
 */
export const MAX_FEE_BASE_MULTIPLIER_BPS = 20_000n;

/**
 * User sends (the app's sender and its gas budget) sign a tighter max fee: Monad consensus checks the balance against
 * gas LIMIT × max fee, so 2× doubled every user's gas reserve for nothing. Measured over the last 24 h (12 windows ×
 * 1,024 blocks, 30 Sep 2026; D-171): testnet flat at the 100 gwei floor; mainnet ≤ 106.1 gwei, worst 10-block rise
 * 6.1 %. 1.25× keeps 4× that headroom and cuts the reserve ~37 %. Services (card, keeper, liquidations) keep 2×.
 */
export const USER_MAX_FEE_BASE_MULTIPLIER_BPS = 12_500n;

/** Monad minimum base fee (100 MON-gwei) — used when a node reports none. */
export const MIN_BASE_FEE_WEI = 100_000_000_000n;
