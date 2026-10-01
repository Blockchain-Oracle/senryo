import {
  type Address,
  contractCall,
  describeError,
  getAddress,
  readInboxBalances,
  readPositionBitmaps,
  sendAndFinalize,
} from "@senryo/chain";
import { positionCount, positionGasLimit } from "@senryo/config";
import { SWEEP_RETRY_MS, SWEEPS_PER_TICK } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";
import type { InboxCandidate } from "../sources.ts";

/**
 * Deposit inbox sweeper (S8.24, D-179): the cold-start path that needs no MON from the user. Candidates are the
 * deployed inboxes the indexer saw money arrive at, plus the counterfactual ones the app registered (`inbox_watches`);
 * the balance is re-read onchain and the keeper calls the permissionless `InboxFactory.sweep(user)` (deploy on first
 * use, then `depositFor(user)`) once AUSD + USDC there reach the minimum. A failed sweep simulates and reverts before
 * sending, then waits SWEEP_RETRY_MS; at most SWEEPS_PER_TICK sends per tick bound the MON a burst can spend.
 */
export function sweepJob(ctx: KeeperContext): Job {
  const retryAt = new Map<Address, number>();
  return {
    name: "sweeps",
    intervalMs: ctx.env.SWEEPS_MS,
    async run() {
      const candidates = await sweepCandidates(ctx);
      if (candidates.length === 0) return;
      const balances = await readInboxBalances(
        ctx.read,
        ctx.chainId,
        candidates.map((c) => c.inbox),
      );
      const now = Date.now();
      const due = candidates
        .filter((c) => (balances.get(c.inbox) ?? 0n) >= ctx.env.SWEEP_MIN_USD6 && (retryAt.get(c.user) ?? 0) <= now)
        .slice(0, SWEEPS_PER_TICK);
      if (due.length === 0) return;
      const bitmaps = await readPositionBitmaps(
        ctx.read,
        ctx.chainId,
        due.map((c) => c.user),
      );
      for (const c of due) {
        // depositFor runs the account's risk pass, so the budget scales with its open positions.
        const gasCap = positionGasLimit("sweepInbox", positionCount(bitmaps.get(c.user) ?? 0));
        try {
          const sent = await sendAndFinalize(
            ctx.sender,
            contractCall(ctx.chainId, "InboxFactory", "sweep", [c.user], "sweepInbox", { gasCap }),
          );
          retryAt.delete(c.user);
          await ctx.db`
            UPDATE inbox_watches SET last_swept_at = now(), sweep_count = sweep_count + 1, updated_at = now()
             WHERE chain_id = ${ctx.chainId} AND user_address = ${c.user.toLowerCase()}`;
          ctx.recent.add({ job: "sweeps", subject: c.user, tx: sent.hash, stage: sent.final.stage });
          ctx.log.info(
            { user: c.user, inbox: c.inbox, usd6: balances.get(c.inbox)?.toString(), tx: sent.hash },
            "inbox swept",
          );
          await ctx.notifier.push(`sweep:${ctx.chainId}:${sent.hash}`, c.user, "deposits", "Your deposit has arrived");
        } catch (error) {
          retryAt.set(c.user, now + SWEEP_RETRY_MS);
          ctx.log.warn({ user: c.user, inbox: c.inbox, err: describeError(error) }, "inbox sweep failed; retry later");
        }
      }
    },
  };
}

/** Indexer arrivals ∪ live app watches, one per user (the factory derives the inbox from the user). */
async function sweepCandidates(ctx: KeeperContext): Promise<InboxCandidate[]> {
  const [indexed, watched] = await Promise.all([
    ctx.source.pendingInboxes(),
    ctx.db<{ user_address: string; inbox: string }[]>`
      SELECT user_address, inbox FROM inbox_watches WHERE chain_id = ${ctx.chainId} AND expires_at > now()`,
  ]);
  const byUser = new Map<string, InboxCandidate>();
  for (const w of watched) byUser.set(w.user_address, { user: getAddress(w.user_address), inbox: getAddress(w.inbox) });
  for (const c of indexed) byUser.set(c.user.toLowerCase(), c);
  return [...byUser.values()];
}
