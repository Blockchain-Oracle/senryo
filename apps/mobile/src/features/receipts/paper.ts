/**
 * The paper a receipt is drawn on (D-349): in the app it follows the theme — dark paper on a dark phone — and when it is
 * drawn for sharing it is the white slip with its QR. Every paper object (the slip, the pending paper, the compact
 * trade) takes its colours from here.
 */
import { RECEIPT, RECEIPT_DARK, useTheme } from "~/theme";

export type Paper = typeof RECEIPT | typeof RECEIPT_DARK;

export function usePaper(exporting = false): Paper {
  const { name } = useTheme();
  return exporting || name === "light" ? RECEIPT : RECEIPT_DARK;
}
