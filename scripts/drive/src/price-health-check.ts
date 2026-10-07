/** Read-only source → Practice oracle → API → websocket diagnostic. No account or signing credentials. */
import { createApiClient, marketsRoute, WS_PATH, wsServerMessageSchema } from "@senryo/api-client";
import { addressOf, createReadClient, readFeedRound, readOracles } from "@senryo/chain";
import { API_ORIGIN, ENGINE_MARKETS, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";

const MS_PER_SECOND = 1000;
const SAMPLE_MS = 6000;
const PRICE_DECIMALS = 18;
const DECIMAL_BASE = 10n;
const BPS = 10_000n;
const mainnet = createReadClient(MAINNET_CHAIN_ID);
const practice = createReadClient(TESTNET_CHAIN_ID);
const started = Date.now();
const socketTicks = new Map<string, { updatedAt: number; price18: bigint; status: string }>();
const stream = new Promise<void>((resolve) => {
  const socket = new WebSocket(`${API_ORIGIN.replace("https:", "wss:")}${WS_PATH}`);
  const timer = setTimeout(() => {
    socket.close();
    resolve();
  }, SAMPLE_MS);
  socket.onopen = () => {
    for (const market of ENGINE_MARKETS)
      socket.send(
        JSON.stringify({
          op: "subscribe",
          channel: `prices:${market.symbol}`,
          chainId: TESTNET_CHAIN_ID,
        }),
      );
  };
  socket.onmessage = (event) => {
    const parsed = wsServerMessageSchema.safeParse(JSON.parse(String(event.data)));
    if (parsed.success && parsed.data.type === "price") socketTicks.set(parsed.data.symbol, parsed.data);
  };
  socket.onerror = () => {
    clearTimeout(timer);
    socket.close();
    resolve();
  };
});
const [sources, mirrors, oracles, api] = await Promise.all([
  Promise.all(ENGINE_MARKETS.map((m) => readFeedRound(mainnet, m.mainnetFeed))),
  Promise.all(ENGINE_MARKETS.map((m) => readFeedRound(practice, addressOf(TESTNET_CHAIN_ID, m.testnetMirror)))),
  readOracles(
    practice,
    TESTNET_CHAIN_ID,
    ENGINE_MARKETS.map((m) => m.id),
  ),
  createApiClient({ origin: API_ORIGIN }).call(marketsRoute, { query: { chainId: TESTNET_CHAIN_ID } }),
]);
await stream;
const now = BigInt(Math.floor(Date.now() / MS_PER_SECOND));
const report = ENGINE_MARKETS.map((m, i) => {
  const source = sources[i];
  const mirror = mirrors[i];
  const oracle = oracles.find((o) => o.marketId === m.id);
  const served = api.engine.find((o) => o.id === m.id);
  const tick = socketTicks.get(m.symbol);
  if (!source || !mirror || !oracle || !served) throw new Error(`Incomplete price path for ${m.symbol}`);
  const source18 = source.answer * DECIMAL_BASE ** BigInt(PRICE_DECIMALS - m.feedDecimals);
  return {
    symbol: m.symbol,
    sourceAgeSec: Number(now - source.updatedAt),
    mirrorAgeSec: Number(now - mirror.updatedAt),
    oracleAgeSec: Number(now - oracle.updatedAt),
    oracleStatus: oracle.status,
    differenceFromSourceBps: source18 > 0n ? (((oracle.price18 - source18) * BPS) / source18).toString() : null,
    apiMatchesOracle: served.price18 === oracle.price18,
    socketObserved: !!tick,
    socketSourceAgeSec: tick ? Number(now) - tick.updatedAt : null,
    socketMatchesOracle: tick ? tick.price18 === oracle.price18 : null,
  };
});
console.log(JSON.stringify({ at: new Date().toISOString(), sampledMs: Date.now() - started, report }, null, 2));
