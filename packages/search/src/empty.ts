/**
 * With nothing typed (R6.3, Codex direction 13): the last three things this device opened (still there), your first
 * three open positions with their live value (earliest ending first, then "View all"), the three biggest 24 h moves
 * not already shown, then Go to with the places' keys. Nothing shows twice.
 */

import type { SearchIndex } from "./rank.ts";
import { GROUP_LABEL, type SearchEntry, type SearchSection } from "./types.ts";

export const RECENTS_SHOWN = 3;
export const POSITIONS_SHOWN = 3;
export const HOT_SHOWN = 3;

export interface EmptyView {
  /** Visit ids, newest first (`recentIds`). */
  recents: readonly string[];
  /** Earliest ending first. */
  positions: readonly SearchEntry[];
  hot: readonly SearchEntry[];
  places: readonly SearchEntry[];
}

export function emptySections(index: SearchIndex, v: EmptyView): SearchSection[] {
  const shown = new Set<string>();
  const take = (entries: readonly (SearchEntry | undefined)[], count: number) => {
    const out: SearchEntry[] = [];
    for (const e of entries) {
      if (!e || e.hidden || shown.has(e.id) || out.length >= count) continue;
      shown.add(e.id);
      out.push(e);
    }
    return out;
  };
  const sections: SearchSection[] = [
    {
      key: "recent",
      label: "Recent",
      entries: take(
        v.recents.map((id) => index.byId.get(id)),
        RECENTS_SHOWN,
      ),
    },
    { key: "positions", label: GROUP_LABEL.positions, entries: take(v.positions, POSITIONS_SHOWN) },
    { key: "hot", label: "Hot · 24 h", entries: take(v.hot, HOT_SHOWN) },
    { key: "places", label: GROUP_LABEL.places, entries: take(v.places, v.places.length) },
  ].map(({ entries, ...s }) => ({ ...s, hits: entries.map((entry) => ({ entry, score: 0 })) }));
  const positions = sections.find((s) => s.key === "positions");
  if (positions && v.positions.length > positions.hits.length)
    positions.more = v.positions.length - positions.hits.length;
  return sections.filter((s) => s.hits.length > 0);
}
