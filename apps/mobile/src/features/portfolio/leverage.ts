/**
 * The multiple shown beside a position's side ("Long 2.4×"). Senryo's engine is cross-margin: a position keeps no
 * margin of its own, so the multiple a ticket was sized with is stored nowhere (the indexer writes margin 0 for our
 * venue). What the account does carry is this position's exposure against the risk-adjusted balance behind it, and
 * that is what this returns — a display figure from two real numbers, to one decimal. Undefined when the balance is
 * not positive or the multiple rounds to nothing, so the row then says the side alone.
 */
const TENTHS = 10n;
const HALF = 2n;

export function effectiveLeverage(exposureUsd6: bigint, balanceUsd6: bigint): string | undefined {
  if (exposureUsd6 <= 0n || balanceUsd6 <= 0n) return undefined;
  const tenths = (exposureUsd6 * TENTHS + balanceUsd6 / HALF) / balanceUsd6;
  if (tenths === 0n) return undefined;
  const whole = tenths / TENTHS;
  const part = tenths % TENTHS;
  return part === 0n ? `${whole}×` : `${whole}.${part}×`;
}
