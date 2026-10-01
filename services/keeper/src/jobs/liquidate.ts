import {
  type Address,
  contractCall,
  describeError,
  readAccountSnapshot,
  readLiquidatable,
  sendAndFinalize,
} from "@senryo/chain";
import { liquidateGasLimit } from "@senryo/config";
import type { KeeperContext } from "../context.ts";
import { receiptFills } from "../fills.ts";
import { liquidatedPush } from "../push-messages.ts";
import type { Job } from "../runner.ts";

/** Bits set in the account's position bitmap (= open positions → liquidation gas budget). */
export function countPositions(bitmap: number): number {
  let count = 0;
  for (let bits = bitmap; bits !== 0; bits >>>= 1) count += bits & 1;
  return count;
}

/**
 * Liquidation scan: candidates from the source → one multicall `isLiquidatable` (view risk uses `peek`, so a fresh
 * oracle round counts at once) → `liquidate(user)` simulated (estimate) and sent with the per-position gas budget,
 * confirmed at `finalized`, then the owner gets a `liquidation` push naming what closed. Permissionless onchain; the
 * keeper just makes sure someone does it promptly.
 */
export function liquidationJob(ctx: KeeperContext): Job {
  const inflight = new Set<string>();
  return {
    name: "liquidate",
    intervalMs: ctx.env.LIQUIDATE_MS,
    async run() {
      const accounts = await ctx.source.accounts();
      const flags = await readLiquidatable(ctx.read, ctx.chainId, accounts);
      // Rows whose read failed are retried once on their own; still unread → the scan is incomplete and says so
      // (job error + ops alert) instead of treating those accounts as healthy (S8.5b K1).
      const unread = accounts.filter((a) => flags.get(a) === undefined);
      const retried = unread.length > 0 ? await readLiquidatable(ctx.read, ctx.chainId, unread) : new Map();
      const due = accounts.filter(
        (a) => (flags.get(a) === true || retried.get(a) === true) && !inflight.has(a.toLowerCase()),
      );
      await Promise.all(due.map((user) => liquidate(ctx, user, inflight)));
      const missing = unread.filter((a) => retried.get(a) === undefined).length;
      if (missing > 0) {
        ctx.notifier.ops("warn", "liquidation scan incomplete", { unread: missing, scanned: accounts.length });
        throw new Error(`liquidation scan incomplete: ${missing} of ${accounts.length} accounts unread`);
      }
    },
  };
}

async function liquidate(ctx: KeeperContext, user: Address, inflight: Set<string>): Promise<void> {
  const key = user.toLowerCase();
  inflight.add(key);
  const started = Date.now();
  try {
    const snapshot = await readAccountSnapshot(ctx.read, ctx.chainId, user, "latest");
    const positions = countPositions(snapshot.positionBitmap);
    const request = contractCall(ctx.chainId, "SenryoCore", "liquidate", [user], "liquidate", {
      gasCap: liquidateGasLimit(positions),
      meta: { user },
    });
    ctx.log.info({ user, positions, equityLiq: snapshot.equityLiq, mm: snapshot.mm }, "liquidating");
    const sent = await sendAndFinalize(ctx.sender, request);
    ctx.log.info(
      { user, tx: sent.hash, stage: sent.final.stage, gas: sent.gas, ms: Date.now() - started },
      "liquidation settled",
    );
    ctx.recent.add({ job: "liquidate", subject: user, tx: sent.hash, stage: sent.final.stage });
    if (sent.final.stage !== "finalized")
      ctx.notifier.ops("warn", "liquidation did not finalize", { user, tx: sent.hash });
    else
      await ctx.notifier.push(
        ctx.chainId,
        `liquidated:${sent.hash}`,
        user,
        "liquidation",
        liquidatedPush(ctx.chainId, receiptFills(sent.final.receipt, user, "LIQUIDATE")),
      );
  } catch (error) {
    // A race (someone else liquidated, or the price moved back) reverts in simulation: nothing was sent.
    ctx.log.warn({ user, err: describeError(error) }, "liquidation skipped");
  } finally {
    inflight.delete(key);
  }
}
