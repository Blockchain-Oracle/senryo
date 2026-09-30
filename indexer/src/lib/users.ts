/** User rows (the Mera account address) and the unified activity feed. */
import type { Activity, User } from "envio";
import type { Ctx, Meta } from "./meta.ts";
import { updateProtocol, updateProtocolDaily } from "./stats.ts";

function newUser(id: string, meta: Meta): User {
  return {
    id,
    createdAt: meta.timestamp,
    createdBlock: meta.block,
    lastActiveAt: meta.timestamp,
    riskNonce: 0n,
    equityInit: 0n,
    imTotal: 0n,
    mmTotal: 0n,
    holds: 0n,
    cardDebt: 0n,
    envelope: 0n,
    freeToTrade: 0n,
    freeToSpend: 0n,
    riskUpdatedAt: undefined,
    riskBlock: undefined,
    deposited: 0n,
    withdrawn: 0n,
    realizedPnl: 0n,
    feesPaid: 0n,
    fundingPaid: 0n,
    borrowPaid: 0n,
    volume: 0n,
    cardSpent: 0n,
    cardRefunded: 0n,
    perplCollateral: 0n,
    tradeCount: 0,
    liquidationCount: 0,
    openPositions: 0,
    vouchersRedeemed: 0,
    firstDepositAt: undefined,
    firstTradeAt: undefined,
    perplAccount_id: undefined,
  };
}

/**
 * Loads a user, creating (and counting) it on first sight. A new user is linked to a Perpl account the same owner
 * created earlier, so Perpl fills after this point are attributed to the app user.
 */
export async function loadUser(ctx: Ctx, id: string, meta: Meta): Promise<User> {
  const existing = await ctx.User.get(id);
  if (existing) return existing;
  const [perpl] = await ctx.PerplAccount.getWhere({ owner: { _eq: id } });
  const user: User = { ...newUser(id, meta), perplAccount_id: perpl?.id };
  if (perpl) ctx.PerplAccount.set({ ...perpl, user_id: id });
  ctx.User.set(user);
  await updateProtocol(ctx, meta, (s) => ({ users: s.users + 1 }));
  await updateProtocolDaily(ctx, meta, (d) => ({ newUsers: d.newUsers + 1 }));
  return user;
}

/** Applies a patch to the user and stamps activity time. */
export async function updateUser(ctx: Ctx, meta: Meta, id: string, patch: (u: User) => Partial<User>): Promise<User> {
  const user = await loadUser(ctx, id, meta);
  const next: User = { ...user, ...patch(user), lastActiveAt: meta.timestamp };
  ctx.User.set(next);
  return next;
}

type ActivityRefs = Partial<
  Pick<
    Activity,
    "amount" | "symbol" | "market_id" | "fill_id" | "move_id" | "hold_id" | "trigger_id" | "liquidation_id"
  >
>;

/** One feed row per user-visible event; `suffix` separates several rows from one log. */
export function addActivity(
  ctx: Ctx,
  meta: Meta,
  userId: string,
  kind: Activity["kind"],
  refs: ActivityRefs = {},
  suffix = "",
): void {
  ctx.Activity.set({
    id: suffix ? `${meta.id}-${suffix}` : meta.id,
    user_id: userId,
    kind,
    timestamp: meta.timestamp,
    block: meta.block,
    txHash: meta.txHash,
    amount: undefined,
    symbol: undefined,
    market_id: undefined,
    fill_id: undefined,
    move_id: undefined,
    hold_id: undefined,
    trigger_id: undefined,
    liquidation_id: undefined,
    ...refs,
  });
}
