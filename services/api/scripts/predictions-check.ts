/** Public prediction adapter regression checks. No UI, signer, account, transaction or paid provider request. */
import assert from "node:assert/strict";
import rateLimit from "@fastify/rate-limit";
import { createApiClient, predictionDetailRoute, predictionHistoryRoute, predictionsRoute } from "@senryo/api-client";
import type { CastoraPool } from "@senryo/chain";
import { PREDICTION_VENUES } from "@senryo/config";
import { createHttpServer, createLogger, HTTP_STATUS } from "@senryo/service-common";
import { CastoraDiscovery, contestOf } from "../src/predictions/castora.ts";
import { PolymarketDiscovery, parseBinaryPrediction } from "../src/predictions/polymarket.ts";
import { registerPredictionRoutes } from "../src/routes/predictions.ts";

const OUT_OF_WINDOW_SEC = 100;
const MS_PER_SECOND = 1000;
const STAKE_MON = 100n;
const BPS_ONE = 10_000;
const DECIMAL_BASE = 10n;
const TWO_MINUTES = 120;
const MON_DECIMALS = 18;
const HALF_HOUR = 1800;
const MON_DECIMALS_BIGINT = 18n;
const ADDRESS_HEX_CHARS = 40;
const POOL_FEE_BPS = 500;
const TEN_MINUTES = 600;
const HASH_HEX_CHARS = 64;
const WINDOW_SEC = 900;
const AFTER_WINDOW_SEC = 901;

const at = 1_791_109_000;
const raw = {
  id: "123",
  slug: "btc-updown-15m-1791108900",
  question: "Bitcoin Up or Down - event",
  outcomes: '["Up","Down"]',
  outcomePrices: '["0","1"]',
  clobTokenIds: '["111","222"]',
  active: true,
  closed: false,
  acceptingOrders: true,
  description: "Authoritative event rules",
  endDate: new Date((at + WINDOW_SEC) * MS_PER_SECOND).toISOString(),
  eventStartTime: new Date(at * MS_PER_SECOND).toISOString(),
  cryptoMarketConfig: { asset: "btc", duration: "15m" },
};
let checks = 0;
function check(name: string, run: () => void) {
  run();
  checks++;
  console.log(`PASS ${name}`);
}
check("zero price stays zero, not unavailable", () =>
  assert.equal(parseBinaryPrediction(raw, at)?.outcomes[0]?.priceBps, 0),
);
check("missing prices are unavailable, never zero", () =>
  assert.deepEqual(
    parseBinaryPrediction({ ...raw, outcomePrices: null }, at)?.outcomes.map((o) => o.priceBps),
    [null, null],
  ),
);
check("extreme exponents and out-of-range prices stay unavailable", () =>
  assert.deepEqual(
    parseBinaryPrediction({ ...raw, outcomePrices: '["1e999999","2"]' }, at)?.outcomes.map((o) => o.priceBps),
    [null, null],
  ),
);
check("price one alone is not resolution", () => assert.equal(parseBinaryPrediction(raw, at)?.winner, null));
check("closed alone is not resolution", () =>
  assert.equal(parseBinaryPrediction({ ...raw, closed: true }, at)?.status, "closed"),
);
check("explicit resolution plus exact terminal prices establishes winner", () =>
  assert.equal(parseBinaryPrediction({ ...raw, closed: true, umaResolutionStatus: "resolved" }, at)?.winner, "Down"),
);
check("disputed markets never declare a winner", () => {
  const m = parseBinaryPrediction({ ...raw, closed: true, umaResolutionStatus: "disputed" }, at);
  assert.equal(m?.status, "disputed");
  assert.equal(m?.winner, null);
});
check("deadline without resolution is resolving", () =>
  assert.equal(parseBinaryPrediction(raw, at + AFTER_WINDOW_SEC)?.status, "resolving"),
);
check("future event is upcoming", () => assert.equal(parseBinaryPrediction(raw, at - 1)?.status, "upcoming"));
check("unrelated BTC questions are outside price scope", () =>
  assert.equal(parseBinaryPrediction({ ...raw, question: "Bitcoin endorsed by a politician?" }, at), null),
);
check("Yes/No price thresholds retain the question and labels", () => {
  const m = parseBinaryPrediction(
    {
      ...raw,
      question: "Will the price of Bitcoin be above $90,000?",
      outcomes: '["Yes","No"]',
      cryptoMarketConfig: null,
    },
    at,
  );
  assert.equal(m?.asset, "BTC");
  assert.equal(m?.outcomes[0]?.label, "Yes");
  assert.equal(m?.window, null);
});
check("unexpected categorical outcomes are not binary", () =>
  assert.equal(parseBinaryPrediction({ ...raw, outcomes: '["A","B","C"]' }, at), null),
);
check("malformed outcome JSON fails explicitly", () =>
  assert.throws(() => parseBinaryPrediction({ ...raw, outcomes: "oops" }, at)),
);
check("unsafe provider link slugs fail validation", () =>
  assert.throws(() => parseBinaryPrediction({ ...raw, slug: "../../secret" }, at)),
);

const pool: CastoraPool = {
  poolId: 1n,
  seeds: {
    predictionToken: PREDICTION_VENUES.castora.core,
    stakeToken: PREDICTION_VENUES.castora.core,
    stakeAmount: STAKE_MON * DECIMAL_BASE ** MON_DECIMALS_BIGINT,
    snapshotTime: BigInt(at + HALF_HOUR),
    windowCloseTime: BigInt(at + WINDOW_SEC),
    feesPercent: 500,
    multiplier: 200,
    isUnlisted: false,
  },
  seedsHash: `0x${"0".repeat(HASH_HEX_CHARS)}`,
  creationTime: BigInt(at - WINDOW_SEC),
  noOfPredictions: 2n,
  snapshotPrice: 0n,
  completionTime: 0n,
  winAmount: 0n,
  noOfWinners: 0n,
  noOfClaimedWinnings: 0n,
};
const snap = { paused: false, observedAt: at, blockNumber: 1n };
check("contest identity is distinct from outcome shares", () => {
  const m = contestOf(pool, snap);
  assert.equal(m?.kind, "price-contest");
  assert.equal(m?.stakeSymbol, "MON");
  assert.equal(m?.stakeDecimals, MON_DECIMALS);
  assert.equal(m?.feesBps, POOL_FEE_BPS);
  assert.equal(m?.execution, "view-only");
});
check("unlisted contests stay private", () =>
  assert.equal(contestOf({ ...pool, seeds: { ...pool.seeds, isUnlisted: true } }, snap), null),
);
check("unknown prediction identifiers do not inherit a known mark", () =>
  assert.equal(
    contestOf({ ...pool, seeds: { ...pool.seeds, predictionToken: `0x${"1".repeat(ADDRESS_HEX_CHARS)}` } }, snap),
    null,
  ),
);
check("unknown stake decimals are never assumed native", () =>
  assert.equal(
    contestOf({ ...pool, seeds: { ...pool.seeds, stakeToken: `0x${"1".repeat(ADDRESS_HEX_CHARS)}` } }, snap)
      ?.stakeDecimals,
    null,
  ),
);

const original = globalThis.fetch;
let outage = false,
  calls = 0;
const now = Math.floor(Date.now() / MS_PER_SECOND);
const liveRaw = {
  ...raw,
  endDate: new Date((now + WINDOW_SEC) * MS_PER_SECOND).toISOString(),
  eventStartTime: new Date((now - TEN_MINUTES) * MS_PER_SECOND).toISOString(),
};
globalThis.fetch = async (input) => {
  calls++;
  if (outage) return new Response("{}", { status: 503 });
  const u = new URL(String(input));
  assert.ok(u.origin === PREDICTION_VENUES.polymarket.gamma || u.origin === PREDICTION_VENUES.polymarket.data);
  if (u.pathname === "/events/keyset")
    return Response.json({ events: [{ tags: [{ slug: "crypto-prices" }], markets: [liveRaw] }], next_cursor: null });
  if (u.pathname === "/markets/999") return new Response("{}", { status: 404 });
  if (u.pathname === "/markets/456") return Response.json({ ...liveRaw, id: "456", question: "Election result?" });
  if (u.pathname.startsWith("/markets/")) return Response.json(liveRaw);
  assert.equal(u.pathname, "/v2/prices-history");
  assert.equal(u.searchParams.get("token_id"), "111");
  return Response.json({
    data: [
      { timestamp: now - TWO_MINUTES, price: 0, resolution_seconds: 60 },
      { timestamp: now - 60, price: 1, resolution_seconds: 0 },
      { timestamp: now - 60, price: 1, resolution_seconds: 0 },
      { timestamp: now + OUT_OF_WINDOW_SEC, price: 0.5, resolution_seconds: 60 },
    ],
    pagination: { has_more: false },
  });
};
const log = createLogger("prediction-check", "silent");
const app = createHttpServer({ service: "prediction-check", logger: log });
await app.register(rateLimit, { global: false });
registerPredictionRoutes(app, log);
const api = createApiClient({
  origin: "http://check.invalid",
  fetch: async (input) => {
    const r = await app.inject({ method: "GET", url: new URL(String(input)).pathname + new URL(String(input)).search });
    return new Response(r.body, { status: r.statusCode });
  },
});
try {
  const input = { provider: "polymarket", asset: "BTC", window: "15m", state: "open" } as const;
  const pages = await Promise.all([
    api.call(predictionsRoute, { query: input }),
    api.call(predictionsRoute, { query: input }),
  ]);
  check("public browsing and concurrent requests use one cached upstream read", () => {
    assert.equal(pages[0]?.markets.length, 1);
    assert.equal(calls, 1);
  });
  const detail = await api.call(predictionDetailRoute, { params: { provider: "polymarket", id: "123" } });
  check("route/client codecs preserve missing liquidity and explicit settlement venue", () => {
    assert.equal(detail.settlementNetwork, "Polygon");
    assert.equal(detail.kind === "binary" && detail.liquidityUsd6, null);
  });
  const history = await api.call(predictionHistoryRoute, {
    params: { provider: "polymarket", id: "123" },
    query: { outcome: 0 },
  });
  check("history preserves zero/one, dedupes and removes out-of-window observations", () => {
    assert.equal(history.points.length, 2);
    assert.deepEqual(
      history.points.map((p) => p.priceBps),
      [0, BPS_ONE],
    );
  });
  const errors = await Promise.all([
    app.inject("/v1/predictions?provider=unknown"),
    app.inject("/v1/predictions/polymarket/123/history?outcome=2"),
    app.inject("/v1/predictions/polymarket/999"),
    app.inject("/v1/predictions/polymarket/456"),
  ]);
  check("invalid inputs and missing/out-of-scope details are truthful 400/404", () =>
    assert.deepEqual(
      errors.map((r) => r.statusCode),
      [HTTP_STATUS.badRequest, HTTP_STATUS.badRequest, HTTP_STATUS.notFound, HTTP_STATUS.notFound],
    ),
  );
  outage = true;
  const failed = await app.inject("/v1/predictions?asset=ETH");
  check("provider outage is 503, never a successful empty market list", () => {
    assert.equal(failed.statusCode, HTTP_STATUS.unavailable);
    assert.equal(failed.json().error.code, "UPSTREAM_UNAVAILABLE");
  });
} finally {
  globalThis.fetch = original;
  await app.close();
}

if (process.argv.includes("--live")) {
  const venue = new PolymarketDiscovery();
  for (const window of ["15m", "5m", "price-events"] as const) {
    const page = await venue.list({ provider: "polymarket", asset: "all", window, state: "open" });
    predictionsRoute.response.encode(page);
    assert.ok(page.markets.length > 0, `${window}: no current price markets returned`);
    console.log(
      JSON.stringify({
        live: window,
        count: page.markets.length,
        assets: [...new Set(page.markets.map((m) => m.asset))],
      }),
    );
    const market = page.markets.find((m) => m.status === "open") ?? page.markets[0];
    assert.ok(market);
    const detail = await venue.detail(market.id);
    assert.ok(detail);
    predictionDetailRoute.response.encode(detail);
    const history = await venue.history(market.id, 0);
    assert.ok(history);
    predictionHistoryRoute.response.encode(history);
    console.log(JSON.stringify({ history: window, points: history?.points.length }));
  }
  const recent = await venue.list({ provider: "polymarket", asset: "BTC", window: "15m", state: "recent" });
  predictionsRoute.response.encode(recent);
  console.log(
    JSON.stringify({ recent: recent.markets.length, statuses: [...new Set(recent.markets.map((m) => m.status))] }),
  );
  const contests = await new CastoraDiscovery().list();
  predictionsRoute.response.encode(contests);
  console.log(
    JSON.stringify({
      contests: contests.markets.length,
      open: contests.markets.filter((m) => m.status === "open").length,
      observedAt: contests.observedAt,
      limited: contests.limited,
    }),
  );
}
console.log(`${checks} prediction checks passed`);
