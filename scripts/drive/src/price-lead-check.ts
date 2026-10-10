/**
 * R1.18 measurement (internal analysis, never shown to anyone): how far Pyth's prints trail the exchanges (δ), and
 * whether Pyth's 1-second moves carry momentum (autocorrelation at 1–3 s). R3 sets the fill delay from δ (2 s if it is
 * over ~0.5 s) and checks the spread curve against the momentum: a call that fills a second later at a price that
 * keeps going the same way is a free option.
 *
 * Pyth: the keyed Hermes stream (`PYTH_API_KEY`, `HERMES_ORIGIN`), arrival times on this clock. The tape: Bitfinex's
 * public trades — its terms allow internal analysis; Coinbase's do not (docs/research/replan-2026-10-10/09).
 * δ is the shift of the tape that best lines up the two series' one-second changes (the highest correlation).
 *
 *   PYTH_API_KEY=… MINUTES=20 pnpm --filter @senryo/drive exec tsx src/price-lead-check.ts
 */
import { feedIdOf, MARKETS } from "@senryo/config";
import { sleep } from "./lib.ts";

const HERMES = (process.env.HERMES_ORIGIN ?? "https://pyth.dourolabs.app/hermes").replace(/\/+$/, "");
const KEY = process.env.PYTH_API_KEY;
const DEFAULT_MINUTES = 20;
const MINUTES = Number(process.env.MINUTES ?? DEFAULT_MINUTES);
const SYMBOLS = ["BTC", "ETH", "SOL"] as const;
const BITFINEX_WS = "wss://api-pub.bitfinex.com/ws/2";
const MS = 1000;
const SECONDS_PER_MINUTE = 60;
/** Candidate lags of the tape behind Pyth's arrival, in ms (negative: the tape leads). */
const LAG_FROM_MS = -4000;
const LAG_TO_MS = 1000;
const LAG_STEP_MS = 100;
/** Pyth's return autocorrelation at these steps (one step a second). */
const MAX_AUTOCORR_LAG = 3;
const AUTOCORR_LAGS = Array.from({ length: MAX_AUTOCORR_LAG }, (_, i) => i + 1);
const DIGITS = 3;
const MIN_POINTS = 120;
/** Both feeds reconnect this long after a drop (a 20-minute recording on a home network will see some). */
const RECONNECT_MS = 1_000;
/** `[chanId, kind, payload]`: the message kind ("te" an executed trade). */
const MSG_KIND = 1;
const TRADE_MTS = 1;
const TRADE_PRICE = 3;

interface PythPoint {
  publishSec: number;
  arrivedMs: number;
  price: number;
}
interface Trade {
  ms: number;
  price: number;
}

if (!KEY) {
  console.error("PYTH_API_KEY is required");
  process.exit(1);
}

const reconnects = { pyth: 0, tape: 0 };
const pyth = new Map<string, PythPoint[]>(SYMBOLS.map((s) => [s, []]));
const tape = new Map<string, Trade[]>(SYMBOLS.map((s) => [s, []]));
const bySymbolFeed = new Map(
  SYMBOLS.map((s) => [feedIdOf(MARKETS.find((m) => m.symbol === s) as never).slice(2), s] as const),
);

/** A print as a float sample for the statistics below: never shown, stored or settled from (money stays integer). */
function sampleOf(raw: string, expo: number): number {
  return Number(raw) * 10 ** expo;
}

async function readPyth(signal: AbortSignal): Promise<void> {
  const ids = [...bySymbolFeed.keys()].map((id) => `ids[]=${id}`).join("&");
  const res = await fetch(`${HERMES}/v2/updates/price/stream?${ids}&parsed=true&channel=fixed_rate@1000ms`, {
    headers: { authorization: `Bearer ${KEY}`, accept: "text/event-stream" },
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`hermes ${res.status}`);
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let at = buf.indexOf("\n\n");
    while (at >= 0) {
      const frame = buf.slice(0, at);
      buf = buf.slice(at + 2);
      at = buf.indexOf("\n\n");
      const data = /^data:(.*)$/m.exec(frame)?.[1];
      if (!data) continue;
      const arrivedMs = Date.now();
      const msg = JSON.parse(data) as {
        parsed: { id: string; price: { price: string; expo: number; publish_time: number } }[];
      };
      for (const p of msg.parsed) {
        const s = bySymbolFeed.get(p.id);
        const list = s ? pyth.get(s) : undefined;
        if (!list || list.at(-1)?.publishSec === p.price.publish_time) continue;
        list.push({ publishSec: p.price.publish_time, arrivedMs, price: sampleOf(p.price.price, p.price.expo) });
      }
    }
  }
}

/** The tape, reopened after any drop until `stopped` says otherwise. */
function readTape(stopped: () => boolean): void {
  const ws = new WebSocket(BITFINEX_WS);
  ws.onclose = () => {
    if (stopped()) return;
    reconnects.tape += 1;
    setTimeout(() => readTape(stopped), RECONNECT_MS);
  };
  const channel = new Map<number, string>();
  ws.onopen = () => {
    for (const s of SYMBOLS) ws.send(JSON.stringify({ event: "subscribe", channel: "trades", symbol: `t${s}USD` }));
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data)) as unknown;
    if (!Array.isArray(msg)) {
      const m = msg as { event?: string; chanId?: number; pair?: string };
      if (m.event === "subscribed" && m.chanId !== undefined && m.pair)
        channel.set(m.chanId, m.pair.replace("USD", ""));
      return;
    }
    const s = channel.get(msg[0] as number);
    // [chanId, "te", [ID, MTS, AMOUNT, PRICE]]: an executed trade (the snapshot and "tu" repeats are skipped).
    if (!s || msg[MSG_KIND] !== "te") return;
    const t = msg[2] as number[];
    tape.get(s)?.push({ ms: t[TRADE_MTS] ?? 0, price: t[TRADE_PRICE] ?? 0 });
  };
  sockets.push(ws);
}
const sockets: WebSocket[] = [];

/** The last trade at or before `ms` (trades are in time order), or null. */
function priceAt(trades: readonly Trade[], ms: number): number | null {
  let lo = 0;
  let hi = trades.length - 1;
  let best: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = trades[mid] as Trade;
    if (t.ms <= ms) {
      best = t.price;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

function correlation(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const x = (a[i] ?? 0) - ma;
    const y = (b[i] ?? 0) - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** δ: the tape shift whose one-second changes line up best with Pyth's (by arrival time). */
function lead(points: readonly PythPoint[], trades: readonly Trade[]) {
  let best = { lagMs: 0, corr: -1 };
  for (let lag = LAG_FROM_MS; lag <= LAG_TO_MS; lag += LAG_STEP_MS) {
    const rp: number[] = [];
    const rt: number[] = [];
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1] as PythPoint;
      const b = points[i] as PythPoint;
      const ea = priceAt(trades, a.arrivedMs + lag);
      const eb = priceAt(trades, b.arrivedMs + lag);
      if (ea === null || eb === null) continue;
      rp.push(b.price - a.price);
      rt.push(eb - ea);
    }
    const corr = correlation(rp, rt);
    if (corr > best.corr) best = { lagMs: lag, corr };
  }
  return best;
}

function autocorrelation(points: readonly PythPoint[], k: number): number {
  const r = points.slice(1).map((p, i) => p.price - (points[i] as PythPoint).price);
  return correlation(r.slice(0, -k), r.slice(k));
}

const abort = new AbortController();
readTape(() => abort.signal.aborted);
void (async () => {
  while (!abort.signal.aborted) {
    try {
      await readPyth(abort.signal);
    } catch (error) {
      if (abort.signal.aborted) return;
      console.error(`hermes: ${(error as Error).message}`);
    }
    if (abort.signal.aborted) return;
    reconnects.pyth += 1;
    await sleep(RECONNECT_MS);
  }
})();
console.log(`recording ${MINUTES} min of Pyth beside Bitfinex trades for ${SYMBOLS.join(", ")}…`);
await sleep(MINUTES * SECONDS_PER_MINUTE * MS);
abort.abort();
for (const ws of sockets) ws.close();

const rows = SYMBOLS.map((s) => {
  const points = pyth.get(s) ?? [];
  const trades = (tape.get(s) ?? []).sort((a, b) => a.ms - b.ms);
  const l = lead(points, trades);
  const ac = AUTOCORR_LAGS.map((k) => autocorrelation(points, k));
  return { symbol: s, pythPoints: points.length, trades: trades.length, ...l, autocorr: ac };
});
for (const r of rows) {
  const sign = r.lagMs <= 0 ? "Pyth trails the tape by" : "Pyth leads the tape by";
  console.log(
    `  ${r.symbol}: ${r.pythPoints} Pyth prints, ${r.trades} trades · ${sign} ${Math.abs(r.lagMs)} ms (corr ${r.corr.toFixed(2)})` +
      ` · Pyth 1 s return autocorrelation at ${AUTOCORR_LAGS.join("/")} s: ${r.autocorr.map((x) => x.toFixed(DIGITS)).join(" / ")}`,
  );
}
console.log(`  reconnects: Hermes ${reconnects.pyth}, tape ${reconnects.tape}`);
console.log(JSON.stringify({ at: new Date().toISOString(), minutes: MINUTES, reconnects, rows }));
const enough = rows.every((r) => r.pythPoints >= MIN_POINTS && r.trades >= MIN_POINTS);
if (!enough) console.log("(thin: fewer than 120 prints or trades for a market — re-run on a weekday)");
process.exit(enough ? 0 : 2);
