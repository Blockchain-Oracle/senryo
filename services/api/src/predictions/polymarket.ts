import type { BinaryPrediction, PredictionListQuery } from "@senryo/api-client";
import { PREDICTION_VENUES } from "@senryo/config";
import { z } from "zod";
import { decimalToUnits, fetchJson, nowSec, TtlCache } from "../anyasset/upstream.ts";

const PAGE_MAX = 100;
const MS_PER_SECOND = 1000;
const BPS_ONE = 10_000;
const HISTORY_CACHE_MAX = 128;
const HISTORY_POINTS_MAX = 2000;
const RULES_CHARS_MAX = 20_000;
const DETAIL_CACHE_MAX = 256;
const BPS_DECIMALS = 4;
const TITLE_CHARS_MAX = 500;
const USD_DECIMALS = 6;
const OUTCOMES_RAW_MAX = 8;

const venue = PREDICTION_VENUES.polymarket;
const CACHE_MS = 20_000;
const DAY_SEC = 86_400;
const PAGE_SIZE = 48;
const numeric = z.union([z.string(), z.number()]);
const rawMarket = z.object({
  id: z.string().regex(/^\d+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  question: z.string().max(TITLE_CHARS_MAX),
  outcomes: z.string(),
  outcomePrices: z.string().nullish(),
  clobTokenIds: z.string().nullish(),
  active: z.boolean(),
  closed: z.boolean(),
  archived: z.boolean().optional(),
  acceptingOrders: z.boolean().optional(),
  endDate: z.string(),
  eventStartTime: z.string().nullish(),
  updatedAt: z.string().nullish(),
  description: z.string().max(RULES_CHARS_MAX).optional(),
  resolutionSource: z.string().max(HISTORY_POINTS_MAX).nullish(),
  umaResolutionStatus: z.string().nullish(),
  liquidity: numeric.nullish(),
  volume: numeric.nullish(),
  cryptoMarketConfig: z.object({ asset: z.string(), duration: z.string() }).nullish(),
});
const rawEvent = z.object({ tags: z.array(z.object({ slug: z.string() })), markets: z.array(z.unknown()) });
const seconds = (text: string | null | undefined): number | null => {
  const time = text ? Date.parse(text) : Number.NaN;
  return Number.isFinite(time) && time >= 0 ? Math.floor(time / MS_PER_SECOND) : null;
};
function array(text: string | null | undefined): unknown[] {
  if (!text) return [];
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value) || value.length > OUTCOMES_RAW_MAX) throw new Error("invalid outcome array");
  return value;
}
function bps(value: unknown): number | null {
  // Strict plain decimals bound exponent work and prevent malformed provider data from becoming zero.
  if (!/^(?:0(?:\.\d{1,12})?|1(?:\.0{1,12})?)$/.test(String(value))) return null;
  const units = decimalToUnits(value, BPS_DECIMALS);
  return units === undefined || units < 0n || units > BigInt(BPS_ONE) ? null : Number(units);
}
function usd6(value: unknown): bigint | null {
  if (!/^\d{1,18}(?:\.\d{1,12})?$/.test(String(value))) return null;
  return decimalToUnits(value, USD_DECIMALS) ?? null;
}

/** Adopt only BTC/ETH price questions. Provider tags alone can also contain politics/sports. */
export function parseBinaryPrediction(value: unknown, observedAt: number): BinaryPrediction | null {
  const m = rawMarket.parse(value);
  const match =
    /^(Bitcoin|Ethereum) (?:Up or Down|above |below |price )/.exec(m.question) ??
    /^Will (?:the price of )?(Bitcoin|Ethereum) (?:be |reach |dip |hit )/.exec(m.question);
  const asset = match?.[1] === "Bitcoin" ? "BTC" : match?.[1] === "Ethereum" ? "ETH" : undefined;
  if (!asset || m.archived) return null;
  const labels = array(m.outcomes);
  if (
    labels.length !== 2 ||
    !((labels[0] === "Up" && labels[1] === "Down") || (labels[0] === "Yes" && labels[1] === "No"))
  )
    return null;
  const prices = array(m.outcomePrices),
    tokens = array(m.clobTokenIds);
  const closesAt = seconds(m.endDate);
  if (closesAt === null) throw new Error("invalid prediction deadline");
  const opensAt = seconds(m.eventStartTime);
  const status =
    m.umaResolutionStatus === "disputed"
      ? "disputed"
      : m.closed && m.umaResolutionStatus === "resolved"
        ? "resolved"
        : m.closed
          ? "closed"
          : closesAt <= observedAt
            ? "resolving"
            : opensAt !== null && opensAt > observedAt
              ? "upcoming"
              : m.active && m.acceptingOrders
                ? "open"
                : "closed";
  const outcomes = labels.map((label, i) => ({
    label: label as BinaryPrediction["outcomes"][number]["label"],
    priceBps: bps(prices[i]),
    tokenId: typeof tokens[i] === "string" && /^\d{1,80}$/.test(tokens[i]) ? tokens[i] : null,
  }));
  const winner =
    status === "resolved" &&
    outcomes.filter((o) => o.priceBps === BPS_ONE).length === 1 &&
    outcomes.some((o) => o.priceBps === 0)
      ? (outcomes.find((o) => o.priceBps === BPS_ONE)?.label ?? null)
      : null;
  const duration = m.cryptoMarketConfig?.duration;
  return {
    kind: "binary",
    provider: "polymarket",
    settlementNetwork: "Polygon",
    execution: "view-only",
    id: m.id,
    title: m.question,
    asset,
    status,
    closesAt,
    opensAt,
    observedAt,
    sourceUpdatedAt: seconds(m.updatedAt),
    sourceUrl: `${venue.web}/event/${m.slug}`,
    window: duration === "5m" || duration === "15m" ? duration : null,
    outcomes,
    winner,
    rules: m.description ?? "The provider has not supplied resolution rules.",
    resolutionSource: m.resolutionSource ?? null,
    liquidityUsd6: usd6(m.liquidity),
    volumeUsd6: usd6(m.volume),
  };
}

export class PolymarketDiscovery {
  private readonly cache = new TtlCache<{ markets: BinaryPrediction[]; observedAt: number; limited: boolean }>(
    PAGE_SIZE,
  );
  private readonly details = new TtlCache<BinaryPrediction | null>(DETAIL_CACHE_MAX);
  private readonly histories = new TtlCache<{
    observedAt: number;
    points: { t: number; priceBps: number; resolutionSec: number }[];
  }>(HISTORY_CACHE_MAX);

  async list(query: PredictionListQuery) {
    const key = `${query.asset}:${query.window}:${query.state}`;
    return this.cache.load(key, CACHE_MS, async () => {
      const at = nowSec();
      const assets = query.asset === "all" ? (["BTC", "ETH"] as const) : [query.asset];
      const pages = await Promise.all(
        assets.map(async (asset) => {
          const url = new URL(`${venue.gamma}/events/keyset`);
          url.search = new URLSearchParams({
            tag_id: venue.tags[asset],
            limit: String(PAGE_SIZE),
            closed: String(query.state === "recent"),
            order: "endDate",
            ascending: String(query.state === "open"),
            ...(query.window === "price-events" ? { exclude_tag_id: "102127" } : {}),
            ...(query.state === "open"
              ? { end_date_min: new Date(at * MS_PER_SECOND).toISOString() }
              : {
                  end_date_max: new Date(at * MS_PER_SECOND).toISOString(),
                  end_date_min: new Date((at - DAY_SEC) * MS_PER_SECOND).toISOString(),
                }),
          }).toString();
          const result = await fetchJson("Polymarket", url.toString());
          const page = z.object({ events: z.array(rawEvent).max(PAGE_SIZE) }).parse(result?.json);
          const items = page.events.flatMap((e) => {
            if (!e.tags.some((t) => t.slug === "crypto-prices") || e.tags.some((t) => t.slug === "sports")) return [];
            return e.markets.flatMap((raw) => {
              const market = parseBinaryPrediction(raw, at);
              if (
                !market ||
                market.asset !== asset ||
                (query.window === "price-events" ? market.outcomes[0]?.label !== "Yes" : market.window !== query.window)
              )
                return [];
              if (
                query.state === "open" &&
                (market.closesAt <= at || market.status === "closed" || market.status === "resolved")
              )
                return [];
              this.details.set(market.id, market, CACHE_MS);
              return [market];
            });
          });
          return items.slice(0, query.asset === "all" ? PAGE_MAX / assets.length : PAGE_MAX);
        }),
      );
      const markets = [...new Map(pages.flat().map((m) => [m.id, m])).values()]
        .sort((a, b) => (query.state === "open" ? a.closesAt - b.closesAt : b.closesAt - a.closesAt))
        .slice(0, PAGE_MAX);
      return { markets, observedAt: at, limited: true };
    });
  }

  detail(id: string) {
    return this.details.load(id, CACHE_MS, async () => {
      const response = await fetchJson("Polymarket", `${venue.gamma}/markets/${id}`, { notFoundAsNull: true });
      if (!response) return null;
      const market = parseBinaryPrediction(response.json, nowSec());
      // Match the narrow discovery scope on arbitrary deep links too.
      return market && (market.window !== null || market.outcomes[0]?.label === "Yes") && market.id === id
        ? market
        : null;
    });
  }

  async history(id: string, outcome: number) {
    const market = await this.detail(id);
    if (!market) return null;
    const token = market.outcomes[outcome]?.tokenId;
    if (!token) throw new Error("outcome history unavailable");
    return this.histories.load(`${id}:${token}`, CACHE_MS, async () => {
      const at = nowSec();
      const end = Math.min(at, market.closesAt);
      const start = market.opensAt ?? end - DAY_SEC;
      if (end <= start) return { observedAt: at, points: [] };
      const url = new URL(`${venue.data}/v2/prices-history`);
      url.search = new URLSearchParams({
        token_id: token,
        start: String(Math.max(start, end - DAY_SEC)),
        end: String(end),
        bucket_seconds: "60",
      }).toString();
      const result = await fetchJson("Polymarket", url.toString());
      const raw = z
        .object({
          data: z
            .array(
              z.object({ timestamp: z.int().nonnegative(), price: numeric, resolution_seconds: z.int().nonnegative() }),
            )
            .max(HISTORY_POINTS_MAX),
          pagination: z.object({ has_more: z.boolean() }),
        })
        .parse(result?.json);
      if (raw.pagination.has_more) throw new Error("history exceeds bounded event window");
      const points = new Map<number, { t: number; priceBps: number; resolutionSec: number }>();
      for (const p of raw.data) {
        const priceBps = bps(p.price);
        if (priceBps === null) throw new Error("invalid history price");
        if (p.timestamp >= Math.max(start, end - DAY_SEC) && p.timestamp < end)
          points.set(p.timestamp, { t: p.timestamp, priceBps, resolutionSec: p.resolution_seconds });
      }
      return { observedAt: at, points: [...points.values()].sort((a, b) => a.t - b.t).slice(-HISTORY_POINTS_MAX) };
    });
  }
}
