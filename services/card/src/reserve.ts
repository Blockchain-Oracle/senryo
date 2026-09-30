import { type AccountSnapshot, type Address, type Hex, readAccountSnapshot } from "@senryo/chain";
import { SAFETY_BUFFER_USD6 } from "./constants.ts";
import type { CardContext } from "./context.ts";

/**
 * Reserve (specs/services.md §card 3), one Postgres transaction per authorisation:
 *   pg_advisory_xact_lock(chain:account)  — serialises every authorisation of one account (risk-math.md)
 *   snapshot = freeToSpend + nonce at `finalized` (one multicall ⇒ one block; freeToSpend already capped by the
 *              user-signed spend allowance onchain, D-032)
 *   pending  = Σ our holds not yet reflected in that snapshot (not landed, or landed at a nonce > snapshot.nonce)
 *   available = freeToSpend − pending  → insert the hold RESERVED only if it fits.
 * The chain re-checks everything in `placeHold` (I2, I7); this lock is what stops N parallel swipes from each seeing
 * the same free balance.
 */

/** Holds that still encumber (or may encumber) the account. */
export const OPEN_HOLD_STATUSES = ["RESERVED", "SUBMITTED", "ONCHAIN", "FINALIZED"] as const;

export type ReserveOutcome =
  | { ok: true; snapshot: AccountSnapshot; pending: bigint; available: bigint; envelopeCovers: boolean }
  | { ok: false; reason: "insufficient" | "allowance"; snapshot: AccountSnapshot; pending: bigint; available: bigint };

export interface ReserveRequest {
  account: Address;
  holdId: Hex;
  txnToken: string;
  amount: bigint;
}

export async function reserveHold(ctx: CardContext, req: ReserveRequest): Promise<ReserveOutcome> {
  const account = req.account.toLowerCase();
  return ctx.db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.chainId}:${account}`}, 0))`;
    const snapshot = await readAccountSnapshot(ctx.read, ctx.chainId, req.account, "finalized");
    const [row] = await tx<{ pending: bigint }[]>`
      SELECT COALESCE(SUM(amount_usd6), 0)::bigint AS pending FROM holds
       WHERE chain_id = ${ctx.chainId} AND account = ${account}
         AND status IN ${tx(OPEN_HOLD_STATUSES)}
         AND (landed_nonce IS NULL OR landed_nonce > ${snapshot.nonce})`;
    const pending = row?.pending ?? 0n;
    const { available, allowanceBound: allowanceLimited } = availableToSpend(snapshot, pending);
    if (available < req.amount) {
      const allowanceBound = allowanceLimited;
      return { ok: false, reason: allowanceBound ? "allowance" : "insufficient", snapshot, pending, available };
    }
    await tx`
      INSERT INTO holds (hold_id, chain_id, account, issuer, txn_token, amount_usd6, status, expected_usd6)
      VALUES (${req.holdId}, ${ctx.chainId}, ${account}, ${ctx.env.CARD_ISSUER_LABEL}, ${req.txnToken},
              ${req.amount}, 'RESERVED', ${req.amount})`;
    // Envelope fallback (risk-math.md "envelope" mode): unused envelope R − H at finalized, minus what we reserved.
    const envelopeFree = snapshot.envelope - snapshot.holds - pending;
    return { ok: true, snapshot, pending, available, envelopeCovers: envelopeFree >= req.amount };
  });
}

/**
 * Mirror of RiskModule: spend = freeToTrade + max(R − H, 0), capped by the allowance left (both minus our pending
 * holds). An idle account (no positions/holds/envelope/debt) has no safety buffer B yet; its first hold makes it
 * "at risk", so B is reserved up front — otherwise the chain would revert the hold that crosses into B.
 */
export function availableToSpend(
  snap: AccountSnapshot,
  pending: bigint,
): { available: bigint; allowanceBound: boolean } {
  const idle = snap.positionBitmap === 0 && snap.holds === 0n && snap.envelope === 0n && snap.cardDebt === 0n;
  const buffer = idle ? SAFETY_BUFFER_USD6 : 0n;
  const unusedEnvelope = snap.envelope > snap.holds ? snap.envelope - snap.holds : 0n;
  const bySpend = snap.freeToTrade + unusedEnvelope - buffer - pending;
  const byAllowance = snap.allowanceLeft - pending;
  return byAllowance < bySpend
    ? { available: byAllowance, allowanceBound: true }
    : { available: bySpend, allowanceBound: false };
}

/** Balance inquiry: settled = freeToSpend at finalized; available = settled − pending (both usd6). */
export async function spendable(
  ctx: CardContext,
  accountAddress: Address,
): Promise<{ settled: bigint; available: bigint }> {
  const snapshot = await readAccountSnapshot(ctx.read, ctx.chainId, accountAddress, "finalized");
  const [row] = await ctx.db<{ pending: bigint }[]>`
    SELECT COALESCE(SUM(amount_usd6), 0)::bigint AS pending FROM holds
     WHERE chain_id = ${ctx.chainId} AND account = ${accountAddress.toLowerCase()}
       AND status IN ${ctx.db(OPEN_HOLD_STATUSES)}
       AND (landed_nonce IS NULL OR landed_nonce > ${snapshot.nonce})`;
  return { settled: snapshot.freeToSpend, available: availableToSpend(snapshot, row?.pending ?? 0n).available };
}
