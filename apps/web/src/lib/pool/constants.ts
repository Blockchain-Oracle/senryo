/** Pool quick picks (flow book D1 step 2: $10 / $25 / $50 / Max), in whole money units. */
import { ONE_USD6 } from "@senryo/core";

export const LP_DEPOSIT_CHIPS = [10n, 25n, 50n] as const;
/** Redeem shares of the user's sLP, in bps (D2 step 1: 25 / 50 / 100 %). */
export const LP_REDEEM_STEPS_BPS = [2_500n, 5_000n, 10_000n] as const;
/** The UI floor (flow book D1 decision): a $1 / P$1 minimum, so dust can't mint unredeemable shares. */
export const LP_MIN_DEPOSIT_USD6 = ONE_USD6;
