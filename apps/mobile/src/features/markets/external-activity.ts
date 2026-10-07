/** Public spot executions, kept separate from Senryo's opt-in social trades and executable prices. */
export const ACTIVITY_PAIRS = {
  XAU: {
    pair: "PAXGUSDT",
    base: "PAXG",
    label: "PAXG/USDT",
    note: "Gold-backed token spot trades; Senryo gold is XAU/USD.",
  },
  EUR: { pair: "EURUSDT", base: "EUR", label: "EUR/USDT", note: "Spot trades; Senryo prices EUR/USD from its oracle." },
  BTC: { pair: "BTCUSDT", base: "BTC", label: "BTC/USDT" },
  ETH: { pair: "ETHUSDT", base: "ETH", label: "ETH/USDT" },
  SOL: { pair: "SOLUSDT", base: "SOL", label: "SOL/USDT" },
  ZEC: { pair: "ZECUSDT", base: "ZEC", label: "ZEC/USDT" },
  NEAR: { pair: "NEARUSDT", base: "NEAR", label: "NEAR/USDT" },
  PUMP: { pair: "PUMPUSDT", base: "PUMP", label: "PUMP/USDT" },
} as const;

export type ActivitySymbol = keyof typeof ACTIVITY_PAIRS;
export function hasActivityPair(symbol: string): symbol is ActivitySymbol {
  return Object.hasOwn(ACTIVITY_PAIRS, symbol);
}

export interface ExternalTrade {
  id: string;
  symbol: ActivitySymbol;
  at: number;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  notional: number;
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 3600;
export const MAX_AGE_MS = SECONDS_PER_HOUR * MS_PER_SECOND;
const FUTURE_TOLERANCE_MS = 5000;
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const REQUEST_TIMEOUT_MS = 6000;
const API = "https://data-api.binance.vision/api/v3/aggTrades";

/** `m` means the buyer provided resting liquidity, so the aggressor sold. */
export function parseExternalTrades(symbol: ActivitySymbol, raw: unknown, now = Date.now()): ExternalTrade[] {
  if (!Array.isArray(raw)) throw new Error("Market activity response was invalid");
  const result: ExternalTrade[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { a?: unknown; p?: unknown; q?: unknown; T?: unknown; m?: unknown };
    if (
      typeof row.a !== "number" ||
      !Number.isSafeInteger(row.a) ||
      row.a < 0 ||
      typeof row.p !== "string" ||
      !DECIMAL.test(row.p) ||
      typeof row.q !== "string" ||
      !DECIMAL.test(row.q) ||
      typeof row.T !== "number" ||
      !Number.isSafeInteger(row.T) ||
      row.T < now - MAX_AGE_MS ||
      row.T > now + FUTURE_TOLERANCE_MS ||
      typeof row.m !== "boolean"
    )
      continue;
    const price = Number(row.p);
    const quantity = Number(row.q);
    const notional = price * quantity;
    if (!Number.isFinite(notional) || price <= 0 || quantity <= 0 || notional <= 0) continue;
    result.push({
      id: `${symbol}-${row.a}`,
      symbol,
      at: row.T,
      side: row.m ? "sell" : "buy",
      quantity,
      price,
      notional,
    });
  }
  return result.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
}

export async function fetchExternalTrades(symbol: ActivitySymbol, signal?: AbortSignal): Promise<ExternalTrade[]> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
  try {
    const pair = ACTIVITY_PAIRS[symbol].pair;
    const response = await fetch(`${API}?symbol=${pair}&limit=24`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Market activity source returned ${response.status}`);
    return parseExternalTrades(symbol, await response.json());
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
