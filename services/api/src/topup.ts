/**
 * Gas top-ups and relay reconciliation (S8.16c/e, D-171).
 *
 * `planTopUp` decides how much MON the sponsor sends so the user's next sends fit Monad's consensus check (gas LIMIT ×
 * max fee against the balance; the ceiling covers a Perpl order as well as an engine increase): practice needs a prior claim, mainnet needs funded equity (real collateral is the
 * anti-sybil cost, so no Turnstile — D-166 still gates the *drips*). The app's `needWei` is trusted only up to what an
 * increase with one more position can need at the current max fee; the amount is then clamped to the drip's per-day cap.
 *
 * `reconcileRelay` re-reads a relay row whose background finality check died (api restart mid-claim, the 15 s wait):
 * a stuck `proposed` row once made the app poll for 36 s and show "didn't settle" although the claim was onchain.
 */
import {
  type Address,
  FeeCache,
  type Hex,
  readAccountSnapshot,
  readContract,
  TransactionReceiptNotFoundError,
} from "@senryo/chain";
import {
  GAS_LIMITS,
  GAS_TOPUP_ACTIONS,
  MAINNET_TOPUP_MIN_EQUITY_USD6,
  positionCount,
  positionGasLimit,
  TESTNET_CHAIN_ID,
} from "@senryo/config";
import { isTerminalStage, type TxStage } from "@senryo/core";
import { HTTP_STATUS, HttpError, MS_PER_SECOND, SECONDS_PER_DAY } from "@senryo/service-common";
import { RELAY_ABANDON_MS, RELAY_RECONCILE_AFTER_MS } from "./constants.ts";
import type { ApiContext, ChainContext } from "./context.ts";
import { type ClaimRow, notifyStarterCredit } from "./starter.ts";

export async function planTopUp(chain: ChainContext, user: Address, needWei: bigint): Promise<bigint> {
  const practice = chain.chainId === TESTNET_CHAIN_ID;
  const drip = readContract(chain.chainId, "StarterDrip", chain.read);
  const snapshot = await readAccountSnapshot(chain.read, chain.chainId, user, "latest");
  if (practice) {
    if (!(await drip.read.claimed([user]))) {
      throw new HttpError(HTTP_STATUS.forbidden, "NOT_ELIGIBLE", "claim practice funds first");
    }
  } else if (snapshot.equityInit < MAINNET_TOPUP_MIN_EQUITY_USD6) {
    throw new HttpError(HTTP_STATUS.forbidden, "NOT_ELIGIBLE", "deposit into your account first");
  }
  const fees = await (chain.sponsor?.fees ?? new FeeCache(chain.read)).get();
  // The costliest next send: an engine increase with one more position, or a Perpl IOC order walking the book.
  const engineGas = positionGasLimit("increase", positionCount(snapshot.positionBitmap) + 1);
  const ceiling = (engineGas > GAS_LIMITS.perplOrder ? engineGas : GAS_LIMITS.perplOrder) * fees.maxFeePerGas;
  const need = needWei < ceiling ? needWei : ceiling;
  const balance = await chain.read.getBalance({ address: user, blockTag: "latest" });
  if (balance >= need)
    throw new HttpError(HTTP_STATUS.conflict, "NOT_NEEDED", "the balance already covers the next send");

  const nowSec = Math.floor(Date.now() / MS_PER_SECOND);
  const day = BigInt(Math.floor(nowSec / SECONDS_PER_DAY));
  const [config, used] = await Promise.all([drip.read.config(), drip.read.toppedUp([user, day])]);
  const cap = config[2];
  const room = cap > used ? cap - used : 0n;
  const want = need * GAS_TOPUP_ACTIONS - balance;
  const amount = want < room ? want : room;
  if (balance + amount < need) {
    const nextDay = (Number(day) + 1) * SECONDS_PER_DAY;
    throw new HttpError(
      HTTP_STATUS.unavailable,
      "BUDGET_EXHAUSTED",
      "today's gas top-ups are used up",
      nextDay - nowSec,
    );
  }
  return amount;
}

export async function reconcileRelay(ctx: ApiContext, chain: ChainContext, row: ClaimRow): Promise<ClaimRow> {
  if (isTerminalStage(row.stage as TxStage) || !row.tx_hash) return row;
  if (Date.now() - row.created_at.getTime() < RELAY_RECONCILE_AFTER_MS) return row;
  let stage: TxStage;
  try {
    const receipt = await chain.read.getTransactionReceipt({ hash: row.tx_hash as Hex });
    const finalized = await chain.read.getBlock({ blockTag: "finalized" });
    if (receipt.status !== "success") stage = "reverted";
    else if (receipt.blockNumber <= finalized.number) stage = "finalized";
    else return row;
  } catch (error) {
    if (!(error instanceof TransactionReceiptNotFoundError)) return row;
    if (Date.now() - row.created_at.getTime() < RELAY_ABANDON_MS) return row;
    stage = "abandoned";
  }
  await ctx.db`UPDATE starter_claims SET stage = ${stage}, updated_at = now() WHERE id = ${row.id}`;
  ctx.log.info({ relayId: row.id, stage }, "relay reconciled");
  if (stage === "finalized") {
    const claim = {
      id: row.id,
      kind: row.kind,
      chainId: chain.chainId,
      user: row.user_address,
      creditUsd6: row.credit_usd6,
    };
    await notifyStarterCredit(ctx.db, claim).catch((err) =>
      ctx.log.warn({ relayId: row.id, err: String(err) }, "starter notification not recorded"),
    );
  }
  return { ...row, stage };
}

/** Boot sweep: rows left non-terminal by a previous process get their real stage (never re-sent). */
export async function reconcilePendingRelays(ctx: ApiContext): Promise<void> {
  const rows = await ctx.db<ClaimRow[]>`
    SELECT * FROM starter_claims
     WHERE stage NOT IN ('finalized', 'reverted', 'abandoned') AND tx_hash IS NOT NULL
     ORDER BY created_at`;
  for (const row of rows) {
    const chain = ctx.chains.get(row.chain_id as Parameters<typeof ctx.chains.get>[0]);
    if (chain) await reconcileRelay(ctx, chain, row).catch(() => undefined);
  }
}
