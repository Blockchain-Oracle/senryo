import { type Prediction, type PredictionProvider, predictionParamsSchema } from "@senryo/api-client";

/** Venue-qualified identities survive expiry, refresh and account watchlist restoration. No stored price or title. */
export interface PredictionReference {
  provider: PredictionProvider;
  id: string;
}
export const predictionWatchKey = ({ provider, id }: PredictionReference) => `prediction:${provider}:${id}`;

export function predictionReference(key: string): PredictionReference | undefined {
  const [prefix, provider, id, extra] = key.split(":");
  if (prefix !== "prediction" || extra !== undefined) return undefined;
  const parsed = predictionParamsSchema.safeParse({ provider, id });
  return parsed.success ? parsed.data : undefined;
}

/** Search covers the fetched public selection; it never claims to search every market at the venue. */
export function matchesPrediction(market: Prediction, query: string): boolean {
  const names: Record<string, string> = { BTC: "Bitcoin", ETH: "Ethereum Ether", SOL: "Solana", MON: "Monad" };
  const name = names[market.asset] ?? market.asset;
  const window = market.kind === "binary" ? (market.window ?? "price event yes no") : "price contest";
  const haystack =
    `${market.title} #${market.id} ${market.asset} ${name} ${market.provider} ${market.settlementNetwork} ${window}`
      .normalize("NFKC")
      .toLowerCase();
  return query
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}
