import {
  type Address,
  contractCall,
  describeError,
  type Hex,
  readBalances,
  readContract,
  readHolds,
  readOracles,
  readPositionBitmaps,
  sendAndFinalize,
} from "@senryo/chain";
import { ENGINE_MARKETS, GAS_LIMITS, positionGasLimit } from "@senryo/config";
import { MS_PER_SECOND } from "@senryo/service-common";
import { HOLD_RELEASABLE_AFTER_SEC, HOLD_RELEASE_GRACE_SEC, INTERVALS_MS, TOPUP_MAX_PER_RUN } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Hold expiry (D-096): a card hold not captured/released by expiry + HOLD_RELEASE_GRACE may be released by anyone.
 * Candidates come from the ledger (holds the card service placed), re-checked onchain before sending.
 */
export function holdExpiryJob(ctx: KeeperContext): Job {
  return {
    name: "holds",
    intervalMs: INTERVALS_MS.holds,
    async run() {
      const rows = await ctx.db<{ hold_id: string }[]>`
        SELECT hold_id FROM holds
         WHERE chain_id = ${ctx.chainId} AND status IN ('ONCHAIN', 'FINALIZED')
           AND created_at < now() - make_interval(secs => ${HOLD_RELEASABLE_AFTER_SEC})`;
      if (rows.length === 0) return;
      const nowSec = BigInt(Math.floor(Date.now() / MS_PER_SECOND));
      const holds = await readHolds(
        ctx.read,
        ctx.chainId,
        rows.map((r) => r.hold_id as Hex),
      );
      for (const hold of holds) {
        if (hold.state !== "OPEN") {
          await ctx.db`UPDATE holds SET status = ${hold.state === "CAPTURED" ? "CAPTURED" : "RELEASED"}, updated_at = now()
                        WHERE hold_id = ${hold.holdId}`;
          continue;
        }
        if (hold.expiry + BigInt(HOLD_RELEASE_GRACE_SEC) > nowSec) continue;
        try {
          const sent = await sendAndFinalize(
            ctx.sender,
            contractCall(ctx.chainId, "SenryoCore", "releaseExpiredHold", [hold.holdId], "releaseExpiredHold"),
          );
          ctx.log.info({ holdId: hold.holdId, tx: sent.hash, stage: sent.final.stage }, "expired hold released");
        } catch (error) {
          ctx.log.warn({ holdId: hold.holdId, err: describeError(error) }, "expired hold not releasable yet");
        }
      }
    },
  };
}

/**
 * TP/SL triggers (D-034): orders come from the indexer (`TriggerPlaced`); execute when the oracle crosses. The order
 * struct is read onchain (`triggerOrder(orderId)`), the crossing re-checked by the contract (a miss reverts in
 * simulation and nothing is sent).
 */
export function triggerJob(ctx: KeeperContext): Job {
  return {
    name: "triggers",
    intervalMs: INTERVALS_MS.triggers,
    async run() {
      const orderIds = await ctx.source.triggerOrders();
      if (orderIds.length === 0) return;
      const core = readContract(ctx.chainId, "SenryoCore", ctx.read);
      const views = await readOracles(
        ctx.read,
        ctx.chainId,
        ENGINE_MARKETS.map((m) => m.id),
      );
      for (const orderId of orderIds) {
        const order = await core.read.triggerOrder([orderId]);
        const view = views.find((v) => v.marketId === order.marketId);
        if (view?.status !== "OPEN" || order.sizeDelta === 0n) continue;
        const price = view.price18;
        const above = price >= order.triggerPrice18;
        // Long TP fires above, long SL below; short TP below, short SL above.
        const crossed = order.isLong === order.takeProfit ? above : !above;
        if (!crossed) continue;
        try {
          const sent = await sendAndFinalize(
            ctx.sender,
            // Cap for an account holding every market (D-185); the limit itself is estimate + headroom.
            contractCall(ctx.chainId, "SenryoCore", "executeTrigger", [orderId], "executeTrigger", {
              gasCap: positionGasLimit("executeTrigger", ENGINE_MARKETS.length),
            }),
          );
          ctx.log.info({ orderId, tx: sent.hash, stage: sent.final.stage }, "trigger executed");
        } catch (error) {
          ctx.log.warn({ orderId, err: describeError(error) }, "trigger not executable");
        }
      }
    },
  };
}

/**
 * Auto gas top-up (D-030): users below TOPUP_FLOOR_WEI get TOPUP_AMOUNT_WEI from StarterDrip (`topUp`, RELAYER_ROLE;
 * the contract caps it per address per UTC day and by the daily budget). The keeper never sends MON itself.
 */
export function topUpJob(ctx: KeeperContext): Job {
  return {
    name: "topups",
    intervalMs: INTERVALS_MS.topups,
    async run() {
      // Only accounts that actually trade (an open position) — not every address that ever claimed — at most
      // TOPUP_MAX_PER_RUN per run, and the run stops at the first budget refusal (S8.5b K4).
      const users = await ctx.source.accounts();
      const bitmaps = await readPositionBitmaps(ctx.read, ctx.chainId, users);
      const trading = users.filter((u) => (bitmaps.get(u) ?? 0) !== 0);
      const balances = await readBalances(ctx.read, trading);
      const low = trading.filter((u) => (balances.get(u) ?? 0n) < ctx.env.TOPUP_FLOOR_WEI).slice(0, TOPUP_MAX_PER_RUN);
      for (const user of low) {
        if (!(await topUp(ctx, user))) break;
      }
    },
  };
}

/** true = topped up (or skipped for a per-user cap); false = stop the run (budget or role). */
async function topUp(ctx: KeeperContext, user: Address): Promise<boolean> {
  try {
    const sent = await sendAndFinalize(
      ctx.sender,
      contractCall(ctx.chainId, "StarterDrip", "topUp", [user, ctx.env.TOPUP_AMOUNT_WEI], "topUp", {
        gasCap: GAS_LIMITS.topUp,
      }),
    );
    ctx.log.info({ user, tx: sent.hash, stage: sent.final.stage }, "gas top-up");
    return true;
  } catch (error) {
    const reason = describeError(error);
    ctx.log.warn({ user, err: reason }, "gas top-up refused (cap/budget/role)");
    return !/Budget|Unauthorized|AccessManaged/i.test(reason);
  }
}
