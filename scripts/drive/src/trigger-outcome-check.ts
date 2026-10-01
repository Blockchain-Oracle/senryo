/**
 * TP/SL outcome check (review R01; pure logic, no chain): saving a stop loss and a take profit is two transactions,
 * and the screen must never report the last one as the whole result. This drives the same functions the app uses
 * (`traceOutcome` / `settledOutcome` in @senryo/query; `legState`, `saveInOrder`, `pendingTriggers`, `alreadyActive`
 * in the mobile trade feature) through the review's scenarios:
 *  1. stop loss finalized, take profit not sent → sl saved, tp "not-sent" (never "nothing changed" for both)
 *  2. stop loss failed → take profit is never sent and is reported as skipped, not failed
 *  3. the request can't be built (signature refused) → "not-sent"
 *  4. both finalized → both saved
 *  5. signed, then the live watch fails → "unknown", settled only by the journal (finalized / reverted / abandoned)
 *  6. relaunch with a journaled, unresolved placement → it is listed as pending for that market only, and a screen's
 *     own traces are not double-counted
 *  7. a level that is already active is never sent again
 * Run: pnpm --filter @senryo/drive trigger-outcome-check
 */
import type { JournalEntry } from "@senryo/chain";
import { settledOutcome, type TraceEvent, type TraceStage, traceOutcome } from "@senryo/query";
import {
  alreadyActive,
  legState,
  pendingTriggers,
  saveInOrder,
  type TriggerLevel,
} from "../../../apps/mobile/src/features/trade/trigger-legs.ts";
import {
  CHECK_HASH_A,
  CHECK_HASH_B,
  CHECK_HASH_C,
  CHECK_MAINNET_CHAIN_ID,
  CHECK_MARKET_ID,
  CHECK_OTHER_MARKET_ID,
  CHECK_SL_PRICE18,
  CHECK_TESTNET_CHAIN_ID,
  CHECK_TP_PRICE18,
} from "./constants.ts";

const CHAIN_ID = CHECK_TESTNET_CHAIN_ID;
const MARKET_ID = CHECK_MARKET_ID;
const OTHER_MARKET_ID = CHECK_OTHER_MARKET_ID;
const USER = "0x00000000000000000000000000000000000000aa";
const HASH_A = CHECK_HASH_A;
const HASH_B = CHECK_HASH_B;
const SL_PRICE = CHECK_SL_PRICE18;
const TP_PRICE = CHECK_TP_PRICE18;

let failures = 0;
function expect(label: string, actual: unknown, wanted: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, wanted ${JSON.stringify(wanted)}`}`,
  );
}

const events = (stages: readonly TraceStage[], hash?: `0x${string}`): TraceEvent[] =>
  stages.map((stage, at) => ({ stage, at, ...(hash && stage !== "checking" && stage !== "signing" ? { hash } : {}) }));
const trace = (stages: readonly TraceStage[], hash?: `0x${string}`) => ({
  events: events(stages, hash),
  running: false,
});

const FINALIZED = trace(["checking", "signing", "signed", "proposed", "voted", "finalized"], HASH_A);
const NOT_SENT = trace(["checking", "failed"]);
const BUILD_FAILED = trace(["failed"]);
const REVERTED = trace(["checking", "signing", "signed", "reverted"], HASH_A);
const LOST = trace(["checking", "signing", "signed", "failed"], HASH_B);

function journaled(hash: `0x${string}`, stage: JournalEntry["stage"], meta: Record<string, string>): JournalEntry {
  return {
    hash,
    chainId: CHAIN_ID,
    from: USER,
    to: USER,
    nonce: 1,
    gas: "0",
    action: "placeTrigger",
    raw: "0x",
    stage,
    createdAt: 0,
    updatedAt: 0,
    meta,
  };
}
const placement = (hash: `0x${string}`, stage: JournalEntry["stage"], marketId = MARKET_ID) =>
  journaled(hash, stage, { kind: "placeTrigger", marketId: String(marketId), leg: "tp", price: TP_PRICE.toString() });

const levels: TriggerLevel[] = [
  { kind: "tp", price18: TP_PRICE },
  { kind: "sl", price18: SL_PRICE },
];
const never = () => false;

async function main(): Promise<void> {
  // 1. sl finalized, tp not sent
  const sent1: string[] = [];
  const run1 = await saveInOrder(levels, never, async (l) => {
    sent1.push(l.kind);
    return l.kind === "sl";
  });
  expect("1 order is stop loss first", sent1, ["sl", "tp"]);
  expect("1 only the finalized level is saved", run1, { saved: ["sl"] });
  expect("1 sl leg state", legState(FINALIZED, []), "saved");
  expect("1 tp leg state", legState(NOT_SENT, []), "not-sent");

  // 2. sl failed → tp never sent, reported as skipped
  const sent2: string[] = [];
  const run2 = await saveInOrder(levels, never, async (l) => {
    sent2.push(l.kind);
    return false;
  });
  expect("2 take profit is not sent after a failed stop loss", sent2, ["sl"]);
  expect("2 take profit is skipped, not failed", run2, { saved: [], skipped: { kind: "tp", blocker: "sl" } });
  expect("2 a revert is its own state", legState(REVERTED, []), "reverted");

  // 3. build failure
  expect("3 a build failure is not-sent", traceOutcome(BUILD_FAILED.events), "not-sent");

  // 4. both finalized
  const cleared: string[] = [];
  const run4 = await saveInOrder(
    levels,
    never,
    async () => true,
    (kind) => cleared.push(kind),
  );
  expect("4 both saved", run4, { saved: ["sl", "tp"] });
  expect("4 each saved level is reported as it lands", cleared, ["sl", "tp"]);

  // 5. signed, then lost
  expect("5 signed then lost is unknown, not failed", traceOutcome(LOST.events), "unknown");
  expect(
    "5 unknown while the journal is unresolved",
    settledOutcome(LOST.events, [placement(HASH_B, "submitted")]),
    "unknown",
  );
  expect("5 unknown with no journal entry", legState(LOST, []), "unknown");
  expect("5 journal finalized settles it as saved", legState(LOST, [placement(HASH_B, "finalized")]), "saved");
  expect("5 journal reverted settles it", legState(LOST, [placement(HASH_B, "reverted")]), "reverted");
  expect("5 journal abandoned settles it as dropped", legState(LOST, [placement(HASH_B, "abandoned")]), "dropped");
  expect("5 a running leg is saving", legState({ events: LOST.events, running: true }, []), "saving");

  // 6. relaunch: an unresolved journaled placement
  const scope = { chainId: CHAIN_ID, from: USER.toUpperCase().replace("0X", "0x"), marketId: MARKET_ID };
  const journal = [
    placement(HASH_A, "submitted"),
    placement(HASH_B, "finalized"),
    placement(CHECK_HASH_C, "proposed", OTHER_MARKET_ID),
  ];
  expect(
    "6 only this market's unresolved placement is pending, with its level and price",
    pendingTriggers(journal, scope, new Set()).map((p) => [p.hash, p.action, p.leg, p.price18?.toString()]),
    [[HASH_A, "place", "tp", TP_PRICE.toString()]],
  );
  expect(
    "6 a hash this screen is already narrating is not pending",
    pendingTriggers(journal, scope, new Set([HASH_A])),
    [],
  );
  expect(
    "6 another chain's entries are ignored",
    pendingTriggers(journal, { ...scope, chainId: CHECK_MAINNET_CHAIN_ID }, new Set()),
    [],
  );

  // 7. duplicate guard
  const active = [{ takeProfit: false, triggerPrice: SL_PRICE }];
  expect("7 an identical active level is recognised", alreadyActive(active, "sl", SL_PRICE), true);
  expect("7 the other kind at that price is not", alreadyActive(active, "tp", SL_PRICE), false);
  const sent7: string[] = [];
  const run7 = await saveInOrder(
    levels,
    (l) => alreadyActive(active, l.kind, l.price18),
    async (l) => {
      sent7.push(l.kind);
      return true;
    },
  );
  expect("7 the active level is not sent again", sent7, ["tp"]);
  expect("7 and counts as saved", run7, { saved: ["sl", "tp"] });

  if (failures > 0) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("trigger-outcome-check: all passed");
}

await main();
