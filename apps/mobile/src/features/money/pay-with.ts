/**
 * "Pay with" any asset for a dollar act (flow book C3 step 4, D1 step 2) lives in `@senryo/query` (`pay-with.ts`),
 * shared with the web; this module keeps the phone's import path.
 */
export {
  type PayAct,
  type PaySwap,
  parPaySteps,
  payIntent,
  paySwapSteps,
  paysAtPar,
  paysDirectly,
  payWithReason,
  practiceNote,
  swappableUsd6,
  usePaySwap,
} from "@senryo/query";
