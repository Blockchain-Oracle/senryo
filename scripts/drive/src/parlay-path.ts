/**
 * A two-leg parlay's money path (R4 acceptance): a Practice wallet places BTC Up × ETH Up in fresh 5-minute windows,
 * signed as the apps sign it (`parlayRequest` and a permit), with its minimum payout at each leg's p99 2-second move
 * against it (D-300); the relay fills it at the next print with each leg's σ mark, and the keeper decides both legs at
 * the windows' close and settles it. Prints every transaction; exits 1 if it doesn't end where it should.
 *
 *   API_ORIGIN=https://api.senryo.xyz pnpm --filter @senryo/drive exec tsx src/parlay-path.ts
 */
import {
  catalogRoute,
  parlaysRoute,
  practiceGrantRoute,
  printRoute,
  recentPricesRoute,
  sigmaMarksRoute,
  submitParlayRoute,
} from "@senryo/api-client";
import { freshNonce, type MarketParlayIntent, parlayRequest, seriesIdOf, windowIdOf } from "@senryo/chain";
import { FILL_DELAY_SEC, MARKETS, PARLAY, quoteCurve } from "@senryo/config";
import { clampMark, markMinuteOf, type ParlayLegChance, probE6, quoteParlay } from "@senryo/core";
import { sleep } from "./lib.ts";
import {
  account,
  api,
  CADENCE,
  CHAIN,
  check,
  FRESH_SEC,
  failed,
  INTENT_TTL_SEC,
  LABEL_WIDTH,
  MS,
  nowSec,
  ORIGIN,
  owner,
  permitFor,
  settled,
  signIn,
  txs,
  until,
  wallet,
} from "./money-session.ts";

const STAKE = 2_000_000n;
const UP = 0;
/** Each leg's p99 2-second move (D-300): BTC 3 bp, ETH 4.5 bp (× 10 for whole numbers). */
const LEGS = [
  { symbol: "BTC", adverseBpsE1: 30n },
  { symbol: "ETH", adverseBpsE1: 45n },
] as const;
const BPS_E1 = 100_000n;
/** Both 5-minute legs close, then the keeper decides them and settles (a few minutes at most). */
const SETTLE_WAIT_MS = 900_000;
const SETTLE_POLL_MS = 10_000;

console.log(`parlay on ${CHAIN} through ${ORIGIN} as ${owner}`);
await signIn();
const grant = await api.call(practiceGrantRoute, {});
if (grant.txHash) txs.push(["practice grant", grant.txHash]);
await until("the dollars", async () => ((await account()).balance >= STAKE ? true : undefined));

let start = nowSec() - (nowSec() % CADENCE);
if (nowSec() - start > FRESH_SEC) {
  await sleep((start + CADENCE - nowSec() + 1) * MS);
  start += CADENCE;
}
const catalog = await api.call(catalogRoute, { query: { chainId: CHAIN } });
const fillAt = nowSec() + FILL_DELAY_SEC;
const frame = (await api.call(sigmaMarksRoute, {})).frames.filter((f) => f.minute <= markMinuteOf(fillAt)).at(-1);
const legs: (ParlayLegChance & { windowId: `0x${string}` })[] = [];
for (const leg of LEGS) {
  const market = catalog.markets.find((m) => m.symbol === leg.symbol);
  const series = market?.series.find((s) => s.cadenceSec === CADENCE);
  const band = series?.bands[UP];
  if (!market || !series || !band) throw new Error(`${leg.symbol} ${CADENCE}s is not in the catalogue`);
  const k = await until(`${leg.symbol}'s open print`, async () =>
    BigInt((await api.call(printRoute, { query: { symbol: leg.symbol, t: start } })).priceE8),
  );
  const recent = await api.call(recentPricesRoute, { query: { symbols: leg.symbol } });
  const spot = BigInt(recent.feeds[0]?.points.at(-1)?.[1] ?? 0);
  const live = frame?.marks.find((m) => m[0] === leg.symbol);
  const listed = BigInt(series.sigmaE8);
  const mark = clampMark(
    { fastE8: live?.[1] ?? listed, slowE8: live?.[2] ?? listed },
    BigInt(series.sigmaFloorE8),
    BigInt(series.sigmaCapE8),
  );
  if (k === undefined || spot === 0n) throw new Error(`no price for ${leg.symbol}`);
  // Up's chance rises with the price: the leg is priced at its p99 2-second rise, the least the parlay accepts.
  const adverse = (spot * (BPS_E1 + leg.adverseBpsE1)) / BPS_E1;
  const p = probE6(band, k, adverse, mark.fastE8, mark.slowE8, BigInt(start + CADENCE - fillAt));
  // Legs in one trading calendar are priced as correlated (D-293): the group is the market's calendar.
  const group = MARKETS.find((m) => m.symbol === leg.symbol)?.calendarId ?? 0;
  legs.push({ probE6: p, group, windowId: windowIdOf(seriesIdOf(leg.symbol, CADENCE), start) });
}
const quote = quoteParlay(legs, STAKE, quoteCurve(catalog.terms, CADENCE), PARLAY.correlationBps);
if (quote.refusal) {
  check(false, `parlay quoted (${quote.refusal})`);
  process.exit(1);
}
const a = await account();
const intent: MarketParlayIntent = {
  owner,
  windowIds: legs.map((l) => l.windowId),
  bands: LEGS.map(() => UP),
  stake: STAKE,
  minPayout: quote.payout,
  recipient: owner,
  configVersion: catalog.configVersion,
  deadline: BigInt(nowSec() + INTENT_TTL_SEC),
  nonce: freshNonce(),
  epoch: a.epoch,
};
const signature = await wallet.signTypedData(parlayRequest(CHAIN, intent));
const permit = await permitFor(catalog.contracts.reserve, STAKE);
const r = await api.call(submitParlayRoute, {
  body: {
    chainId: CHAIN,
    intent,
    signature,
    permit,
    legs: LEGS.map((l) => ({ symbol: l.symbol, cadenceSec: CADENCE, start })),
  },
});
const s = await settled(r.digest, "parlay fill");
check(s?.state === "filled", `parlay: filled (${s?.state ?? "no answer"}${s?.reason ? `, ${s.reason}` : ""})`);

if (s?.state === "filled") {
  const deadline = Date.now() + SETTLE_WAIT_MS;
  let done: { state: string; outcome: string | null; result: bigint | null } | undefined;
  while (Date.now() < deadline) {
    const list = await api.call(parlaysRoute, { query: { chainId: CHAIN, owner } });
    const p = list.parlays.find((x) => x.parlayId === s.ticketId);
    if (p?.state === "settled") {
      done = p;
      break;
    }
    await sleep(SETTLE_POLL_MS);
  }
  check(done !== undefined, `parlay: both legs decided and settled (${done?.outcome ?? "?"}, ${done?.result ?? "?"})`);
}

console.log("\ntransactions:");
for (const [what, hash] of txs) console.log(`  ${what.padEnd(LABEL_WIDTH)} ${hash}`);
process.exit(failed() === 0 ? 0 : 1);
