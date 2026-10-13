/**
 * The R6 gate's scripted queries against the real catalogue and copy: each names the entry it must rank first. Run
 * with `pnpm --filter @senryo/search queries`; exits 1 if any fails. (Ranking only — the apps draw what this returns.)
 */
import { GAMES, helpOn, MARKETS, WEB_EVERYTHING, WEB_PLACES } from "@senryo/config";
import {
  actionEntries,
  createIndex,
  gameEntries,
  helpEntries,
  marketEntries,
  pastedId,
  placeEntries,
  rank,
  SEARCH_ACTIONS,
} from "../src/index.ts";

const entries = [
  ...MARKETS.flatMap(marketEntries),
  ...gameEntries(GAMES),
  ...placeEntries([...WEB_PLACES, ...WEB_EVERYTHING.flatMap((s) => s.items)]),
  ...actionEntries(SEARCH_ACTIONS, { practice: true, hidden: false, sound: true, haptics: true, light: true }),
  ...helpEntries(helpOn("web")),
];
const index = createIndex(entries);

const CASES: readonly [string, string][] = [
  ["bitcon", "market:BTC"],
  ["btc", "market:BTC"],
  ["bitcoin", "market:BTC"],
  ["eth", "market:ETH"],
  ["etherium", "market:ETH"],
  ["tesla", "market:TSLA"],
  ["gold", "market:XAU"],
  ["nvdia", "market:NVDA"],
  ["deposit", "action:add-money"],
  ["add money", "action:add-money"],
  ["fund", "action:add-money"],
  ["btc 5m", "lane:BTC:300"],
  ["eth 1h", "lane:ETH:3600"],
  ["sol up", "up:SOL"],
  ["doge ride", "ride:DOGE"],
  ["line rider", "game:line-rider"],
  ["duel", "game:duel"],
  ["parlay", "game:parlay"],
  ["hide", "action:balances"],
  ["earn", "place:earn"],
  ["where do prices come from", "help:prices"],
  ["how it works", "place:how"],
  ["what is a ride", "help:ride"],
  ["status", "place:status"],
];

const QUERY_COLUMN = 22;
const SHOWN = 5;
const PER_GROUP = 2;
const PASTE_COLUMN = 24;
const HASH_BYTES = 32;

let failed = 0;
for (const [query, want] of CASES) {
  const sections = rank(index, query);
  const top = sections[0]?.hits[0]?.entry.id;
  const ok = top === want;
  if (!ok) failed++;
  const rest = sections
    .flatMap((s) => s.hits.slice(0, PER_GROUP).map((h) => `${h.entry.id}(${h.score.toFixed(1)})`))
    .slice(0, SHOWN);
  console.log(
    `${ok ? "ok  " : "FAIL"} ${JSON.stringify(query).padEnd(QUERY_COLUMN)} → ${top ?? "nothing"}${ok ? "" : ` (want ${want})`}  ${rest.join(" ")}`,
  );
}
const PASTES: readonly [string, string][] = [
  [`0x${"ab".repeat(HASH_BYTES)}`, "hash"],
  ["#1019", "number"],
  ["1019", "number"],
  ["N° C-10143-001019", "number"],
];
for (const [q, kind] of PASTES) {
  const p = pastedId(q);
  const ok = p?.kind === kind;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} paste ${JSON.stringify(q).slice(0, PASTE_COLUMN)} → ${JSON.stringify(p)}`);
}
console.log(failed === 0 ? "all pass" : `${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
