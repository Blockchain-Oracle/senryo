import assert from "node:assert/strict";
import { eventAmountCents } from "../src/lithic/event-amount.ts";
import { transactionEventSchema } from "../src/lithic/schemas.ts";

// Live sandbox RETURN payload: legacy -480, cardholder 0, settlement 480. It must credit $4.80, once.
const returned = transactionEventSchema.parse({
  token: "refund-check",
  type: "RETURN",
  amount: -480,
  amounts: { cardholder: { amount: 0, currency: "USD" }, settlement: { amount: 480, currency: "USD" } },
});
const REFUND_CENTS = 480n;
assert.equal(eventAmountCents(returned), REFUND_CENTS);
assert.equal(eventAmountCents({ ...returned, type: "CLEARING" }), REFUND_CENTS);
assert.equal(eventAmountCents({ token: "legacy", type: "RETURN", amount: -480 }), REFUND_CENTS);
assert.equal(
  eventAmountCents({
    ...returned,
    amounts: {
      ...returned.amounts,
      cardholder: { amount: 0, currency: "USD" },
      settlement: { amount: 0, currency: "USD" },
    },
  }),
  0n,
);
assert.throws(
  () =>
    eventAmountCents({
      ...returned,
      amounts: { cardholder: { amount: 0, currency: "USD" }, settlement: { amount: 480, currency: "EUR" } },
    }),
  /Unsupported card settlement currency/,
);
console.log("5 card settlement amount checks passed");
