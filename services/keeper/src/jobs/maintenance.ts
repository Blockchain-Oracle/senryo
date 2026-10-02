import {
  contractCall,
  describeError,
  type Hex,
  readContract,
  readHolds,
  readOracles,
  sendAndFinalize,
} from "@senryo/chain";
import { engineMarketsOn, positionGasLimit } from "@senryo/config";
import { MS_PER_SECOND } from "@senryo/service-common";
import { HOLD_RELEASABLE_AFTER_SEC, HOLD_RELEASE_GRACE_SEC, INTERVALS_MS } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import { receiptFills } from "../fills.ts";
import { triggerFillPush } from "../push-messages.ts";
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
 * simulation and nothing is sent). A finalized execution pushes `fills` to the owner at the receipt's fill price.
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
        engineMarketsOn(ctx.chainId).map((m) => m.id),
      );
      for (const orderId of orderIds) {
        const order = await core.read.triggerOrder([orderId]);
        const view = views.find((v) => v.marketId === order.marketId);
        if (view?.status !== "OPEN" || order.sizeDelta === 0n) continue;
        const price = view.price18;
        // Same test as `TriggerOrders.executeTrigger`, touch included both ways (flow book C6): long TP and short SL
        // fire at or above the level, long SL and short TP at or below it.
        const upward = order.isLong === order.takeProfit;
        const crossed = upward ? price >= order.triggerPrice18 : price <= order.triggerPrice18;
        if (!crossed) continue;
        try {
          const sent = await sendAndFinalize(
            ctx.sender,
            // Cap for an account holding every market (D-185); the limit itself is estimate + headroom.
            contractCall(ctx.chainId, "SenryoCore", "executeTrigger", [orderId], "executeTrigger", {
              gasCap: positionGasLimit("executeTrigger", engineMarketsOn(ctx.chainId).length),
            }),
          );
          ctx.log.info({ orderId, tx: sent.hash, stage: sent.final.stage }, "trigger executed");
          if (sent.final.stage === "finalized") {
            const [fill] = receiptFills(sent.final.receipt, order.user, "TRIGGER");
            await ctx.notifier.push(
              ctx.chainId,
              `fill:${sent.hash}`,
              order.user,
              "fills",
              triggerFillPush(ctx.chainId, order, fill),
            );
          }
        } catch (error) {
          ctx.log.warn({ orderId, err: describeError(error) }, "trigger not executable");
        }
      }
    },
  };
}
