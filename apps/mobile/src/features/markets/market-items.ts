/**
 * The Markets list as flat, typed rows for one FlashList (flow book C1; plan §0.9 Markets). Perps: our engine's
 * markets first (metals, then FX), then what doesn't trade here — Perpl crypto, calculated equity feeds, and crude oil
 * under Commodities with "No feed". Watchlist: what was starred, newest first, in the same grammar (engine and
 * read-only instruments mixed; C10). Tokens: the spot list in the chosen order. The chips narrow Perps and Watchlist.
 * Before the Mainnet engine deploy the engine rows stay listed with live Chainlink prices and "Soon".
 */
import {
  type DiscoveryInstrument,
  type EngineMarket,
  engineMarketsOn,
  UNPRICED_INSTRUMENTS,
  type UnpricedInstrument,
} from "@senryo/config";
import type { Reading } from "@senryo/core";
import { type DiscoveryQuote, useDiscoveryQuotes } from "@senryo/query";
import { type PrelaunchPrice, usePrelaunchPrices } from "~/features/network/usePrelaunchPrices";
import { type TokenRowData, type TokenSort, useTokenRows } from "~/features/tokens/useTokenRows";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { MARKET_FILTERS, type MarketFilter } from "./universe";
import { useWatchlist } from "./useWatchlist";

export type MarketsView = "watchlist" | "tokens" | "perps";

export type MarketItem =
  | { kind: "intro"; key: string }
  | { kind: "banner"; key: string }
  | { kind: "engine"; key: string; marketId: number }
  | { kind: "prelaunch"; key: string; marketId: number; price: PrelaunchPrice | undefined }
  | { kind: "discovery"; key: string; instrument: DiscoveryInstrument; reading: Reading<DiscoveryQuote> }
  | { kind: "unpriced"; key: string; instrument: UnpricedInstrument }
  | { kind: "token"; key: string; row: TokenRowData }
  | { kind: "empty"; key: string; text: string }
  | { kind: "credit"; key: string; text: string };

type Category = Exclude<MarketFilter, "all">;

const engineCategory = (m: Pick<EngineMarket, "category">): Category => (m.category === "metal" ? "commodities" : "fx");
const discoveryCategory = (i: DiscoveryInstrument): Category => (i.class === "crypto" ? "crypto" : "equities");
const within = (category: Category, filter: MarketFilter) => filter === "all" || filter === category;
const filterLabel = (filter: MarketFilter) => MARKET_FILTERS.find((f) => f.value === filter)?.label ?? "";

export function useMarketItems(view: MarketsView, filter: MarketFilter, tokenSort: TokenSort): MarketItem[] {
  const network = useNetwork();
  const readOnly = useReadOnlyNetwork();
  const watchlist = useWatchlist();
  const quotes = useDiscoveryQuotes();
  const prelaunch = usePrelaunchPrices();
  const tokens = useTokenRows(tokenSort);

  const engineItem = (m: EngineMarket): MarketItem =>
    readOnly
      ? {
          kind: "prelaunch",
          key: `engine:${m.symbol}`,
          marketId: m.id,
          price: prelaunch.find((p) => p.symbol === m.symbol)?.price,
        }
      : { kind: "engine", key: `engine:${m.symbol}`, marketId: m.id };
  const discoveryItem = (q: (typeof quotes)[number]): MarketItem => ({
    kind: "discovery",
    key: q.instrument.id,
    instrument: q.instrument,
    reading: q.reading,
  });
  const unpricedItem = (u: UnpricedInstrument): MarketItem => ({ kind: "unpriced", key: u.id, instrument: u });

  if (view === "tokens") {
    if (tokens.length === 0) return [{ kind: "empty", key: "empty", text: "No gainers in the last 24 hours" }];
    return [
      ...tokens.map((row): MarketItem => ({ kind: "token", key: `token:${row.token.symbol}`, row })),
      { kind: "credit", key: "credit", text: "24h change · GeckoTerminal" },
    ];
  }

  const listed = engineMarketsOn(network.chainId);
  if (view === "watchlist") {
    if (watchlist.symbols.length === 0) return [{ kind: "empty", key: "empty", text: "Star a market" }];
    const starred = watchlist.symbols.flatMap((symbol): MarketItem[] => {
      const engine = listed.find((m) => m.symbol === symbol);
      if (engine) return within(engineCategory(engine), filter) ? [engineItem(engine)] : [];
      const quote = quotes.find((q) => q.instrument.id === symbol);
      if (quote) return within(discoveryCategory(quote.instrument), filter) ? [discoveryItem(quote)] : [];
      const unpriced = UNPRICED_INSTRUMENTS.find((u) => u.id === symbol);
      return unpriced && within("commodities", filter) ? [unpricedItem(unpriced)] : [];
    });
    return starred.length > 0
      ? [{ kind: "banner", key: "banner" }, ...starred]
      : [{ kind: "empty", key: "empty", text: `Nothing starred in ${filterLabel(filter)}` }];
  }

  const metals = listed.filter((m) => m.category === "metal" && within("commodities", filter)).map(engineItem);
  const fx = listed.filter((m) => m.category === "fx" && within("fx", filter)).map(engineItem);
  const crypto = quotes.filter((q) => q.instrument.class === "crypto" && within("crypto", filter)).map(discoveryItem);
  const equities = quotes
    .filter((q) => q.instrument.class === "equity-calculated" && within("equities", filter))
    .map(discoveryItem);
  const oil = within("commodities", filter) ? UNPRICED_INSTRUMENTS.map(unpricedItem) : [];
  // In Commodities, oil sits with the metals; in All, everything that trades leads and the locked rows follow.
  const rows = filter === "commodities" ? [...metals, ...oil] : [...metals, ...fx, ...crypto, ...equities, ...oil];
  if (rows.length === 0) return [{ kind: "empty", key: "empty", text: "Nothing here yet" }];
  return [{ kind: "banner", key: "banner" }, { kind: "intro", key: "intro" }, ...rows];
}
