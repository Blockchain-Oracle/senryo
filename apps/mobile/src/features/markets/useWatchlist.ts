/**
 * The watchlist (Fomo F09's star tab, F32's favourite; direction §8 "All / Watchlist"): the markets the user starred,
 * kept per network (`device-store`) and synced to the account (`WatchlistSync`). Symbols are our engine's (`XAU`,
 * `EUR`); newest star first.
 */
import { useNetwork } from "~/lib/network";
import { touchWatchlist, updateMarketsDevice, useMarketsDevice } from "./device-store";

export interface Watchlist {
  symbols: readonly string[];
  has: (symbol: string) => boolean;
  /** Stars or unstars; returns whether the market is starred afterwards. */
  toggle: (symbol: string) => boolean;
}

export function useWatchlist(): Watchlist {
  const network = useNetwork().key;
  const symbols = useMarketsDevice(network).watchlist;
  return {
    symbols,
    has: (symbol) => symbols.includes(symbol),
    toggle: (symbol) => {
      let starred = false;
      updateMarketsDevice(network, (slice) => {
        starred = !slice.watchlist.includes(symbol);
        return {
          ...slice,
          watchlist: starred
            ? [symbol, ...slice.watchlist.filter((s) => s !== symbol)]
            : slice.watchlist.filter((s) => s !== symbol),
        };
      });
      touchWatchlist();
      return starred;
    },
  };
}
