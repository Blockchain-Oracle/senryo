import {
  addressOf,
  aggregate,
  type Call,
  claimEarnCallData,
  describeError,
  earnDeployed,
  ensurePrintCallData,
  type Hex,
  MULTICALL3_ADDRESS,
  proofOf,
  RIDE_SIDE,
  refreshFrontierCallData,
  rollCallData,
  sendTx,
  verifierOf,
} from "@senryo/chain";
import { feedIdOf, rideMarketSpec } from "@senryo/config";
import { bandReserveAbi, poolSharesAbi } from "@senryo/contracts/abis";
import { archivedPrint, nowSec, openRidesBySide } from "@senryo/service-common";
import {
  EARN_CLAIMS_PER_TICK,
  EARN_DELIVER_EVERY_MS,
  EARN_INTERVAL_MS,
  EARN_MARK_SEND_BY_SEC,
  EARN_ROLL_AT_SEC,
  HOUR_SEC,
  MINUTE_SEC,
} from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Earn's hour (D-287, D-307): each hour is rolled in order once it is past and every window ending in the hour before
 * it is settled — the contract refuses earlier (`HourNotSettled`), so a refused simulation just means "next minute".
 * With rides open, the roll marks them at a print no more than 5 s old: just after a minute boundary, one transaction
 * records each ride market's boundary print, tightens every side's frontier to its open rides (so a stale edge can't
 * refuse the mark) and rolls. Then deliver: every owner who asked through the relay and whose supply or withdrawal a
 * roll settled gets its `claim` sent, so shares and dollars arrive without anyone coming back for them.
 */
export function earnJob(ctx: KeeperContext): Job {
  let triedMinute = 0;
  let deliveredAt = 0;
  return {
    name: "earn",
    intervalMs: EARN_INTERVAL_MS,
    run: async () => {
      if (!earnDeployed(ctx.chainId)) return;
      const now = nowSec();
      const minute = now - (now % MINUTE_SEC);
      if (minute > triedMinute && now - minute >= EARN_ROLL_AT_SEC) {
        triedMinute = minute;
        await rollIfDue(ctx, now, minute);
      }
      if (Date.now() - deliveredAt >= EARN_DELIVER_EVERY_MS) {
        deliveredAt = Date.now();
        await deliver(ctx);
      }
    },
  };
}

async function rollIfDue(ctx: KeeperContext, now: number, minute: number): Promise<void> {
  const shares = addressOf(ctx.chainId, "PoolShares");
  const reserve = addressOf(ctx.chainId, "BandReserve");
  const [lastRoll, ridesOpen] = await Promise.all([
    ctx.read.readContract({ address: shares, abi: poolSharesAbi, functionName: "lastRoll" }),
    ctx.read.readContract({ address: reserve, abi: bandReserveAbi, functionName: "ridesOpen" }),
  ]);
  const current = now - (now % HOUR_SEC);
  const hour = lastRoll === 0 ? current : lastRoll + HOUR_SEC;
  if (hour > current) return;
  try {
    if (!ridesOpen) {
      await send(ctx, shares, rollCallData(hour, hour), "earnRoll", String(hour));
      return;
    }
    if (minute < hour || now - minute > EARN_MARK_SEND_BY_SEC) return;
    const calls = await rideMarkCalls(ctx, minute);
    if (!calls) return;
    calls.push({ target: shares, allowFailure: false, callData: rollCallData(hour, minute) });
    await send(ctx, MULTICALL3_ADDRESS, aggregate(calls), "earnRollMarked", `${hour}@${minute}`);
  } catch (error) {
    ctx.log.debug({ hour, err: describeError(error) }, "earn roll not due yet");
  }
}

/** Each ride market with open rides: its print of `minute` recorded, each side's frontier refreshed (null: a print is
 *  not archived yet). */
async function rideMarkCalls(ctx: KeeperContext, minute: number): Promise<Call[] | null> {
  const windows = addressOf(ctx.chainId, "Windows");
  const reserve = addressOf(ctx.chainId, "BandReserve");
  const calls: Call[] = [];
  const sides = await openRidesBySide(ctx.db, ctx.chainId);
  for (const marketId of new Set(sides.map((s) => s.market_id))) {
    const market = rideMarketSpec(marketId);
    if (!market) return null;
    const print = await archivedPrint(ctx.db, feedIdOf(market), minute);
    if (!print) return null;
    calls.push({
      target: windows,
      allowFailure: true,
      callData: ensurePrintCallData(
        verifierOf(ctx.chainId, market),
        feedIdOf(market),
        minute,
        proofOf(market, print.updates),
      ),
    });
  }
  for (const s of sides) {
    const side = s.is_long ? RIDE_SIDE.long : RIDE_SIDE.short;
    calls.push({ target: reserve, allowFailure: true, callData: refreshFrontierCallData(s.market_id, side, s.ids) });
  }
  return calls;
}

/** A request's batch is done once its hour — or the hour a deferred withdrawal moved on to — has rolled. */
async function batchDone(
  ctx: KeeperContext,
  shares: Hex,
  functionName: "supplyBatch" | "withdrawBatch",
  hour: number,
): Promise<boolean> {
  let at = hour;
  for (;;) {
    const [, , , done, movedTo] = await ctx.read.readContract({
      address: shares,
      abi: poolSharesAbi,
      functionName,
      args: [at],
    });
    if (movedTo === 0) return done;
    at = movedTo;
  }
}

async function deliver(ctx: KeeperContext): Promise<void> {
  const shares = addressOf(ctx.chainId, "PoolShares");
  const owners = await ctx.db<{ owner: string }[]>`
    SELECT owner FROM earn_owners WHERE chain_id = ${ctx.chainId} AND delivered_at IS NULL
    ORDER BY last_request_at LIMIT ${EARN_CLAIMS_PER_TICK}`;
  for (const { owner } of owners) {
    const who = owner as Hex;
    const [[supplyHour, supplied], [withdrawHour, withdrawn]] = await Promise.all([
      ctx.read.readContract({ address: shares, abi: poolSharesAbi, functionName: "supplyOf", args: [who] }),
      ctx.read.readContract({ address: shares, abi: poolSharesAbi, functionName: "withdrawOf", args: [who] }),
    ]);
    const [supplyDone, withdrawDone] = await Promise.all([
      supplied > 0n ? batchDone(ctx, shares, "supplyBatch", supplyHour) : false,
      withdrawn > 0n ? batchDone(ctx, shares, "withdrawBatch", withdrawHour) : false,
    ]);
    const settled = supplyDone || withdrawDone;
    const waiting = (supplied > 0n && !supplyDone) || (withdrawn > 0n && !withdrawDone);
    try {
      if (settled) await send(ctx, shares, claimEarnCallData(who), "earnClaim", owner);
      if (!waiting)
        await ctx.db`UPDATE earn_owners SET delivered_at = now() WHERE chain_id = ${ctx.chainId} AND owner = ${owner}`;
    } catch (error) {
      ctx.log.warn({ owner, err: describeError(error) }, "earn delivery failed; retrying next tick");
    }
  }
}

async function send(
  ctx: KeeperContext,
  to: Hex,
  data: Hex,
  action: "earnRoll" | "earnRollMarked" | "earnClaim",
  subject: string,
): Promise<void> {
  const sent = await sendTx(ctx.sender, { to, data, action, meta: { job: "earn", subject } });
  ctx.recent.add({ job: "earn", subject, tx: sent.hash, stage: sent.stage });
  ctx.log.info({ actor: "keeper", why: action, subject, tx: sent.hash }, "earn step sent");
  if (sent.stage === "reverted") throw new Error(`${action} reverted in ${sent.hash}`);
}
