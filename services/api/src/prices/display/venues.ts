/**
 * The display plane's REST fallback across five venues (D-302; port of Owarine `crypto-rest.ts`). When the Coinbase
 * socket goes quiet for a market, every venue that lists it is asked at once, each with a short timeout, and the MEDIAN
 * of the last trades that came back fresh is published: one venue down, slow or off moves nothing; any one answering
 * keeps the line alive. Display only — a quote, a fill or a settlement never reads it (04-pricing §6.3).
 *
 * Pair names were read from each venue's own list on 10 Oct 2026 (Coinbase `/products`, Bitstamp
 * `/trading-pairs-info`, Bitfinex `conf/pub:list:pair:exchange`, Gemini `/v1/symbols`). Kraken was unreachable from the
 * build machine (an iPhone hotspot that drops Cloudflare ranges, as Owarine recorded); it keeps Owarine's three
 * production-verified pairs, because one unknown pair makes Kraken refuse the whole request.
 */
const TIMEOUT_MS = 3_000;
const USER_AGENT = { "user-agent": "senryo-display" };
/** A venue's last trade older than this is not a price any more. */
export const MAX_TRADE_AGE_MS = 60_000;
const E8_DECIMALS = 8;
const DECIMAL_BASE = 10n;
const MS = 1000;

/** The 24/7 crypto markets with a display line: every one trades on Coinbase and Bitstamp. */
export const DISPLAY_SYMBOLS = [
  "BTC",
  "ETH",
  "SOL",
  "DOGE",
  "XRP",
  "BNB",
  "HYPE",
  "AVAX",
  "LINK",
  "SUI",
  "TON",
  "ADA",
  "LTC",
  "DOT",
  "NEAR",
  "AAVE",
  "UNI",
] as const;

export type DisplayVenue = "coinbase" | "bitstamp" | "bitfinex" | "kraken" | "gemini";
export const DISPLAY_VENUES: readonly DisplayVenue[] = ["coinbase", "bitstamp", "bitfinex", "kraken", "gemini"];

/** Each venue's pair per catalogue symbol (absent: not listed there). */
export const VENUE_PAIRS: Readonly<Record<DisplayVenue, Readonly<Partial<Record<string, string>>>>> = {
  coinbase: Object.fromEntries(DISPLAY_SYMBOLS.map((s) => [s, `${s}-USD`])),
  bitstamp: Object.fromEntries(DISPLAY_SYMBOLS.map((s) => [s, `${s.toLowerCase()}usd`])),
  bitfinex: {
    BTC: "tBTCUSD",
    ETH: "tETHUSD",
    SOL: "tSOLUSD",
    DOGE: "tDOGE:USD",
    XRP: "tXRPUSD",
    HYPE: "tHYPE:USD",
    AVAX: "tAVAX:USD",
    LINK: "tLINK:USD",
    SUI: "tSUIUSD",
    TON: "tTONUSD",
    ADA: "tADAUSD",
    LTC: "tLTCUSD",
    DOT: "tDOTUSD",
    NEAR: "tNEAR:USD",
    AAVE: "tAAVE:USD",
    UNI: "tUNIUSD",
  },
  kraken: { BTC: "XBTUSD", ETH: "ETHUSD", SOL: "SOLUSD" },
  gemini: Object.fromEntries(
    ["BTC", "ETH", "SOL", "DOGE", "XRP", "BNB", "HYPE", "AVAX", "LINK", "SUI", "LTC", "DOT", "AAVE", "UNI"].map((s) => [
      s,
      `${s.toLowerCase()}usd`,
    ]),
  ),
};
/** Kraken answers with its own keys (BTC as XXBTZUSD). */
const KRAKEN_KEYS: Readonly<Partial<Record<string, readonly string[]>>> = {
  BTC: ["XXBTZUSD", "XBTUSD"],
  ETH: ["XETHZUSD", "ETHUSD"],
  SOL: ["SOLUSD"],
};

export interface VenueTrade {
  venue: DisplayVenue;
  priceE8: bigint;
  timeMs: number;
}

const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/** "82767.25" → 8276725000000n; null for anything that isn't a plain positive decimal. */
export function decimalE8(v: unknown): bigint | null {
  const text = typeof v === "number" ? (Number.isFinite(v) && v > 0 ? v.toFixed(E8_DECIMALS) : null) : v;
  if (typeof text !== "string") return null;
  const m = DECIMAL.exec(text);
  if (!m) return null;
  const frac = (m[2] ?? "").slice(0, E8_DECIMALS).padEnd(E8_DECIMALS, "0");
  const e8 = BigInt(m[1] ?? "0") * DECIMAL_BASE ** BigInt(E8_DECIMALS) + BigInt(frac);
  return e8 > 0n ? e8 : null;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: USER_AGENT, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
  return (await res.json()) as unknown;
}

/** One venue's last trades for the symbols it lists; a venue answering one call for every symbol is asked once. */
export async function readVenue(
  venue: DisplayVenue,
  symbols: readonly string[],
  nowMs: number,
): Promise<Map<string, VenueTrade>> {
  const out = new Map<string, VenueTrade>();
  const put = (symbol: string, price: unknown, timeMs: number) => {
    const priceE8 = decimalE8(price);
    if (priceE8) out.set(symbol, { venue, priceE8, timeMs: Number.isFinite(timeMs) ? timeMs : nowMs });
  };
  const pairs = VENUE_PAIRS[venue];
  const listed = symbols.filter((s) => pairs[s]);
  if (listed.length === 0) return out;
  switch (venue) {
    case "coinbase":
      await Promise.all(
        listed.map(async (s) => {
          const b = (await getJson(`https://api.exchange.coinbase.com/products/${pairs[s]}/ticker`)) as {
            price?: unknown;
            time?: string;
          };
          put(s, b.price, b.time ? Date.parse(b.time) : nowMs);
        }),
      );
      break;
    case "bitstamp":
      await Promise.all(
        listed.map(async (s) => {
          // Bitstamp's fields: `last`, and the trade time in whole seconds.
          const b = (await getJson(`https://www.bitstamp.net/api/v2/ticker/${pairs[s]}/`)) as Record<string, unknown>;
          const sec = Number(b.timestamp);
          put(s, b.last, Number.isFinite(sec) && sec > 0 ? sec * MS : nowMs);
        }),
      );
      break;
    case "bitfinex": {
      // [SYMBOL, BID, BID_SIZE, ASK, ASK_SIZE, DAILY_CHANGE, DAILY_CHANGE_RELATIVE, LAST_PRICE, …]; no trade time.
      const LAST_PRICE = 7;
      const rows = (await getJson(
        `https://api-pub.bitfinex.com/v2/tickers?symbols=${listed.map((s) => pairs[s]).join(",")}`,
      )) as unknown[][];
      for (const s of listed) {
        const row = Array.isArray(rows) ? rows.find((r) => Array.isArray(r) && r[0] === pairs[s]) : undefined;
        if (row) put(s, row[LAST_PRICE], nowMs);
      }
      break;
    }
    case "kraken": {
      const b = (await getJson(
        `https://api.kraken.com/0/public/Ticker?pair=${listed.map((s) => pairs[s]).join(",")}`,
      )) as { result?: Record<string, { c?: unknown[] }> };
      for (const s of listed) {
        const key = (KRAKEN_KEYS[s] ?? []).find((k) => b.result?.[k]);
        if (key) put(s, b.result?.[key]?.c?.[0], nowMs);
      }
      break;
    }
    case "gemini":
      await Promise.all(
        listed.map(async (s) => {
          // Gemini's fields: `last`, and the trade time in ms under `volume.timestamp`.
          const b = (await getJson(`https://api.gemini.com/v1/pubticker/${pairs[s]}`)) as Record<string, unknown>;
          const ms = Number((b.volume as Record<string, unknown> | undefined)?.timestamp);
          put(s, b.last, Number.isFinite(ms) && ms > 0 ? ms : nowMs);
        }),
      );
      break;
  }
  return out;
}

/** The median of fresh trades (the lower middle of an even count, so it is always a real venue's price). */
export function medianTrade(trades: readonly VenueTrade[], nowMs: number): VenueTrade | null {
  const fresh = trades
    .filter((t) => nowMs - t.timeMs <= MAX_TRADE_AGE_MS)
    .sort((a, b) => (a.priceE8 < b.priceE8 ? -1 : a.priceE8 > b.priceE8 ? 1 : 0));
  return fresh[Math.floor((fresh.length - 1) / 2)] ?? null;
}

/** Every venue at once for `symbols`: per symbol the median trade and how many venues answered. Never throws. */
export async function readMedian(
  symbols: readonly string[],
  nowMs: number,
  venues: readonly DisplayVenue[] = DISPLAY_VENUES,
): Promise<{ bySymbol: Map<string, { trade: VenueTrade; venues: number }>; failed: DisplayVenue[] }> {
  const results = await Promise.allSettled(venues.map((v) => readVenue(v, symbols, nowMs)));
  const failed: DisplayVenue[] = [];
  const perSymbol = new Map<string, VenueTrade[]>();
  results.forEach((r, i) => {
    const venue = venues[i];
    if (r.status === "rejected") {
      if (venue) failed.push(venue);
      return;
    }
    for (const [s, t] of r.value) perSymbol.set(s, [...(perSymbol.get(s) ?? []), t]);
  });
  const bySymbol = new Map<string, { trade: VenueTrade; venues: number }>();
  for (const [s, trades] of perSymbol) {
    const m = medianTrade(trades, nowMs);
    if (m) bySymbol.set(s, { trade: m, venues: trades.filter((t) => nowMs - t.timeMs <= MAX_TRADE_AGE_MS).length });
  }
  return { bySymbol, failed };
}
