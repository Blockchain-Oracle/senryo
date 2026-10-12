/**
 * Money paths (R4, the acceptance rows): a fresh Practice wallet walks every relayed path through a running api —
 * signs in, takes Practice dollars, then a call opened and cashed out, a call closed by its exit, a ride opened and
 * closed, and a ride closed by its exit — each signed exactly as the apps sign it (`@senryo/chain` typed data, an
 * EIP-2612 permit for each spend) and waited on until the chain decides. Prints every transaction for `ids-and-txs.md`.
 * Exits 1 when a path doesn't end where it should.
 *
 *   API_ORIGIN=http://127.0.0.1:3901 pnpm --filter @senryo/drive exec tsx src/money-paths.ts
 *
 * `DRIVE_PK` reuses a wallet (else a new one each run). Knock-outs, cap-outs and ends of life need the price to move or
 * a ride's life to run out; the keeper and the relay's watchers take those on their own.
 */
import {
  practiceGrantRoute,
  printRoute,
  ridesRoute,
  sigmaMarksRoute,
  submitIntentRoute,
  submitRideRoute,
  ticketsRoute,
  windowLoadRoute,
} from "@senryo/api-client";
import {
  ACTION_CLOSE,
  ACTION_OPEN,
  EXIT_BOOK,
  freshNonce,
  intentRequest,
  type MarketIntent,
  marketsDomain,
  type RideIntent,
  rideIntentRequest,
  seriesIdOf,
  windowIdOf,
} from "@senryo/chain";
import { FILL_DELAY_SEC, MIN_HOLD_SEC, quoteCurve, RIDE_TERMS } from "@senryo/config";
import { clampMark, loadSurchargeE6, markMinuteOf, quoteOpen, rideFee, rideNotional } from "@senryo/core";
import { sleep } from "./lib.ts";
import {
  type Act,
  ADVERSE_BPS,
  account,
  api,
  BPS,
  CADENCE,
  CHAIN,
  check,
  FRESH_SEC,
  failed,
  INTENT_TTL_SEC,
  LABEL_WIDTH,
  LEVERAGE_BPS,
  loadCatalog,
  MARGIN,
  MS,
  NEEDED,
  nowSec,
  ORIGIN,
  owner,
  permitFor,
  RIDE_MARKET,
  SLIPPAGE_BPS,
  STAKE,
  STOP_ABOVE_BPS,
  STOP_ANY_BID_E6,
  SYMBOL,
  setExit,
  settled,
  signIn,
  spotE8,
  txs,
  UP,
  until,
  wallet,
} from "./money-session.ts";

// ------------------------------------------------------------------------------------------------ calls

async function openCall(catalog: Awaited<ReturnType<typeof loadCatalog>>, what: string) {
  let start = nowSec() - (nowSec() % CADENCE);
  if (nowSec() - start > FRESH_SEC) {
    await sleep((start + CADENCE - nowSec() + 1) * MS);
    start += CADENCE;
  }
  const k = await until("the window's open print", async () =>
    BigInt((await api.call(printRoute, { query: { symbol: SYMBOL, t: start } })).priceE8),
  );
  if (k === undefined) return undefined;
  const windowId = windowIdOf(seriesIdOf(SYMBOL, CADENCE), start);
  const fillAt = nowSec() + FILL_DELAY_SEC;
  const frames = (await api.call(sigmaMarksRoute, {})).frames;
  const minute = markMinuteOf(fillAt);
  const live = frames
    .filter((f) => f.minute <= minute)
    .at(-1)
    ?.marks.find((m) => m[0] === SYMBOL);
  const listed = BigInt(catalog.series.sigmaE8);
  const mark = clampMark(
    { fastE8: live?.[1] ?? listed, slowE8: live?.[2] ?? listed },
    BigInt(catalog.series.sigmaFloorE8),
    BigInt(catalog.series.sigmaCapE8),
  );
  const load = await api.call(windowLoadRoute, { query: { chainId: CHAIN, expiry: start + CADENCE } });
  const terms = {
    ...quoteCurve(catalog.terms, CADENCE),
    surchargeE6: loadSurchargeE6(
      BigInt(catalog.terms.maxSurchargeE6),
      load.reservedByExpiry,
      catalog.terms.maxExpiryReserved,
    ),
  };
  const band = catalog.series.bands[UP];
  if (!band) throw new Error("no Up band");
  const w = { openE8: k, mark, tauSec: BigInt(start + CADENCE - fillAt) };
  const spot = await spotE8();
  const q = quoteOpen(band, w, spot, STAKE, terms);
  // Up pays less the higher the price goes: the limit is the payout at a p99 2-second rise (D-300).
  const adverse = quoteOpen(band, w, (spot * (BPS + ADVERSE_BPS)) / BPS, STAKE, terms);
  if (q.refusal || adverse.refusal) {
    check(false, `${what}: quoted (${q.refusal})`);
    return undefined;
  }
  const a = await account();
  const intent: Act<MarketIntent> = {
    action: ACTION_OPEN,
    owner,
    windowId,
    band: UP,
    ticketId: 0n,
    amount: STAKE,
    limit: adverse.payout,
    recipient: owner,
    configVersion: catalog.configVersion,
    deadline: BigInt(nowSec() + INTENT_TTL_SEC),
    nonce: freshNonce(),
    epoch: a.epoch,
  };
  const signature = await wallet.signTypedData(intentRequest(CHAIN, intent));
  const permit = await permitFor(catalog.reserve, STAKE);
  const r = await api.call(submitIntentRoute, {
    body: { chainId: CHAIN, intent, signature, permit, symbol: SYMBOL, cadenceSec: CADENCE, start },
  });
  const s = await settled(r.digest, what);
  check(s?.state === "filled", `${what}: filled (${s?.state ?? "no answer"}${s?.reason ? `, ${s.reason}` : ""})`);
  return s?.state === "filled" ? s.ticketId : undefined;
}

async function closeCall(ticketId: bigint) {
  await sleep((MIN_HOLD_SEC + 1) * MS);
  const tickets = await api.call(ticketsRoute, { query: { chainId: CHAIN, owner } });
  const t = tickets.tickets.find((x) => x.ticketId === ticketId);
  if (!t) return check(false, "call close: ticket listed");
  const catalog = await loadCatalog();
  const a = await account();
  const intent: Act<MarketIntent> = {
    action: ACTION_CLOSE,
    owner,
    windowId: t.windowId,
    band: t.band,
    ticketId,
    amount: t.payout,
    // A drive takes any bid: the close itself is what's checked.
    limit: 0n,
    recipient: owner,
    configVersion: catalog.configVersion,
    deadline: BigInt(nowSec() + INTENT_TTL_SEC),
    nonce: freshNonce(),
    epoch: a.epoch,
  };
  const signature = await wallet.signTypedData(intentRequest(CHAIN, intent));
  const r = await api.call(submitIntentRoute, {
    body: { chainId: CHAIN, intent, signature, permit: null, symbol: SYMBOL, cadenceSec: CADENCE, start: t.start },
  });
  const s = await settled(r.digest, "call close");
  check(s?.state === "filled", `call close: filled (${s?.state ?? "no answer"})`);
}

async function callExit(ticketId: bigint) {
  await setExit(
    { owner, book: EXIT_BOOK.call, id: ticketId, takeProfit: 0n, stopLoss: STOP_ANY_BID_E6, floor: 0n, trail: 0n },
    "call exit",
  );
  const closed = await until("the exit's close", async () => {
    const t = (await api.call(ticketsRoute, { query: { chainId: CHAIN, owner } })).tickets.find(
      (x) => x.ticketId === ticketId,
    );
    return t?.state === "closed" ? t : undefined;
  });
  check(closed !== undefined, "call exit: fired and closed at the next print");
}

// ------------------------------------------------------------------------------------------------ rides

async function ride(
  intent: Omit<Act<RideIntent>, "owner" | "recipient" | "deadline" | "nonce" | "epoch">,
  what: string,
) {
  const catalog = await loadCatalog();
  const a = await account();
  const full: Act<RideIntent> = {
    ...intent,
    owner,
    recipient: owner,
    deadline: BigInt(nowSec() + INTENT_TTL_SEC),
    nonce: freshNonce(),
    epoch: a.epoch,
  };
  const signature = await wallet.signTypedData(rideIntentRequest(marketsDomain(CHAIN), full));
  const fee = rideFee(rideNotional(intent.margin, BigInt(intent.leverageBps)), BigInt(takerFeeBps()));
  const permit = intent.action === ACTION_OPEN ? await permitFor(catalog.reserve, intent.margin + fee) : null;
  const r = await api.call(submitRideRoute, { body: { chainId: CHAIN, intent: full, signature, permit } });
  const s = await settled(r.digest, what);
  check(s?.state === "filled", `${what}: filled (${s?.state ?? "no answer"}${s?.reason ? `, ${s.reason}` : ""})`);
  return s?.rideId ?? undefined;
}

const takerFeeBps = () => RIDE_TERMS[CHAIN].markets[SYMBOL].takerFeeBps;

async function openRide(what: string) {
  const spot = await spotE8();
  return ride(
    {
      action: ACTION_OPEN,
      marketId: RIDE_MARKET,
      isLong: true,
      rideId: 0n,
      margin: MARGIN,
      leverageBps: LEVERAGE_BPS,
      size: 0n,
      worstPriceE8: (spot * (BPS + SLIPPAGE_BPS)) / BPS,
      configVersion: (await loadCatalog()).configVersion,
    },
    what,
  );
}

async function rideState(rideId: bigint) {
  return (await api.call(ridesRoute, { query: { chainId: CHAIN, owner } })).rides.find((r) => r.rideId === rideId);
}

async function closeRide(rideId: bigint) {
  await sleep((MIN_HOLD_SEC + 1) * MS);
  const spot = await spotE8();
  await ride(
    {
      action: ACTION_CLOSE,
      marketId: RIDE_MARKET,
      isLong: true,
      rideId,
      margin: 0n,
      leverageBps: 0,
      size: 0n,
      worstPriceE8: (spot * (BPS - SLIPPAGE_BPS)) / BPS,
      configVersion: (await loadCatalog()).configVersion,
    },
    "ride close",
  );
  const r = await rideState(rideId);
  check(r?.state === "closed", `ride close: closed, paid ${r?.paid ?? "?"} (pnl ${r?.pnl ?? "?"})`);
}

async function rideExit(rideId: bigint) {
  const spot = await spotE8();
  await setExit(
    {
      owner,
      book: EXIT_BOOK.ride,
      id: rideId,
      takeProfit: 0n,
      stopLoss: (spot * (BPS + STOP_ABOVE_BPS)) / BPS,
      floor: 0n,
      trail: 0n,
    },
    "ride exit",
  );
  const done = await until("the ride exit's close", async () => {
    const r = await rideState(rideId);
    return r?.state === "closed" ? r : undefined;
  });
  check(done !== undefined, "ride exit: fired and closed at the next print");
}

// ------------------------------------------------------------------------------------------------ the run

console.log(`money paths on ${CHAIN} through ${ORIGIN} as ${owner}`);
await signIn();
const grant = await api.call(practiceGrantRoute, {});
if (grant.txHash) txs.push(["practice grant", grant.txHash]);
check(grant.state !== "unavailable", `practice dollars: ${grant.state}`);
await until("the dollars", async () => ((await account()).balance >= NEEDED ? true : undefined));
const catalog = await loadCatalog();

const opened = await openCall(catalog, "call open");
if (opened !== undefined && opened !== null) await closeCall(opened);
const exiting = await openCall(catalog, "call open (for its exit)");
if (exiting !== undefined && exiting !== null) await callExit(exiting);
const r1 = await openRide("ride open");
if (r1) await closeRide(r1);
const r2 = await openRide("ride open (for its exit)");
if (r2) await rideExit(r2);

console.log("\ntransactions:");
for (const [what, hash] of txs) console.log(`  ${what.padEnd(LABEL_WIDTH)} ${hash}`);
console.log(failed() === 0 ? "\n✓ every path ended where it should" : `\n✗ ${failed()} failed`);
process.exit(failed() === 0 ? 0 : 1);
