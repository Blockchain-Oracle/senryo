import assert from "node:assert/strict";
import {
  decodeSetupRecord,
  modernSetupAccount,
  nextSetupStep,
  RETIRED_STEPS,
  type SetupStep,
} from "../../../apps/mobile/src/features/setup/setup-order.ts";

function walkthrough(expected: readonly SetupStep[], modern: boolean) {
  let pending: SetupStep | undefined = "handle";
  for (let i = 0; i < expected.length; i++) {
    const step = expected[i];
    assert.ok(step);
    assert.equal(pending, step);
    pending = nextSetupStep(pending, step, modern);
    assert.equal(pending, expected[i + 1]);
    assert.equal(nextSetupStep(pending, step, modern), pending, "duplicate callback must not advance twice");
  }
  assert.equal(
    nextSetupStep(pending, "handle", modern),
    undefined,
    "finished accounts cannot restart from a late callback",
  );
}
walkthrough(["handle", "terms", "dollars", "first-call", "one-tap", "notifications", "face-id"], true);
walkthrough(["handle", "dollars", "first-call", "one-tap", "notifications", "face-id", "terms"], false);
// Steps an older build stored resume at what replaced them, never at a dead route.
assert.equal(RETIRED_STEPS.follow, "dollars");
assert.equal(RETIRED_STEPS.money, "dollars");
assert.equal(RETIRED_STEPS.done, "face-id");
assert.equal(
  nextSetupStep("notifications", "terms", true),
  "notifications",
  "a stale terms callback cannot skip a permission step",
);
const raw = JSON.stringify({ "0xabc": true, "0xdef": false });
assert.equal(modernSetupAccount(raw, "0xABC"), true);
assert.equal(modernSetupAccount(raw, "0xdef"), false);
assert.equal(modernSetupAccount(raw, "0xother"), false);
assert.deepEqual(decodeSetupRecord('{"0xa":"face-id","0xb":"finished","bad":null}'), {
  "0xa": "face-id",
  "0xb": "finished",
});
for (const malformed of [undefined, "null", "[]", "42", "{bad"]) {
  assert.deepEqual(decodeSetupRecord(malformed), {});
  assert.equal(modernSetupAccount(malformed, "0xabc"), false);
}
console.log(
  "Setup migration checks passed: new and legacy order, retired steps, account isolation, duplicate/stale callbacks, completion and malformed storage.",
);
