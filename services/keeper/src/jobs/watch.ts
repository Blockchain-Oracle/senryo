import { type Address, getAddress, readAccountSnapshot, readBalances, readOracles } from "@senryo/chain";
import { engineMarketsOn } from "@senryo/config";
import { BPS, HEALTH_WARN_MARGIN_BPS, INTERVALS_MS } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import { healthWarningPush, priceAlertPush } from "../push-messages.ts";
import type { Job } from "../runner.ts";

/**
 * Price alerts (`price_alerts`) and `healthWatch` (a warning push per oracle round when an account's liquidation
 * equity is within HEALTH_WARN_MARGIN_BPS of maintenance). Both are evaluated on the *accepted* oracle price at
 * `finalized` and are idempotent per event key, so a restart never re-sends.
 */
export function alertsJob(ctx: KeeperContext): Job {
  return {
    name: "alerts",
    intervalMs: INTERVALS_MS.alerts,
    async run() {
      const marketIds = engineMarketsOn(ctx.chainId).map((m) => m.id);
      const views = await readOracles(ctx.read, ctx.chainId, marketIds, "finalized");
      for (const view of views) {
        if (view.price18 === 0n) continue;
        const hits = await ctx.db<
          { id: string; user_address: string; direction: "above" | "below"; price18: string }[]
        >`
          UPDATE price_alerts SET status = 'triggered', triggered_at = now()
           WHERE chain_id = ${ctx.chainId} AND market_id = ${view.marketId} AND status = 'active'
             AND ((direction = 'above' AND price18 <= ${view.price18.toString()}::numeric)
               OR (direction = 'below' AND price18 >= ${view.price18.toString()}::numeric))
          RETURNING id, user_address, direction, price18`;
        for (const hit of hits) {
          await ctx.notifier.push(
            ctx.chainId,
            `alert:${hit.id}`,
            hit.user_address,
            "priceAlerts",
            priceAlertPush(ctx.chainId, view.marketId, hit.direction, BigInt(hit.price18), view.price18),
          );
        }
      }
      await healthWatch(ctx, views.map((v) => `${v.marketId}:${v.updatedAt}`).join(","));
    },
  };
}

async function healthWatch(ctx: KeeperContext, roundKey: string): Promise<void> {
  const accounts = await ctx.source.accounts();
  for (const user of accounts) {
    const snap = await readAccountSnapshot(ctx.read, ctx.chainId, user, "finalized");
    if (snap.positionBitmap === 0 || snap.mm === 0n) continue;
    const warnBelow = snap.mm + (snap.mm * BigInt(HEALTH_WARN_MARGIN_BPS)) / BPS;
    if (snap.equityLiq >= warnBelow) continue;
    await ctx.notifier.push(
      ctx.chainId,
      `health:${user}:${roundKey}`,
      user,
      "liquidation",
      healthWarningPush(ctx.chainId, soleMarket(snap.positionBitmap)),
    );
  }
}

/** The market id when the bitmap holds exactly one position (a warning then opens it), else undefined. */
function soleMarket(bitmap: number): number | undefined {
  if (bitmap === 0 || (bitmap & (bitmap - 1)) !== 0) return undefined;
  return Math.log2(bitmap);
}

/** Ops: operational wallets below their floor (Monad reserve rule: senders of value keep > 10 MON on mainnet). */
export function walletsJob(ctx: KeeperContext): Job {
  const watched: Address[] = [
    ctx.sender.account.address,
    ...(ctx.env.OPS_WATCH_WALLETS ?? []).map((a) => getAddress(a)),
  ];
  return {
    name: "wallets",
    intervalMs: INTERVALS_MS.wallets,
    async run() {
      const balances = await readBalances(ctx.read, watched);
      for (const [address, balance] of balances) {
        if (balance < ctx.env.WALLET_FLOOR_WEI) {
          ctx.notifier.ops("warn", "wallet below floor", {
            address,
            balanceWei: balance.toString(),
            floorWei: ctx.env.WALLET_FLOOR_WEI.toString(),
          });
        }
      }
    },
  };
}
