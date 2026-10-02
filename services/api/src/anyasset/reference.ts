/**
 * Independent reference prices for the swap impact rule (plan §0.8): a token with a Chainlink feed in
 * `REFERENCE_FEEDS` (XAUt0 → XAU/USD) is valued with that feed — its description asserted, its answer no older than
 * REFERENCE_FEED_MAX_AGE_SEC — and every other token with its GeckoTerminal price; native MON is priced as WMON.
 * Mainnet only. A token with no reference returns nothing, and the quote falls back to the provider's impact.
 */
import { type Address, type ReadClient, readFeedsLatest } from "@senryo/chain";
import {
  type ChainId,
  MAINNET_CHAIN_ID,
  NATIVE_TOKEN,
  REFERENCE_FEED_MAX_AGE_SEC,
  REFERENCE_FEEDS,
  WMON,
} from "@senryo/config";
import type { Logger } from "@senryo/service-common";
import { REFERENCE_FEED_TTL_MS } from "./constants.ts";
import type { GeckoTerminal } from "./gecko.ts";
import { errorText, nowSec, TtlCache } from "./upstream.ts";

export type ReferenceSource = "xau-feed" | "geckoterminal";
export interface ReferencePrice {
  priceUsd18: bigint;
  source: ReferenceSource;
}

const PRICE_DECIMALS = 18;
const TEN = 10n;
const FEED_CACHE_MAX = 16;

export class ReferencePrices {
  private readonly feeds = new TtlCache<bigint | null>(FEED_CACHE_MAX);

  constructor(
    private readonly read: (chainId: ChainId) => ReadClient,
    private readonly gecko: GeckoTerminal,
    private readonly log: Logger,
  ) {}

  /** Reference prices keyed by lower-case token address (native MON under `address(0)`). */
  async of(tokens: readonly Address[]): Promise<Map<string, ReferencePrice>> {
    const out = new Map<string, ReferencePrice>();
    const market: string[] = [];
    await Promise.all(
      tokens.map(async (token) => {
        const lower = token.toLowerCase();
        const feed = REFERENCE_FEEDS[lower];
        if (feed) {
          const price = await this.feedPrice(feed.feed, feed.description);
          if (price !== null) out.set(lower, { priceUsd18: price, source: "xau-feed" });
          return;
        }
        market.push(lower === NATIVE_TOKEN ? WMON[MAINNET_CHAIN_ID].toLowerCase() : lower);
      }),
    );
    if (market.length > 0) {
      const prices = await this.gecko.priceMap(market);
      for (const token of tokens) {
        const lower = token.toLowerCase();
        if (out.has(lower)) continue;
        const key = lower === NATIVE_TOKEN ? WMON[MAINNET_CHAIN_ID].toLowerCase() : lower;
        const price = prices.get(key);
        if (price) out.set(lower, { priceUsd18: price.priceUsd18, source: "geckoterminal" });
      }
    }
    return out;
  }

  private feedPrice(feed: Address, description: string): Promise<bigint | null> {
    return this.feeds.load(feed.toLowerCase(), REFERENCE_FEED_TTL_MS, async () => {
      try {
        const [latest] = await readFeedsLatest(this.read(MAINNET_CHAIN_ID), [feed]);
        if (!latest || latest.description !== description || latest.latest.answer <= 0n) return null;
        if (nowSec() - latest.latest.updatedAt > REFERENCE_FEED_MAX_AGE_SEC) return null;
        return latest.latest.answer * TEN ** BigInt(PRICE_DECIMALS - latest.decimals);
      } catch (error) {
        this.log.warn({ feed, err: errorText(error) }, "reference feed read failed");
        return null;
      }
    });
  }
}
