/**
 * Ranking (R6.2) on MiniSearch (lucaong/minisearch 7.2, read through Context7): the symbol field weighs most, then the
 * title, the hidden keywords and the second line; every term is a prefix, and longer terms forgive typos ("bitcon"
 * finds Bitcoin, "etherium" Ethereum). A ticker typed exactly multiplies its entry; frecency from the device's visits
 * lifts habits. All words must match first; only when nothing does are hits for any word shown. Hits come back grouped,
 * the groups ordered by their best hit, so the top hit leads whatever its kind.
 */
import MiniSearch, { type SearchResult } from "minisearch";
import { GROUP_LABEL, SEARCH_GROUPS, type SearchEntry, type SearchGroup, type SearchSection } from "./types.ts";
import { visitBoost } from "./visits.ts";

const FIELD_BOOST = { symbol: 5, title: 3, keywords: 1.5, subtitle: 0.6 } as const;
const FIELDS = Object.keys(FIELD_BOOST);
/** Exact matches weigh 1; a prefix and a typo weigh less, so "eth" ranks ETH over Ethena. */
const MATCH_WEIGHTS = { prefix: 0.7, fuzzy: 0.35 } as const;
/** Terms this long forgive one typo; from `TWO_TYPOS_FROM`, two. */
const ONE_TYPO_FROM = 4;
const TWO_TYPOS_FROM = 8;
/** A ticker typed exactly (the whole query). */
const EXACT_SYMBOL = 3;
/** The group's own weight: what's yours and what's pasted leads; help answers trail a page of the same words. */
const GROUP_WEIGHT: Record<SearchGroup, number> = {
  receipts: 2,
  positions: 1.4,
  markets: 1.2,
  lanes: 1.1,
  events: 1,
  games: 1,
  places: 1,
  actions: 1,
  help: 0.7,
};
/** The most hits a group shows for a query. */
export const GROUP_CAP: Record<SearchGroup, number> = {
  receipts: 6,
  positions: 6,
  markets: 8,
  lanes: 4,
  events: 6,
  games: 6,
  places: 6,
  actions: 6,
  help: 4,
};

/** Lower case without accents: "Société" finds "societe". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const SPLIT = /[\s\p{P}\p{S}]+/u;

export function queryTerms(query: string): string[] {
  return normalize(query)
    .split(SPLIT)
    .filter((t) => t.length > 0);
}

/** Words that carry nothing in a longer query ("how do prices work" searches "prices work"). */
const STOP = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "do",
  "does",
  "of",
  "to",
  "in",
  "on",
  "my",
  "i",
  "me",
  "what",
  "how",
  "where",
  "who",
  "why",
  "can",
  "it",
]);

/** A query worded as a question ("what is a ride") wants an answer: help weighs this much more. */
const QUESTION_WORDS = new Set(["what", "how", "why", "where", "who", "when", "is", "can", "does", "do"]);
const QUESTION_BOOST = 3;

/** The words searched: the query without its filler, unless filler is all it is. */
function meaningful(terms: readonly string[]): string[] {
  const kept = terms.filter((t) => !STOP.has(t));
  return kept.length > 0 ? kept : [...terms];
}

export interface SearchIndex {
  mini: MiniSearch<SearchEntry>;
  byId: ReadonlyMap<string, SearchEntry>;
}

/** One index over the entries (a repeated id keeps its first entry). Rebuilt when the set changes — a few hundred. */
export function createIndex(entries: readonly SearchEntry[]): SearchIndex {
  const byId = new Map<string, SearchEntry>();
  for (const e of entries) if (!byId.has(e.id)) byId.set(e.id, e);
  const mini = new MiniSearch<SearchEntry>({
    fields: FIELDS,
    extractField: (doc, field) => {
      if (field === "id") return doc.id;
      if (field === "keywords") return doc.keywords?.join(" ") ?? "";
      const v = doc[field as "symbol" | "title" | "subtitle"];
      return typeof v === "string" ? v : "";
    },
    tokenize: (text) => text.split(SPLIT),
    processTerm: (term) => (term.length > 0 ? normalize(term) : null),
  });
  mini.addAll([...byId.values()]);
  return { mini, byId };
}

export interface RankOptions {
  /** An extra multiplier per entry (a starred market, a position about to end). */
  boost?: (entry: SearchEntry) => number;
  /** Keep only some groups (the market picker searches markets alone). */
  groups?: readonly SearchGroup[];
  /** Every hit, not a group's first few (the picker lists them all). */
  uncapped?: boolean;
  now?: number;
}

function run(
  index: SearchIndex,
  terms: readonly string[],
  combineWith: "AND" | "OR",
  o: RankOptions & { question: boolean },
): SearchResult[] {
  const exact = terms.join(" ");
  const allowed = o.groups ? new Set(o.groups) : null;
  return index.mini.search(terms.join(" "), {
    boost: FIELD_BOOST,
    weights: MATCH_WEIGHTS,
    // Only the word being typed is a prefix; the words before it are whole ("do" doesn't find DOGE mid-sentence).
    prefix: (_term, i, all) => i === all.length - 1,
    fuzzy: (term) => (term.length >= TWO_TYPOS_FROM ? 2 : term.length >= ONE_TYPO_FROM ? 1 : false),
    combineWith,
    filter: (r) => {
      const e = index.byId.get(String(r.id));
      return e !== undefined && (allowed === null || allowed.has(e.group));
    },
    boostDocument: (id) => {
      const e = index.byId.get(String(id));
      if (!e) return 1;
      const symbol = e.symbol !== undefined && normalize(e.symbol) === exact ? EXACT_SYMBOL : 1;
      const asked = o.question && e.group === "help" ? QUESTION_BOOST : 1;
      return GROUP_WEIGHT[e.group] * symbol * asked * visitBoost(e.id, o.now) * (o.boost?.(e) ?? 1);
    },
  });
}

/**
 * The query's hits: the top hit on its own, then the groups by their best remaining hit. A hidden entry (a lane)
 * needs more than one word, every one of them matching: "btc 5m" shows BTC's 5-minute lane, "btc" alone doesn't.
 */
export function rank(index: SearchIndex, query: string, o: RankOptions = {}): SearchSection[] {
  const typed = queryTerms(query);
  const terms = meaningful(typed);
  if (terms.length === 0) return [];
  const question = typed.length > 1 && QUESTION_WORDS.has(typed[0] ?? "");
  let results = run(index, terms, "AND", { ...o, question });
  const all = results.length > 0;
  if (!all) results = run(index, terms, "OR", { ...o, question });
  const groups = new Map<SearchGroup, SearchSection>();
  for (const r of results) {
    const entry = index.byId.get(String(r.id));
    if (!entry || (entry.hidden && (!all || terms.length < 2))) continue;
    const section = groups.get(entry.group) ?? { key: entry.group, label: GROUP_LABEL[entry.group], hits: [] };
    if (o.uncapped || section.hits.length < GROUP_CAP[entry.group]) section.hits.push({ entry, score: r.score });
    groups.set(entry.group, section);
  }
  const order = (key: string) => SEARCH_GROUPS.indexOf(key as SearchGroup);
  const byBest = (a: SearchSection, b: SearchSection) => {
    const best = (b.hits[0]?.score ?? 0) - (a.hits[0]?.score ?? 0);
    return best !== 0 ? best : order(a.key) - order(b.key);
  };
  const sorted = [...groups.values()].sort(byBest);
  const top = sorted[0]?.hits[0];
  if (!top || o.uncapped) return sorted;
  const rest = sorted
    .map((s) => (s.hits[0] === top ? { ...s, hits: s.hits.slice(1) } : s))
    .filter((s) => s.hits.length > 0)
    .sort(byBest);
  return [{ key: "top", label: "Top hit", hits: [top] }, ...rest];
}

/** Each entry's score for the query (the picker sorts its kind groups by it); empty when nothing matches. */
export function scores(index: SearchIndex, query: string, o: RankOptions = {}): Map<string, number> {
  const out = new Map<string, number>();
  for (const section of rank(index, query, { ...o, uncapped: true }))
    for (const h of section.hits) out.set(h.entry.id, h.score);
  return out;
}
