import { type EvmOnEventContext, indexer, type Ride, type RideSide } from "envio";
import { countCall, finishCall, key, type Outcome } from "../lib/records.ts";

/**
 * Rides from commit to their last exit (contracts/src/markets/{LinearBook,RideBounds}.sol, D-299): the ride, its
 * timeline, each market side's open sums (as the reserve keeps them) and the rider's record — counted once it fills
 * (margin and open fee at risk), realised when its last part leaves: everything it paid against what it put in.
 */
type Ctx = EvmOnEventContext;

/** Where an event sits, for its timeline row. */
interface At {
  chainId: number;
  at: number;
  tx: string;
  log: number;
}

/** `RideExited.how` is the state the exit leaves the ride in (contracts `RIDE_*`). */
const HOW: Record<number, string> = { 2: "open", 3: "closed", 4: "knocked_out", 5: "capped", 6: "ended" };
const STILL_OPEN = 2;
const EXIT_TRAIL = 2;

const sideId = (chainId: number, marketId: number, isLong: boolean) => `${chainId}_${marketId}_${isLong ? 0 : 1}`;

/** A part's share of a stored amount, ceiled (contracts `LinearMath.share`). */
const share = (amount: bigint, part: bigint, whole: bigint) => (amount * part + whole - 1n) / whole;

function timeline(context: Ctx, r: Ride, kind: string, amount: bigint, w: At, priceE8?: bigint) {
  context.RideEvent.set({
    id: `${w.chainId}_${w.tx}_${w.log}`,
    chainId: w.chainId,
    rideId: r.rideId,
    owner: r.owner,
    kind,
    amount,
    priceE8,
    timestamp: w.at,
    txHash: w.tx,
  });
}

async function moveSide(
  context: Ctx,
  r: Ride,
  sign: 1n | -1n,
  amounts: { size: bigint; margin: bigint; reserve: bigint },
  count: number,
) {
  const id = sideId(r.chainId, r.marketId, r.isLong);
  const s: RideSide = (await context.RideSide.get(id)) ?? {
    id,
    chainId: r.chainId,
    marketId: r.marketId,
    isLong: r.isLong,
    count: 0,
    size: 0n,
    margin: 0n,
    reserve: 0n,
    koEdgeE8: undefined,
    capEdgeE8: undefined,
  };
  context.RideSide.set({
    ...s,
    count: s.count + count,
    size: s.size + sign * amounts.size,
    margin: s.margin + sign * amounts.margin,
    reserve: s.reserve + sign * amounts.reserve,
  });
}

const at = (event: {
  chainId: number;
  block: { timestamp: number };
  transaction: { hash: string };
  logIndex: number;
}) => ({
  chainId: event.chainId,
  at: event.block.timestamp,
  tx: event.transaction.hash,
  log: event.logIndex,
});

indexer.onEvent({ contract: "BandReserve", event: "RideCommitted" }, async ({ event, context }) => {
  const p = event.params;
  const r: Ride = {
    id: key(event.chainId, p.rideId),
    chainId: event.chainId,
    rideId: p.rideId,
    owner: p.owner,
    marketId: Number(p.marketId),
    isLong: p.isLong,
    status: "committed",
    margin: p.margin,
    originalMargin: p.margin,
    leverageBps: Number(p.leverageBps),
    openFee: p.openFee,
    size: 0n,
    reserve: 0n,
    entryE8: undefined,
    koE8: undefined,
    capE8: undefined,
    target: Number(p.target),
    viaSession: p.viaSession,
    committedAt: event.block.timestamp,
    committedTx: event.transaction.hash,
    filledAt: undefined,
    fillTx: undefined,
    pnl: 0n,
    fees: 0n,
    paid: 0n,
    refunded: 0n,
    exitE8: undefined,
    refuseReason: undefined,
    endedAt: undefined,
    exitTakeProfitE8: 0n,
    exitStopLossE8: 0n,
    exitFloorE8: 0n,
    exitTrailBps: 0,
    exitFiring: undefined,
  };
  context.Ride.set(r);
  timeline(context, r, "ride requested", p.margin, at(event));
});

indexer.onEvent({ contract: "BandReserve", event: "RideFilled" }, async ({ event, context }) => {
  const p = event.params;
  const r = await context.Ride.get(key(event.chainId, p.rideId));
  if (!r) return;
  const filled: Ride = {
    ...r,
    status: "open",
    entryE8: p.entryE8,
    size: p.size,
    reserve: p.reserve,
    openFee: p.openFee,
    koE8: p.koE8,
    capE8: p.capE8,
    filledAt: r.target,
    fillTx: event.transaction.hash,
    target: undefined,
  };
  context.Ride.set(filled);
  await moveSide(context, filled, 1n, { size: p.size, margin: r.margin, reserve: p.reserve }, 1);
  await countCall(context, event.chainId, r.owner, r.margin + p.openFee, event.block.timestamp);
  timeline(context, filled, "ride filled", r.margin, at(event), p.entryE8);
});

indexer.onEvent({ contract: "BandReserve", event: "RideRefused" }, async ({ event, context }) => {
  const p = event.params;
  const r = await context.Ride.get(key(event.chainId, p.rideId));
  if (!r) return;
  const refused: Ride = {
    ...r,
    status: "refunded",
    refunded: p.refunded,
    refuseReason: Number(p.reason),
    target: undefined,
  };
  context.Ride.set(refused);
  timeline(context, refused, "ride refused", p.refunded, at(event));
});

indexer.onEvent({ contract: "BandReserve", event: "RideCloseCommitted" }, async ({ event, context }) => {
  const p = event.params;
  const r = await context.Ride.get(key(event.chainId, p.rideId));
  if (!r) return;
  // A fired exit's close is followed by `ExitFired` in the same transaction; the owner's own close clears it.
  const closing: Ride = { ...r, status: "closing", target: Number(p.target), exitFiring: undefined };
  context.Ride.set(closing);
  timeline(context, closing, "close requested", p.size, at(event));
});

indexer.onEvent({ contract: "BandReserve", event: "RideCloseRefused" }, async ({ event, context }) => {
  const r = await context.Ride.get(key(event.chainId, event.params.rideId));
  if (r?.status !== "closing") return;
  const back: Ride = { ...r, status: "open", target: undefined, exitFiring: undefined };
  context.Ride.set(back);
  timeline(context, back, "close refused", 0n, at(event));
});

indexer.onEvent({ contract: "BandReserve", event: "RideExited" }, async ({ event, context }) => {
  const p = event.params;
  const r = await context.Ride.get(key(event.chainId, p.rideId));
  if (!r) return;
  const how = Number(p.how);
  const last = how !== STILL_OPEN || p.size === r.size;
  const marginOut = last ? r.margin : share(r.margin, p.size, r.size);
  const reserveOut = last ? r.reserve : share(r.reserve, p.size, r.size);
  const done: Ride = {
    ...r,
    status: last ? (HOW[how] ?? "closed") : "open",
    size: r.size - p.size,
    margin: r.margin - marginOut,
    reserve: r.reserve - reserveOut,
    pnl: r.pnl + p.pnl,
    fees: r.fees + p.fees,
    paid: r.paid + p.paid,
    exitE8: p.exitE8,
    target: undefined,
    exitFiring: undefined,
    endedAt: last ? event.block.timestamp : undefined,
  };
  context.Ride.set(done);
  await moveSide(context, r, -1n, { size: p.size, margin: marginOut, reserve: reserveOut }, last ? -1 : 0);
  timeline(context, done, last ? (HOW[how] ?? "closed") : "part closed", p.paid, at(event), p.exitE8);
  if (!last) return;
  const stake = r.originalMargin + r.openFee;
  const outcome: Outcome = done.paid > stake ? "win" : done.paid === stake ? "refund" : "lose";
  await finishCall(context, event.chainId, { owner: r.owner, stake }, done.paid, outcome, event.block.timestamp);
});

indexer.onEvent({ contract: "BandReserve", event: "FrontierRefreshed" }, async ({ event, context }) => {
  const p = event.params;
  const id = sideId(event.chainId, Number(p.marketId), Number(p.side) === 0);
  const s = await context.RideSide.get(id);
  if (s) context.RideSide.set({ ...s, koEdgeE8: p.koEdgeE8, capEdgeE8: p.capEdgeE8 });
});

/** A ride's exit set or cleared (book 2 of `ExitSet`, dispatched from the calls' handler). */
export async function rideExitSet(
  context: Ctx,
  w: At,
  p: { id: bigint; takeProfit: bigint; stopLoss: bigint; floor: bigint; trail: bigint },
) {
  const r = await context.Ride.get(key(w.chainId, p.id));
  if (!r) return;
  const set: Ride = {
    ...r,
    exitTakeProfitE8: p.takeProfit,
    exitStopLossE8: p.stopLoss,
    exitFloorE8: p.floor,
    exitTrailBps: Number(p.trail),
  };
  context.Ride.set(set);
  const cleared = p.takeProfit === 0n && p.stopLoss === 0n && p.trail === 0n;
  timeline(context, set, cleared ? "exit removed" : "exit set", 0n, w);
}

/** A ride's exit fired (book 2 of `ExitFired`): its close is pending at the next print. */
export async function rideExitFired(context: Ctx, w: At, p: { id: bigint; kind: bigint | number }) {
  const r = await context.Ride.get(key(w.chainId, p.id));
  if (!r) return;
  context.Ride.set({ ...r, exitFiring: Number(p.kind) });
  timeline(context, r, Number(p.kind) === EXIT_TRAIL ? "trail fired" : "exit fired", 0n, w);
}
