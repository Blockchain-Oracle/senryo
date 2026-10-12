/** Mitoshi's fly ease (`fly-to-target.ts`): a slow lift, then a quick drop into the socket. */
export const FLY_CURVE = [0.74, 0.18, 0.93, 0.69] as const;
/** Half of one equal slot, in percent of the row: n slots put the first and last centres 50 / n % in from each side. */
export const SLOT_CENTRE_PERCENT = 50;
