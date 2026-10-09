import {
  addressOf,
  claimEarnCallData,
  describeError,
  earnDeployed,
  type Hex,
  rollCallData,
  sendTx,
} from "@senryo/chain";
import { poolSharesAbi } from "@senryo/contracts/abis";
import { nowSec } from "@senryo/service-common";
import { EARN_CLAIMS_PER_TICK, EARN_INTERVAL_MS, HOUR_SEC } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Earn's hour (D-287): once a UTC hour is past and every window ending in the hour before it is settled, roll it —
 * the contract refuses earlier (`HourNotSettled`), so a refused simulation just means "next minute". Then deliver:
 * every owner who asked through the relay and whose supply or withdrawal that roll settled gets its `claim` sent, so
 * shares and dollars arrive without anyone coming back for them.
 */
export function earnJob(ctx: KeeperContext): Job {
  return {
    name: "earn",
    intervalMs: EARN_INTERVAL_MS,
    run: async () => {
      if (!earnDeployed(ctx.chainId)) return;
      await rollIfDue(ctx);
      await deliver(ctx);
    },
  };
}

async function rollIfDue(ctx: KeeperContext): Promise<void> {
  const shares = addressOf(ctx.chainId, "PoolShares");
  const lastRoll = Number(
    await ctx.read.readContract({ address: shares, abi: poolSharesAbi, functionName: "lastRoll" }),
  );
  const now = nowSec();
  const hour = now - (now % HOUR_SEC);
  if (hour <= lastRoll) return;
  try {
    await send(ctx, shares, rollCallData(hour), "earnRoll", String(hour));
  } catch (error) {
    ctx.log.debug({ hour, err: describeError(error) }, "earn roll not due yet");
  }
}

async function deliver(ctx: KeeperContext): Promise<void> {
  const shares = addressOf(ctx.chainId, "PoolShares");
  const owners = await ctx.db<{ owner: string }[]>`
    SELECT owner FROM earn_owners WHERE chain_id = ${ctx.chainId} AND delivered_at IS NULL
    ORDER BY last_request_at LIMIT ${EARN_CLAIMS_PER_TICK}`;
  for (const { owner } of owners) {
    const who = owner as Hex;
    const [supply, withdraw] = await Promise.all([
      ctx.read.readContract({ address: shares, abi: poolSharesAbi, functionName: "supplyOf", args: [who] }),
      ctx.read.readContract({ address: shares, abi: poolSharesAbi, functionName: "withdrawOf", args: [who] }),
    ]);
    const [supplyDone, withdrawDone] = await Promise.all([
      ctx.read.readContract({ address: shares, abi: poolSharesAbi, functionName: "supplyBatch", args: [supply[0]] }),
      ctx.read.readContract({
        address: shares,
        abi: poolSharesAbi,
        functionName: "withdrawBatch",
        args: [withdraw[0]],
      }),
    ]);
    const settled = (supply[1] > 0n && supplyDone[3]) || (withdraw[1] > 0n && withdrawDone[3]);
    const waiting = (supply[1] > 0n && !supplyDone[3]) || (withdraw[1] > 0n && !withdrawDone[3]);
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
  action: "earnRoll" | "earnClaim",
  subject: string,
): Promise<void> {
  const sent = await sendTx(ctx.sender, { to, data, action, meta: { job: "earn", subject } });
  ctx.recent.add({ job: "earn", subject, tx: sent.hash, stage: sent.stage });
  ctx.log.info({ actor: "keeper", why: action, subject, tx: sent.hash }, "earn step sent");
  if (sent.stage === "reverted") throw new Error(`${action} reverted in ${sent.hash}`);
}
