/** biome-ignore-all lint/style/noMagicNumbers: Pinned provider status codes and focused recovery fixtures. */
import assert from "node:assert/strict";
import {
  mayRetireProtection,
  PerplProtectionJournal,
  type PerplProtectionState,
  reconcileProtection,
} from "../../../packages/query/src/perpl-protection.ts";

const review = {
  account: 1,
  market: 2,
  position: 3,
  side: "long" as const,
  lots: 4n,
  triggerPNS: 100n,
  limitPNS: 99n,
  slippageBps: 50,
  source: "mark" as const,
  kind: "sl" as const,
  leverageHundredths: 1000,
  feeEstimateCNS: 100n,
  feeCeilingCNS: 110n,
};
const values = new Map<string, string>();
const storage = {
  get: (key: string) => values.get(key),
  set: (key: string, value: string) => {
    values.set(key, value);
  },
};
const terminals = [
  [4, "filled"],
  [5, "canceled"],
  [6, "expired"],
  [7, "failed"],
  [10, "executed"],
] as const;
for (const [status, state] of terminals) {
  const journal = new PerplProtectionJournal(storage, state);
  const pending = journal.prepare(review, 20);
  const observe = (prior: typeof pending, code: number, authenticated = true) =>
    reconcileProtection(prior, { authenticated, account: 1, request: pending.spec.rq, status: code });
  for (const prior of ["unknown", "pending", "open", "untriggered", "partial", "triggered"] as PerplProtectionState[]) {
    assert.equal(observe({ ...pending, state: prior }, status).state, state);
  }
  journal.save(observe(pending, status));
  const recovered = new PerplProtectionJournal(storage, state).read();
  assert.ok(recovered);
  for (const stale of [1, 2, 3, 8, 9, 999, ...terminals.map(([code]) => code)]) {
    const reconciled = observe(recovered, stale);
    assert.equal(reconciled.state, state);
    assert.equal(mayRetireProtection(reconciled), false);
    // Even a concurrent callback holding a pre-terminal intent cannot overwrite durable recovery.
    journal.save(observe(pending, stale));
    assert.equal(journal.read()?.state, state);
    assert.equal(journal.read(pending.spec.rq)?.state, state);
  }
  assert.equal(observe(recovered, 8, false).state, state);
  assert.equal(
    reconcileProtection(recovered, { authenticated: true, account: 99, request: 999, status: 8 }).state,
    state,
  );
}
console.log(
  "PASS filled/canceled/expired/failed/executed remain absorbing across stale snapshots, conflicting terminal observations, authentication mismatch and durable relaunch/concurrent save",
);
for (const [status, state] of [
  [3, "partial"],
  [9, "triggered"],
] as const) {
  const journal = new PerplProtectionJournal(storage, state);
  const pending = journal.prepare(review, 30);
  const progressed = reconcileProtection(pending, {
    authenticated: true,
    account: 1,
    request: pending.spec.rq,
    status,
  });
  for (const stale of [1, 2, 8, 999]) {
    const next = reconcileProtection(progressed, {
      authenticated: true,
      account: 1,
      request: pending.spec.rq,
      status: stale,
    });
    assert.equal(next.state, state);
    assert.equal(mayRetireProtection(next), false);
  }
  for (const [code, terminal] of terminals) {
    assert.equal(
      reconcileProtection(progressed, { authenticated: true, account: 1, request: pending.spec.rq, status: code })
        .state,
      terminal,
    );
  }
}
console.log(
  "PASS unknown/nonterminal can reach terminal; partial/triggered never regain replacement eligibility from stale active snapshots and can reach terminal",
);
