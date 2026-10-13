/**
 * The page a broken link most likely meant (the web's 404): the link's words ranked by search's own index over the
 * markets, the games and the app's places — the ranking ⌘K uses, typos included ("/app/earnn/" → Earn, "bitcon" →
 * Bitcoin). Null when nothing comes close.
 */
import { GAMES, MARKETS } from "@senryo/config";
import {
  createIndex,
  gameEntries,
  marketEntries,
  type PlaceLike,
  placeEntries,
  rank,
  type SearchEntry,
} from "@senryo/search";

/** Path words that name no page: the app's prefix, the terminal's segment and file endings. */
const NOT_WORDS = new Set(["app", "trade", "html", "index", "www"]);
const SEPARATORS = /[/\-_.?=&#+]+/;

/** "/app/candle-hopp/" → "candle hopp". */
export function linkWords(path: string): string {
  let text = path;
  try {
    text = decodeURIComponent(path);
  } catch {
    // A malformed escape: read the link as typed.
  }
  return text
    .toLowerCase()
    .split(SEPARATORS)
    .filter((w) => w.length > 0 && !NOT_WORDS.has(w))
    .join(" ");
}

export function closestPage(path: string, places: readonly PlaceLike[]): SearchEntry | null {
  const words = linkWords(path);
  if (!words) return null;
  const index = createIndex([...MARKETS.flatMap(marketEntries), ...gameEntries(GAMES), ...placeEntries(places)]);
  return rank(index, words)[0]?.hits[0]?.entry ?? null;
}
