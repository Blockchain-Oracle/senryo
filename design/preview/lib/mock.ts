// Mock data shared by every direction. Numbers are illustrative only.

export type Market = {
  symbol: string;
  name: string;
  kind: "Gold" | "Stock" | "FX" | "Crypto";
  price: number;
  change: number; // percent, 24h
  spark: number[];
  session: "Open" | "Closed" | "24/7" | "Pre-market";
  maxLev: number;
};

const s = (seed: number, drift: number) =>
  Array.from({ length: 24 }, (_, i) =>
    +(100 + Math.sin(i / 2.3 + seed) * 3 + i * drift + Math.cos(i * 1.7 + seed) * 1.4).toFixed(2),
  );

export const markets: Market[] = [
  { symbol: "XAU", name: "Gold", kind: "Gold", price: 2687.4, change: 0.82, spark: s(1, 0.25), session: "Open", maxLev: 20 },
  { symbol: "NVDA", name: "NVIDIA", kind: "Stock", price: 136.24, change: 3.82, spark: s(2, 0.4), session: "Open", maxLev: 10 },
  { symbol: "AAPL", name: "Apple", kind: "Stock", price: 212.33, change: -0.72, spark: s(3, -0.15), session: "Open", maxLev: 10 },
  { symbol: "TSLA", name: "Tesla", kind: "Stock", price: 248.42, change: -2.14, spark: s(4, -0.3), session: "Pre-market", maxLev: 10 },
  { symbol: "EUR/USD", name: "Euro", kind: "FX", price: 1.0842, change: 0.11, spark: s(5, 0.05), session: "Open", maxLev: 50 },
  { symbol: "GBP/USD", name: "Pound", kind: "FX", price: 1.2716, change: -0.08, spark: s(6, -0.04), session: "Open", maxLev: 50 },
  { symbol: "BTC", name: "Bitcoin", kind: "Crypto", price: 64210.5, change: 1.46, spark: s(7, 0.3), session: "24/7", maxLev: 25 },
  { symbol: "ETH", name: "Ether", kind: "Crypto", price: 3412.8, change: 2.66, spark: s(8, 0.35), session: "24/7", maxLev: 25 },
  { symbol: "MON", name: "Monad", kind: "Crypto", price: 0.9481, change: 6.12, spark: s(9, 0.6), session: "24/7", maxLev: 10 },
];

// One balance, three buckets (risk-accounted; see codex-evaluation §C).
export const balance = {
  total: 12480.52,
  freeToTrade: 7210.4,
  freeToSpend: 3120.12,
  locked: 2150.0, // margin in use + card holds
  pnlToday: 184.22,
  pnlTodayPct: 1.5,
};

export const positions = [
  { symbol: "XAU", side: "Long" as const, size: 1500, lev: 5, entry: 2651.2, pnl: 102.4, liq: 2140.1 },
  { symbol: "NVDA", side: "Short" as const, size: 650, lev: 3, entry: 139.1, pnl: 13.4, liq: 182.6 },
];

export const cardHolds = [
  { merchant: "Blue Bottle Coffee", amount: 6.4, status: "Hold" as const, when: "Now" },
  { merchant: "Uber", amount: 23.18, status: "Hold" as const, when: "12 min" },
  { merchant: "Apple Store", amount: 129.0, status: "Settled" as const, when: "Yesterday" },
];

export const chains = [
  { id: "monad", name: "Monad", eta: "~1s" },
  { id: "ethereum", name: "Ethereum", eta: "~2 min" },
  { id: "base", name: "Base", eta: "~20s" },
  { id: "arbitrum", name: "Arbitrum", eta: "~20s" },
  { id: "solana", name: "Solana", eta: "~30s" },
];

export const depositAddress = "0x7a3F9c2E41b0D5e8A6f1c93B24dE70aF5b1C8e42";

export const fmtUsd = (n: number, d = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPrice = (m: Market) =>
  m.kind === "FX" ? m.price.toFixed(4) : m.price < 10 ? m.price.toFixed(4) : m.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
