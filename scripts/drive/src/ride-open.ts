/**
 * Opens rides on a fresh Practice wallet and leaves them open (R4 acceptance for the paths the price or the clock
 * decides: a knock-out, a cap-out, an end of life — the relay's watchers and the keeper take those on their own).
 * Prints each ride's id and the wallet; watch them in `GET /v1/rides?owner=…`.
 *
 *   API_ORIGIN=https://api.senryo.xyz pnpm --filter @senryo/drive exec tsx src/ride-open.ts long:40 short:40 long:2
 */
import { practiceGrantRoute, submitRideRoute } from "@senryo/api-client";
import { ACTION_OPEN, freshNonce, marketsDomain, type RideIntent, rideIntentRequest } from "@senryo/chain";
import { RIDE_MIN_LEVERAGE_BPS, RIDE_TERMS } from "@senryo/config";
import { rideFee, rideNotional } from "@senryo/core";
import {
  type Act,
  account,
  api,
  BPS,
  CHAIN,
  check,
  failed,
  INTENT_TTL_SEC,
  loadCatalog,
  nowSec,
  owner,
  permitFor,
  RIDE_MARKET,
  SLIPPAGE_BPS,
  SYMBOL,
  settled,
  signIn,
  spotE8,
  until,
  wallet,
} from "./money-session.ts";

const MARGIN = 5_000_000n;
const rides = process.argv.slice(2).map((arg) => {
  const [side, times] = arg.split(":");
  const leverage = Number(times);
  if ((side !== "long" && side !== "short") || !(leverage >= 1)) throw new Error(`bad ride "${arg}" (long:40 …)`);
  return { isLong: side === "long", leverageBps: leverage * RIDE_MIN_LEVERAGE_BPS };
});
if (rides.length === 0) throw new Error("usage: ride-open.ts long:40 short:40 …");

console.log(`rides on ${CHAIN} as ${owner}`);
await signIn();
await api.call(practiceGrantRoute, {});
await until("the dollars", async () => ((await account()).balance >= MARGIN * BigInt(rides.length) ? true : undefined));
const catalog = await loadCatalog();
for (const r of rides) {
  const spot = await spotE8();
  const a = await account();
  const intent: Act<RideIntent> = {
    action: ACTION_OPEN,
    owner,
    marketId: RIDE_MARKET,
    isLong: r.isLong,
    rideId: 0n,
    margin: MARGIN,
    leverageBps: r.leverageBps,
    size: 0n,
    // A long accepts an entry up to 2 % above the price it saw, a short down to 2 % below.
    worstPriceE8: (spot * (r.isLong ? BPS + SLIPPAGE_BPS : BPS - SLIPPAGE_BPS)) / BPS,
    recipient: owner,
    configVersion: catalog.configVersion,
    deadline: BigInt(nowSec() + INTENT_TTL_SEC),
    nonce: freshNonce(),
    epoch: a.epoch,
  };
  const signature = await wallet.signTypedData(rideIntentRequest(marketsDomain(CHAIN), intent));
  const fee = rideFee(
    rideNotional(MARGIN, BigInt(r.leverageBps)),
    BigInt(RIDE_TERMS[CHAIN].markets[SYMBOL].takerFeeBps),
  );
  const permit = await permitFor(catalog.reserve, MARGIN + fee);
  const sent = await api.call(submitRideRoute, { body: { chainId: CHAIN, intent, signature, permit } });
  const s = await settled(sent.digest, "ride");
  const what = `${r.isLong ? "long" : "short"} ${r.leverageBps / RIDE_MIN_LEVERAGE_BPS}×`;
  check(s?.state === "filled", `${what}: ride ${s?.rideId ?? "?"} ${s?.state ?? "no answer"} (${s?.txHash ?? ""})`);
}
process.exit(failed() === 0 ? 0 : 1);
