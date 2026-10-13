/**
 * The trade slip's materials and measures on the phone (D-331, the web's `receipts.css`): the paper follows the theme in
 * the app (D-349) and stays white when it is drawn for sharing, the Kinpaku stamp, and the slip's sizes.
 */
export { KINPAKU, RECEIPT, RECEIPT_DARK } from "@senryo/tokens";

export const SLIP = {
  maxWidth: 360,
  pad: 20,
  gap: 16,
  radius: 12,
  mark: 24,
  /** The stamp: an 88 pt square at −4°, a 3 pt foil ring, a lacquer field, a fine foil rule. */
  stamp: 88,
  stampRadius: 4,
  stampRing: 3,
  stampField: 4,
  stampTilt: "-4deg",
  perf: 16,
  notch: 16,
  qr: 72,
  figure: 48,
  figureLine: 52,
  label: 11,
  labelLine: 14,
  fact: 13,
  factLine: 18,
  stampWord: 15,
  stampLine: 17,
} as const;
