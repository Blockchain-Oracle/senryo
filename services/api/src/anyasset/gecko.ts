/**
 * GeckoTerminal (keyless, ~10–30 calls/min per IP): USD prices of verified Monad tokens (`simple/…/token_price`, with
 * the 24 h change) and images for unverified ones (`tokens/multi`). Up to 30 addresses per call, every answer cached
 * per token (misses too), stale prices served for a while when GeckoTerminal is unreachable, and a 429 pauses calls.
 * Prices are mainnet only (GeckoTerminal has no Monad testnet). Attribution: GECKOTERMINAL_ATTRIBUTION (config).
 */
import { GECKOTERMINAL_BATCH, GECKOTERMINAL_TOKEN_PRICE_URL, GECKOTERMINAL_TOKENS_MULTI_URL } from "@senryo/config";
import type { Logger } from "@senryo/service-common";
import { z } from "zod";
import { GECKO_BACKOFF_MS, IMAGE_TTL_MS, PRICE_STALE_MAX_MS, PRICE_TTL_MS } from "./constants.ts";
import { decimalToUnits, errorText, fetchJson, isRateLimited, percentToBps, TtlCache } from "./upstream.ts";

export interface TokenPrice {
  /** USD × 1e18 per whole token. */
  priceUsd18: bigint;
  change24hBps: number | null;
  source: "geckoterminal" | "alchemy";
}

const PRICE_DECIMALS = 18;
const CACHE_MAX = 20_000;
/** GeckoTerminal's placeholder image for tokens without one. */
const MISSING_IMAGE = /missing\.png/;

const priceSchema = z.object({
  data: z.object({
    attributes: z.object({
      token_prices: z.record(z.string(), z.string().nullable()),
      h24_price_change_percentage: z.record(z.string(), z.string().nullable()).nullish(),
    }),
  }),
});
const multiSchema = z.object({
  data: z.array(z.object({ attributes: z.object({ address: z.string(), image_url: z.string().nullish() }) })),
});

const chunks = <T>(list: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

export class GeckoTerminal {
  private readonly prices = new TtlCache<TokenPrice | null>(CACHE_MAX);
  private readonly images = new TtlCache<string | null>(CACHE_MAX);
  private pausedUntil = 0;

  constructor(private readonly log: Logger) {}

  /** Prices for lower-case mainnet addresses; a token GeckoTerminal doesn't price is absent from the map. */
  async priceMap(addresses: readonly string[]): Promise<Map<string, TokenPrice>> {
    const wanted = [...new Set(addresses.map((a) => a.toLowerCase()))];
    const missing = wanted.filter((a) => this.prices.get(a) === undefined);
    if (missing.length > 0 && Date.now() >= this.pausedUntil) {
      for (const batch of chunks(missing, GECKOTERMINAL_BATCH)) {
        try {
          await this.fetchPrices(batch);
        } catch (error) {
          this.onError(error, "price");
          break;
        }
      }
    }
    const out = new Map<string, TokenPrice>();
    for (const address of wanted) {
      const fresh = this.prices.get(address);
      const value = fresh !== undefined ? fresh : this.staleOf(address);
      if (value) out.set(address, value);
    }
    return out;
  }

  /** GeckoTerminal image URLs (null = none) for lower-case mainnet addresses. */
  async imageMap(addresses: readonly string[]): Promise<Map<string, string | null>> {
    const wanted = [...new Set(addresses.map((a) => a.toLowerCase()))];
    const missing = wanted.filter((a) => this.images.get(a) === undefined);
    if (missing.length > 0 && Date.now() >= this.pausedUntil) {
      for (const batch of chunks(missing, GECKOTERMINAL_BATCH)) {
        try {
          const res = await fetchJson("geckoterminal", `${GECKOTERMINAL_TOKENS_MULTI_URL}/${batch.join(",")}`);
          const parsed = multiSchema.parse(res?.json);
          const found = new Map(parsed.data.map((d) => [d.attributes.address.toLowerCase(), d.attributes.image_url]));
          for (const address of batch) {
            const url = found.get(address);
            this.images.set(address, url && !MISSING_IMAGE.test(url) ? url : null, IMAGE_TTL_MS);
          }
        } catch (error) {
          this.onError(error, "image");
          break;
        }
      }
    }
    return new Map(wanted.map((a) => [a, this.images.get(a) ?? null]));
  }

  private async fetchPrices(batch: readonly string[]): Promise<void> {
    const url = `${GECKOTERMINAL_TOKEN_PRICE_URL}/${batch.join(",")}?include_24hr_price_change=true`;
    const res = await fetchJson("geckoterminal", url);
    const { token_prices: prices, h24_price_change_percentage: changes } = priceSchema.parse(res?.json).data.attributes;
    for (const address of batch) {
      const price = decimalToUnits(prices[address] ?? undefined, PRICE_DECIMALS);
      const change = percentToBps(changes?.[address] ?? undefined);
      this.prices.set(
        address,
        price !== undefined && price > 0n
          ? {
              priceUsd18: price,
              change24hBps: change === undefined ? null : Number(change),
              source: "geckoterminal" as const,
            }
          : null,
        PRICE_TTL_MS,
      );
    }
  }

  private staleOf(address: string): TokenPrice | undefined {
    const stale = this.prices.peek(address);
    return stale && stale.ageMs < PRICE_STALE_MAX_MS && stale.value ? stale.value : undefined;
  }

  private onError(error: unknown, what: string): void {
    if (isRateLimited(error)) this.pausedUntil = Date.now() + GECKO_BACKOFF_MS;
    this.log.warn({ err: errorText(error) }, `geckoterminal ${what} lookup failed`);
  }
}
