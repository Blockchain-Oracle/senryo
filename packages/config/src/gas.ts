/**
 * Gas budgets (Monad charges the gas LIMIT, not gas used — context/02-monad/differences-from-ethereum.md §1).
 * `packages/chain/send.ts` sets gas = estimate × (1 + GAS_HEADROOM_BPS), capped at the action's budget, and refuses to
 * send when the estimate alone is above the budget (something is wrong; a huge limit would be charged in full).
 *
 * Market budgets are ceilings for relayed and keeper sends (D-266, D-278); the limit actually set is the estimate plus
 * `GAS_HEADROOM_BPS`, so a ceiling only stops a runaway. Every user action is relayed, so users never hold gas.
 */

/** +10 % over `eth_estimateGas`: small on purpose — the whole limit is paid. */
export const GAS_HEADROOM_BPS = 1_000n;

/** Plain MON transfer (fixed cost). */
export const NATIVE_TRANSFER_GAS = 21_000n;

export const GAS_LIMITS = {
  transfer: NATIVE_TRANSFER_GAS,
  /** ERC-20 approve (finite allowances only, D-266). */
  approve: 110_000n,
  /** ERC-20 transfer of USDC / Test USD. */
  erc20Transfer: 90_000n,
  /** Circle USDC `transferWithAuthorization` (EIP-3009) relayed for withdrawals. */
  transferWithAuthorization: 120_000n,
  /** A commit, possibly batched with opening its window and recording the open print (Multicall3). */
  marketCommit: 900_000n,
  /** One `finalize` of up to 32 tickets at one print. */
  marketFinalize: 4_000_000n,
  /** Close print + resolve + settle + the first `claimFor` batch (Multicall3), or a further batch. */
  marketSettle: 5_000_000n,
  /** `expire` of up to 32 tickets. */
  marketExpire: 2_000_000n,
  sessionGrant: 300_000n,
  sessionRevoke: 150_000n,
  /** Test USD `mint` for the Practice grant. */
  dollarMint: 150_000n,
  /** A market calendar's `setWeek` (three words) or `addHoliday` (prune + push), kept current by the keeper (D-289). */
  calendarUpdate: 400_000n,
  /** Earn (D-287): a relayed request (with its permit), the hourly roll (60 expiry reads, a mint, fund/defund), a claim. */
  earnRequest: 400_000n,
  earnRoll: 1_500_000n,
  earnClaim: 200_000n,
  /** Exits (D-292): a relayed `setExit` (one slot and its signature), and firing one (`fireExit` / `fireTrail`). */
  exitSet: 200_000n,
  exitFire: 250_000n,
  /**
   * Duel (D-294), measured in the Foundry gas report (max): `openMatch` 518k (two entries, permits, pulls); the reveal
   * 214k plus opening up to three card windows with their line; a `pick` 495k (the arena's own commit at the reserve);
   * the keeper's steps — a lock 147k, three `settleCard`s at 303k and the pot 140k — in one batch.
   */
  duelOpen: 800_000n,
  duelReveal: 2_000_000n,
  duelPick: 800_000n,
  duelSettle: 2_500_000n,
  /**
   * Events (D-296), measured in the Foundry gas report (max): a `listEvent` 133k plus its text, eight to a batch; a
   * relayed `placeCall` 329k (with its permit, more); an `answer` 136k and a `resolve` 75k, a game's answers and its
   * verdict in one batch; `claimFor` 313k for six calls (up to 32 to a batch); `sweepFees` 159k.
   */
  eventList: 2_000_000n,
  eventCall: 500_000n,
  eventAnswer: 1_000_000n,
  eventClaim: 2_500_000n,
  eventSweep: 300_000n,
};
export type GasAction = keyof typeof GAS_LIMITS;

/** Monad's `eth_maxPriorityFeePerGas` is a hard-coded 2 gwei (network-and-endpoints.md). */
export const PRIORITY_FEE_WEI = 2_000_000_000n;

/**
 * Base-fee multiplier for `maxFeePerGas` (bps): 2× absorbs a few blocks of base-fee rise. The charge is
 * gas LIMIT × effective price (base + priority), so a higher cap costs nothing unless the base fee really rises.
 */
export const MAX_FEE_BASE_MULTIPLIER_BPS = 20_000n;

/**
 * Tighter max fee for user-signed sends (D-171): Monad checks the balance against gas LIMIT × max fee, so 2× doubles
 * the reserve for nothing. 24 h measurement (30 Sep): testnet flat at 100 gwei; mainnet ≤ 106.1 gwei, worst 10-block
 * rise 6.1 %. 1.25× keeps 4× that headroom.
 */
export const USER_MAX_FEE_BASE_MULTIPLIER_BPS = 12_500n;

/** Monad minimum base fee (100 MON-gwei) — used when a node reports none. */
export const MIN_BASE_FEE_WEI = 100_000_000_000n;
