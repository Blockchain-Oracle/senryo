/**
 * A pool deposit as ONE composed operation (flow book D1 steps 2–6; B0.4) lives in `@senryo/query`
 * (`pool-deposit.ts`), shared with the web; the phone words its amount in this network's money.
 */
import type { ComposedStep, MoneyOperation, QueryEnv } from "@senryo/query";
import { type PoolDeposit, poolDepositOperation as sharedOperation } from "@senryo/query";
import { usd } from "~/lib/money";

export { type PoolDeposit, poolDepositSteps } from "@senryo/query";

/** The operation the slide signs: the steps, the reviewed facts, the checks before each step, the step-up if any. */
export function poolDepositOperation(
  env: QueryEnv,
  me: `0x${string}`,
  d: PoolDeposit,
  steps: ComposedStep[],
  guard: () => void,
): MoneyOperation {
  return sharedOperation(env, me, d, steps, guard, (usd6) => usd(usd6));
}
