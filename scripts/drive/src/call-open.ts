/**
 * Opens calls on a Practice wallet and leaves them open (R5's live book on real positions): each argument is a side
 * and a lane — `up:900` is BTC Up on the 15-minute lane, `down:3600` Down on the hour — placed in the window now
 * trading, signed exactly as the apps sign it, its limit the payout at a p99 2-second move against it (D-300).
 * Prints each ticket and the wallet; `DRIVE_PK` reuses one (pair it with `ride-open.ts` for a book of both).
 *
 *   API_ORIGIN=https://api.senryo.xyz DRIVE_PK=0x… pnpm --filter @senryo/drive exec tsx src/call-open.ts up:900 down:3600
 */
import {
  catalogRoute,
  practiceGrantRoute,
  printRoute,
  sigmaMarksRoute,
  submitIntentRoute,
  windowLoadRoute,
} from "@senryo/api-client";
import { ACTION_OPEN, freshNonce, intentRequest, type MarketIntent, seriesIdOf, windowIdOf } from "@senryo/chain";
import { type CadenceSec, FILL_DELAY_SEC, LOCKOUT_SEC, quoteCurve } from "@senryo/config";
import { clampMark, loadSurchargeE6, markMinuteOf, quoteOpen } from "@senryo/core";
import {
  type Act,
  ADVERSE_BPS,
  account,
  api,
  BPS,
  CHAIN,
  check,
  failed,
  INTENT_TTL_SEC,
  nowSec,
  owner,
  permitFor,
  STAKE,
  SYMBOL,
  settled,
  signIn,
  spotE8,
  until,
  wallet,
} from "./money-session.ts";

const UP_BAND = 0;
const DOWN_BAND = 1;
const calls = process.argv.slice(2).map((arg) => {
  const [side, lane] = arg.split(":");
  const cadence = Number(lane) as CadenceSec;
  if ((side !== "up" && side !== "down") || !(cadence > 0)) throw new Error(`bad call "${arg}" (up:900 …)`);
  return { band: side === "up" ? UP_BAND : DOWN_BAND, cadence, what: `${SYMBOL} ${side} ${cadence}s` };
});
if (calls.length === 0) throw new Error("usage: call-open.ts up:900 down:3600 …");

console.log(`calls on ${CHAIN} as ${owner}`);
await signIn();
await api.call(practiceGrantRoute, {});
await until("the dollars", async () => ((await account()).balance >= STAKE * BigInt(calls.length) ? true : undefined));
const catalog = await api.call(catalogRoute, { query: { chainId: CHAIN } });

for (const c of calls) {
  const series = catalog.markets.find((m) => m.symbol === SYMBOL)?.series.find((s) => s.cadenceSec === c.cadence);
  const band = series?.bands[c.band];
  if (!series || !band) throw new Error(`${c.what} is not in the catalogue`);
  const start = nowSec() - (nowSec() % c.cadence);
  if (start + c.cadence - LOCKOUT_SEC - nowSec() < INTENT_TTL_SEC) throw new Error(`${c.what}: its window is closing`);
  const k = BigInt((await api.call(printRoute, { query: { symbol: SYMBOL, t: start } })).priceE8);
  const fillAt = nowSec() + FILL_DELAY_SEC;
  const minute = markMinuteOf(fillAt);
  const live = (await api.call(sigmaMarksRoute, {})).frames
    .filter((f) => f.minute <= minute)
    .at(-1)
    ?.marks.find((m) => m[0] === SYMBOL);
  const listed = BigInt(series.sigmaE8);
  const mark = clampMark(
    { fastE8: live?.[1] ?? listed, slowE8: live?.[2] ?? listed },
    BigInt(series.sigmaFloorE8),
    BigInt(series.sigmaCapE8),
  );
  const load = await api.call(windowLoadRoute, { query: { chainId: CHAIN, expiry: start + c.cadence } });
  const terms = {
    ...quoteCurve(catalog.terms, c.cadence),
    surchargeE6: loadSurchargeE6(
      BigInt(catalog.terms.maxSurchargeE6),
      load.reservedByExpiry,
      catalog.terms.maxExpiryReserved,
    ),
  };
  const w = { openE8: k, mark, tauSec: BigInt(start + c.cadence - fillAt) };
  const spot = await spotE8();
  // Up pays less the higher the price goes, Down the lower: the limit is the payout after that move against it.
  const moved = c.band === UP_BAND ? BPS + ADVERSE_BPS : BPS - ADVERSE_BPS;
  const adverse = quoteOpen(band, w, (spot * moved) / BPS, STAKE, terms);
  if (adverse.refusal) {
    check(false, `${c.what}: quoted (${adverse.refusal})`);
    continue;
  }
  const a = await account();
  const intent: Act<MarketIntent> = {
    action: ACTION_OPEN,
    owner,
    windowId: windowIdOf(seriesIdOf(SYMBOL, c.cadence), start),
    band: c.band,
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
  const permit = await permitFor(catalog.contracts.reserve, STAKE);
  const r = await api.call(submitIntentRoute, {
    body: { chainId: CHAIN, intent, signature, permit, symbol: SYMBOL, cadenceSec: c.cadence, start },
  });
  const s = await settled(r.digest, c.what);
  check(
    s?.state === "filled",
    `${c.what}: ticket ${s?.ticketId ?? "?"} ${s?.state ?? "no answer"} (${s?.txHash ?? ""})`,
  );
}
process.exit(failed() === 0 ? 0 : 1);
