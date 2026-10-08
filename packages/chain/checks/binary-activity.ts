import assert from "node:assert/strict";
import type { BinaryManifest } from "@senryo/config";
import type { FeedFormat } from "../../query/src/activity-feed.ts";
import { journalItem } from "../../query/src/activity-journal.ts";
import type { OperationRecord } from "../../query/src/operations.ts";
import type { BinaryFact } from "../src/binary-receipts.ts";
export function assertFailedWithdrawalActivity(
  failedFacts: BinaryFact[],
  m: BinaryManifest,
  actor: string,
  operationId: string,
) {
  const format: FeedFormat = {
    tokenAmount: (v) => String(v),
    shortAddress: (a) => a,
    activityTitle: () => "",
    activityFigure: () => undefined,
    groupOf: () => "trades",
    marketMark: () => undefined,
  };
  const record: OperationRecord = {
    version: 1,
    id: "binary-test",
    key: "binary-test",
    account: actor.toLowerCase(),
    chainId: m.chainId,
    kind: "binaryWithdraw",
    plannedActions: ["binaryWithdraw"],
    outcome: "completed",
    reviewedIntent: {
      kind: "binary",
      contract: m.contract,
      owner: actor,
      environmentId: m.environmentId,
      configHash: m.configHash,
      operationId,
    },
    steps: [{ action: "binaryWithdraw", outcome: "completed", facts: failedFacts }],
    createdAt: 0,
    updatedAt: 0,
  };
  assert.equal(journalItem(record, actor, format)?.status, "partial");
  const item = journalItem(record, actor, format);
  assert.ok(item);
  assert.match(item.title, /MON remains ready to withdraw/);
}
