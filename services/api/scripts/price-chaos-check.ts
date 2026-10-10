/**
 * R1.23: the price path under failure (04-pricing G3) and abuse (G6), on the real gateway, routes and stream
 * (`scripts/chaos/harness.ts`) with live Hermes behind a cuttable proxy and a RedStone gateway that misbehaves:
 * - (c) RedStone answers a 200 HTML page, then 429: the api lives on, Pyth markets stay live, RedStone's go stale;
 * - G6: 50 anonymous requests a second on `/v1/prices/print` and `/recent`: 429s, the stream keeps ticking, and not
 *   one upstream call;
 * - (a) Hermes cut for 90 s across a minute boundary: the stream says "not live" within seconds, and the boundary is
 *   back-filled after the restore;
 * - (b) the api killed at t − 1 s and back at t + 3 s: the watcher reconnects, is told to reset, and t's print is
 *   back-filled.
 * (d) — a failing ticket route — is a client behaviour: `scripts/drive/src/stream-ticket-check.ts`.
 *
 *   CHAOS_DB=postgres://…/senryo_check PYTH_API_KEY=… pnpm --filter @senryo/api exec tsx scripts/price-chaos-check.ts
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { feedIdOf, MARKETS } from "@senryo/config";
import { createLogger, HTTP_STATUS, installProcessGuards } from "@senryo/service-common";
import { openRig, type Rig } from "./chaos/harness.ts";

const MS = 1000;
const MINUTE_SEC = 60;
const CUT_MS = 90_000;
const NOT_LIVE_WITHIN_MS = 8_000;
const BACKFILL_WITHIN_MS = 60_000;
const RECONNECT_WITHIN_MS = 5_000;
/** A dead path is retried within 5 s (`DEAD_PATH_BACKOFF_MAX_MS`) and the first frame follows. */
const LIVE_AFTER_RESTORE_WITHIN_MS = 10_000;
const ABUSE_RPS = 50;
const ABUSE_SECONDS = 10;
const DOWN_MS = 4_000;
const POLL_MS = 250;
/** RedStone's first answer is a placeholder page; every later one a 429. */
const HTML_ANSWERS = 1;
const FIRST_LIVE_WITHIN_MS = 30_000;
/** RedStone rests 60 s after its first failure, so its second read (the 429) lands about 70 s in. */
const REDSTONE_BOTH_ANSWERS_WITHIN_MS = 100_000;
const SETTLE_MS = 2_000;
/** Abuse asks for instants this far back (archived or not: never upstream). */
const ABUSE_BACK_SEC = 100;

const guards = installProcessGuards(createLogger("chaos-check", "error"));
const failures: string[] = [];
const ok = (line: string) => console.log(`ok  ${line}`);
const fail = (line: string) => {
  failures.push(line);
  console.log(`FAIL ${line}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowSec = () => Math.floor(Date.now() / MS);
async function until(test: () => boolean | Promise<boolean>, withinMs: number): Promise<number | null> {
  const start = Date.now();
  while (Date.now() - start <= withinMs) {
    if (await test()) return Date.now() - start;
    await sleep(POLL_MS);
  }
  return null;
}
/** Wait for the clock's second within the minute. */
async function atSecond(s: number): Promise<void> {
  while (nowSec() % MINUTE_SEC !== s) await sleep(POLL_MS);
}

const databaseUrl = process.env.CHAOS_DB;
const pythKey = process.env.PYTH_API_KEY;
if (!databaseUrl || !pythKey) {
  console.error("CHAOS_DB (a *_check database) and PYTH_API_KEY are required");
  process.exit(1);
}

// A RedStone gateway that answers a placeholder 200 page, then refuses.
let redstoneHits = 0;
const redstone = createServer((_req, res) => {
  redstoneHits += 1;
  if (redstoneHits <= HTML_ANSWERS) res.writeHead(HTTP_STATUS.ok, { "content-type": "text/html" }).end("Hello!");
  else res.writeHead(HTTP_STATUS.tooMany).end();
});
await new Promise<void>((r) => redstone.listen(0, "127.0.0.1", r));
const redstoneUrl = `http://127.0.0.1:${(redstone.address() as AddressInfo).port}`;

const rig: Rig = await openRig({ databaseUrl, pythKey, redstoneGateways: [{ url: redstoneUrl, apiKey: "chaos" }] });
await rig.db`TRUNCATE pyth_prints`;
const btc = feedIdOf(MARKETS.find((m) => m.symbol === "BTC") as never);
const archived = async (t: number) =>
  (await rig.db`SELECT 1 FROM pyth_prints WHERE feed_id = ${btc} AND t = ${t}`).length > 0;

if ((await until(() => rig.watcher.state("BTC") === "live", FIRST_LIVE_WITHIN_MS)) === null)
  fail("BTC never went live");

// (c) RedStone misbehaving
const both = await until(() => redstoneHits > HTML_ANSWERS, REDSTONE_BOTH_ANSWERS_WITHIN_MS);
await sleep(SETTLE_MS);
const avax = rig.watcher.state("AVAX");
if (both === null) fail(`(c) RedStone was read ${redstoneHits} time(s): the 429 never came`);
else if (guards.faults().unhandledRejections > 0) fail("an unhandled rejection");
else if (rig.watcher.state("BTC") !== "live") fail(`BTC not live while RedStone failed (${rig.watcher.state("BTC")})`);
else if (avax === "live") fail("AVAX live with no RedStone price");
else ok(`(c) RedStone 200 HTML then 429 (${redstoneHits} reads): api up, BTC live, AVAX ${avax}`);

// G6 abuse
const askedBefore = rig.gateway.status().rest?.pyth.asked ?? 0;
const ticksBefore = rig.watcher.tickCount("BTC");
const codes = new Map<number, number>();
const shots: Promise<void>[] = [];
for (let i = 0; i < ABUSE_RPS * ABUSE_SECONDS; i += 1) {
  const path =
    i % 2 === 0
      ? `/v1/prices/print?symbol=BTC&t=${nowSec() - ABUSE_BACK_SEC - i}`
      : `/v1/prices/recent?symbols=${MARKETS.map((m) => m.symbol).join(",")}`;
  shots.push(fetch(`${rig.origin}${path}`).then((r) => void codes.set(r.status, (codes.get(r.status) ?? 0) + 1)));
  await sleep(MS / ABUSE_RPS);
}
await Promise.all(shots);
const askedAfter = rig.gateway.status().rest?.pyth.asked ?? 0;
const ticked = rig.watcher.tickCount("BTC") - ticksBefore;
if (!codes.get(HTTP_STATUS.tooMany)) fail(`G6 no 429s (${JSON.stringify([...codes])})`);
else if (ticked < ABUSE_SECONDS / 2) fail(`G6 the stream stalled under load (${ticked} BTC ticks)`);
else if (askedAfter !== askedBefore) fail(`G6 ${askedAfter - askedBefore} upstream asks from anonymous reads`);
else
  ok(
    `G6 ${ABUSE_RPS * ABUSE_SECONDS} anonymous reads in ${ABUSE_SECONDS} s: ${JSON.stringify(Object.fromEntries(codes))}; ${ticked} BTC ticks meanwhile; 0 upstream asks`,
  );

// (a) Hermes cut 90 s across a boundary
await atSecond(MINUTE_SEC / 2);
const boundary = (Math.floor(nowSec() / MINUTE_SEC) + 1) * MINUTE_SEC;
rig.hermes.cut();
const flagged = await until(() => rig.watcher.state("BTC") !== "live", NOT_LIVE_WITHIN_MS);
const flaggedAs = rig.watcher.state("BTC");
if (flagged === null) fail("(a) BTC still live 8 s into the cut");
await sleep(CUT_MS - (flagged ?? NOT_LIVE_WITHIN_MS));
const archivedDuringCut = await archived(boundary);
rig.hermes.restore();
const restoredAt = Date.now();
const back = await until(() => rig.watcher.state("BTC") === "live", BACKFILL_WITHIN_MS);
const filledAt = await until(() => archived(boundary), BACKFILL_WITHIN_MS);
const filled = filledAt === null ? null : Date.now() - restoredAt;
if (archivedDuringCut) fail("(a) the boundary was archived during the cut (the cut leaked)");
else if (back === null) fail("(a) BTC never came back live");
else if (back > LIVE_AFTER_RESTORE_WITHIN_MS)
  fail(`(a) BTC live again only ${(back / MS).toFixed(1)} s after the restore`);
else if (filled === null) fail("(a) the boundary was never back-filled");
else
  ok(
    `(a) Hermes cut 90 s: "${flaggedAs}" after ${((flagged ?? 0) / MS).toFixed(1)} s; live again ${(back / MS).toFixed(1)} s and the boundary back-filled ${(filled / MS).toFixed(1)} s after the restore`,
  );

// (b) the api killed at t − 1 s, back at t + 3 s
await atSecond(MINUTE_SEC - 1);
const t = (Math.floor(nowSec() / MINUTE_SEC) + 1) * MINUTE_SEC;
const connects = rig.watcher.connects;
const resets = rig.watcher.resets;
await rig.restartApi(DOWN_MS);
const reconnected = await until(() => rig.watcher.connects > connects && rig.watcher.connected, RECONNECT_WITHIN_MS);
const reset = await until(() => rig.watcher.resets > resets, RECONNECT_WITHIN_MS);
const printed = await until(() => archived(t), BACKFILL_WITHIN_MS);
if (reconnected === null) fail("(b) the watcher didn't reconnect within 5 s");
else if (reset === null) fail("(b) no reset after the restart");
else if (printed === null) fail("(b) t's print was never back-filled");
else
  ok(
    `(b) killed at t − 1 s, back at t + 3 s: reconnected in ${(reconnected / MS).toFixed(1)} s with a reset; t back-filled ${(printed / MS).toFixed(1)} s after the restart`,
  );

await rig.close();
redstone.close();
console.log(failures.length === 0 ? "all chaos checks passed" : `${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
