/**
 * Perpl journeys as ordered sends for the operations journal (D1, capability card C4). Each planner reads the chain
 * once, decides which steps are needed and returns them with the `plannedActions` and `reviewedIntent` a trace runs
 * them under — the same shape the spot swap uses (approvals first, the trade last; stop at the first failure).
 *
 *   open:     [perplApprove?] → [perplCreateAccount | perplDeposit]? → perplOrder
 *   close:    perplOrder (reduce-only)
 *   withdraw: perplWithdraw
 *
 * The order step is a builder (`() => Promise<TxRequest>`): it reads the head block right before signing, so
 * `lastExecutionBlock` = head + 20 is counted from the moment the passkey check ends, not from review. The price
 * bound is fixed at review and never re-derived. Success comes from `decodePerplOrder(receipt.logs)`, not the receipt.
 */
import {
  type PerplAccount,
  type PerplMarketTerms,
  type PerplPosition,
  type PerplSide,
  perplApproveRequest,
  perplCreateAccountRequest,
  perplDepositRequest,
  perplLimitPrice,
  perplLotsFor,
  perplMarginRequired,
  perplNotional,
  perplOrderRequest,
  perplTakerSide,
  perplWithdrawRequest,
  type ReadClient,
  readPerplAccount,
  readPerplExchange,
  readPerplMarketTerms,
  readPerplPositions,
  readPerplWalletCollateral,
  type TxRequest,
} from "@senryo/chain";
import {
  type ChainId,
  type GasAction,
  PERPL_MIN_DEPOSIT_CNS,
  PERPL_MIN_WITHDRAW_CNS,
  PERPL_SLIPPAGE_BPS,
} from "@senryo/config";
import { type Address, BPS_DENOMINATOR } from "@senryo/core";

/** Why a Perpl journey can't be sent as reviewed. */
export type PerplBlocker =
  | "halted"
  | "paused"
  | "frozen"
  | "no-account"
  | "leverage"
  | "size"
  | "wallet-short"
  | "no-position"
  | "over-available"
  | "under-minimum";

/** One send of a journey: a ready request, or the order built at signing time. */
export type PerplStep = TxRequest | (() => Promise<TxRequest>);

export interface PerplPlan {
  /** Steps in send order, and their actions for the journal (`trace.run(..., { plannedActions })`). */
  steps: PerplStep[];
  plannedActions: GasAction[];
  reviewedIntent: Record<string, string>;
  /** Set when the journey can't run as reviewed; `steps` is then empty. */
  blocker: PerplBlocker | undefined;
}

export interface PerplOpenPlan extends PerplPlan {
  terms: PerplMarketTerms;
  account: PerplAccount | undefined;
  lots: bigint;
  limitPricePNS: bigint;
  /** Notional at the limit price (the most the fill can cost), and the free collateral it needs. */
  notionalCNS: bigint;
  marginCNS: bigint;
  /** AUSD the journey moves from the wallet into Perpl (0 when the account already covers the margin). */
  depositCNS: bigint;
  /** Wallet AUSD missing for that deposit (a swap from another asset can fill it first). */
  walletShortCNS: bigint;
}

export interface PerplOpenInput {
  /** The deployment the order is reviewed for — always explicit (Perpl market ids differ per network). */
  chainId: ChainId;
  marketId: number;
  side: PerplSide;
  /** Exposure in AUSD base units; sized to whole lots at the limit price (rounded down). */
  notionalCNS: bigint;
  leverageHdths: bigint;
  slippageBps?: bigint | undefined;
  /** Deposit at least this much (a user-chosen top-up); default: just what the margin needs, raised to the minimums. */
  minDepositCNS?: bigint | undefined;
}

const orderStep =
  (read: ReadClient, chainId: ChainId, params: Omit<Parameters<typeof perplOrderRequest>[1], "headBlock">): PerplStep =>
  async () =>
    perplOrderRequest(chainId, { ...params, headBlock: await read.getBlockNumber() });

const blocked = <T extends PerplPlan>(plan: Omit<T, "steps" | "plannedActions" | "blocker">, blocker: PerplBlocker) =>
  ({ ...plan, steps: [], plannedActions: [], blocker }) as unknown as T;

/** Open (or add to) a position: the funding steps the account needs, then the IOC. */
export async function perplOpenOperation(
  read: ReadClient,
  owner: Address,
  input: PerplOpenInput,
): Promise<PerplOpenPlan> {
  const chainId = input.chainId;
  const slippageBps = input.slippageBps ?? PERPL_SLIPPAGE_BPS;
  const [terms, exchange, account, wallet] = await Promise.all([
    readPerplMarketTerms(read, chainId, input.marketId),
    readPerplExchange(read, chainId),
    readPerplAccount(read, chainId, owner),
    readPerplWalletCollateral(read, chainId, owner),
  ]);
  const limitPricePNS = perplLimitPrice(terms.markPNS, perplTakerSide("open", input.side), slippageBps);
  const lots = perplLotsFor(input.notionalCNS, limitPricePNS, terms);
  const notionalCNS = perplNotional(lots, limitPricePNS, terms);
  const leverageOk = input.leverageHdths > 0n && input.leverageHdths <= terms.maxLeverageHdths;
  const marginCNS = leverageOk
    ? perplMarginRequired({
        notionalCNS,
        leverageHdths: input.leverageHdths,
        takerFeePpm: terms.takerFeePpm,
        slippageBps,
      })
    : 0n;
  const available = account?.availableCNS ?? 0n;
  const shortfall = marginCNS > available ? marginCNS - available : 0n;
  const floor = account ? PERPL_MIN_DEPOSIT_CNS : exchange.minAccountOpenCNS;
  const wanted = input.minDepositCNS ?? 0n;
  const needed = shortfall > wanted ? shortfall : wanted;
  const depositCNS = needed === 0n ? 0n : needed > floor ? needed : floor;
  const walletShortCNS = depositCNS > wallet.balance ? depositCNS - wallet.balance : 0n;
  const reviewedIntent = {
    venue: "perpl",
    chainId: String(chainId),
    intent: "open",
    marketId: String(input.marketId),
    side: input.side,
    lots: lots.toString(),
    notional: notionalCNS.toString(),
    limitPricePNS: limitPricePNS.toString(),
    leverageHdths: input.leverageHdths.toString(),
    slippageBps: slippageBps.toString(),
    deposit: depositCNS.toString(),
  };
  const base = {
    terms,
    account,
    lots,
    limitPricePNS,
    notionalCNS,
    marginCNS,
    depositCNS,
    walletShortCNS,
    reviewedIntent,
  };
  const blocker: PerplBlocker | undefined = exchange.halted
    ? "halted"
    : terms.paused
      ? "paused"
      : account && account.frozen !== 0
        ? "frozen"
        : !leverageOk
          ? "leverage"
          : lots === 0n
            ? "size"
            : walletShortCNS > 0n
              ? "wallet-short"
              : undefined;
  if (blocker) return blocked<PerplOpenPlan>(base, blocker);
  const steps: PerplStep[] = [];
  if (depositCNS > 0n && wallet.allowance < depositCNS) steps.push(perplApproveRequest(chainId, depositCNS));
  if (depositCNS > 0n)
    steps.push(account ? perplDepositRequest(chainId, depositCNS) : perplCreateAccountRequest(chainId, depositCNS));
  steps.push(
    orderStep(read, chainId, {
      marketId: input.marketId,
      intent: "open",
      side: input.side,
      lots,
      limitPricePNS,
      leverageHdths: input.leverageHdths,
    }),
  );
  const plannedActions = steps.map((s): GasAction => (typeof s === "function" ? "perplOrder" : s.action));
  return { ...base, steps, plannedActions, blocker: undefined };
}

export interface PerplClosePlan extends PerplPlan {
  position: PerplPosition | undefined;
  lots: bigint;
  limitPricePNS: bigint;
}

/** Close `shareBps` of the position on `marketId` (10,000 = all) with a reduce-only IOC. */
export async function perplCloseOperation(
  read: ReadClient,
  owner: Address,
  input: {
    chainId: ChainId;
    marketId: number;
    shareBps?: bigint | undefined;
    slippageBps?: bigint | undefined;
  },
): Promise<PerplClosePlan> {
  const chainId = input.chainId;
  const slippageBps = input.slippageBps ?? PERPL_SLIPPAGE_BPS;
  const shareBps = input.shareBps ?? BPS_DENOMINATOR;
  const [terms, account] = await Promise.all([
    readPerplMarketTerms(read, chainId, input.marketId),
    readPerplAccount(read, chainId, owner),
  ]);
  const [position] = account ? await readPerplPositions(read, chainId, account.accountId, [input.marketId]) : [];
  const side = position?.side ?? "long";
  const limitPricePNS = perplLimitPrice(terms.markPNS, perplTakerSide("close", side), slippageBps);
  // A full close sends the exact size (always allowed, even below any minimum); a share rounds down to whole lots.
  const lots = position
    ? shareBps >= BPS_DENOMINATOR
      ? position.lots
      : (position.lots * shareBps) / BPS_DENOMINATOR
    : 0n;
  const reviewedIntent = {
    venue: "perpl",
    chainId: String(chainId),
    intent: "close",
    marketId: String(input.marketId),
    side,
    lots: lots.toString(),
    limitPricePNS: limitPricePNS.toString(),
    slippageBps: slippageBps.toString(),
  };
  const base = { position, lots, limitPricePNS, reviewedIntent };
  if (!position) return blocked<PerplClosePlan>(base, "no-position");
  if (lots === 0n) return blocked<PerplClosePlan>(base, "size");
  // A close carries the market's maximum leverage, as Perpl's SDK does for orders that name none (reduce-only).
  const steps = [
    orderStep(read, chainId, {
      marketId: input.marketId,
      intent: "close",
      side,
      lots,
      limitPricePNS,
      leverageHdths: terms.maxLeverageHdths,
    }),
  ];
  return { ...base, steps, plannedActions: ["perplOrder"], blocker: undefined };
}

/** Withdraw free collateral back to the wallet (the contract always pays the account's own address). */
export async function perplWithdrawOperation(
  read: ReadClient,
  owner: Address,
  amountCNS: bigint,
  chainId: ChainId,
): Promise<PerplPlan> {
  const account = await readPerplAccount(read, chainId, owner);
  const reviewedIntent = { venue: "perpl", intent: "withdraw", withdraw: amountCNS.toString() };
  const blocker: PerplBlocker | undefined = !account
    ? "no-account"
    : amountCNS < PERPL_MIN_WITHDRAW_CNS
      ? "under-minimum"
      : amountCNS > account.availableCNS
        ? "over-available"
        : undefined;
  if (blocker) return blocked<PerplPlan>({ reviewedIntent }, blocker);
  return {
    steps: [perplWithdrawRequest(chainId, amountCNS)],
    plannedActions: ["perplWithdraw"],
    reviewedIntent,
    blocker: undefined,
  };
}
