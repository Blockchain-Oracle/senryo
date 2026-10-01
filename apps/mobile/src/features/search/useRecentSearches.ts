/**
 * Recent searches (Fomo F31 "Recents"): what the user opened from Search, newest first, kept on this phone per network
 * beside the watchlist (`features/markets/device-store`). A market is stored by symbol and always renders live; a
 * trader is stored by address with the name it had when opened.
 */
import { type RecentSearch, updateMarketsDevice, useMarketsDevice } from "~/features/markets/device-store";
import { useNetwork } from "~/lib/network";

/** Recents kept (a short list: this is a shortcut, not a history). */
const RECENTS_MAX = 8;

const sameTarget = (a: RecentSearch, b: RecentSearch): boolean =>
  a.kind === "market"
    ? b.kind === "market" && a.symbol === b.symbol
    : b.kind === "trader" && a.address.toLowerCase() === b.address.toLowerCase();

export function useRecentSearches(): {
  recents: readonly RecentSearch[];
  remember: (item: RecentSearch) => void;
  clear: () => void;
} {
  const network = useNetwork().key;
  const recents = useMarketsDevice(network).recents;
  return {
    recents,
    remember: (item) =>
      updateMarketsDevice(network, (slice) => ({
        ...slice,
        recents: [item, ...slice.recents.filter((r) => !sameTarget(r, item))].slice(0, RECENTS_MAX),
      })),
    clear: () => updateMarketsDevice(network, (slice) => ({ ...slice, recents: [] })),
  };
}
