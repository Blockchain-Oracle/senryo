/**
 * A journal operation in one verb phrase (B12 titles): "Sent 20 AUSD to 0x12…ab", "Swapped USDC → XAUt0", "Bridged
 * USDC to Base", "Withdrew 50 USDC". The amount is the reviewed one (the receipt has the landed figure).
 */
import { formatUnits } from "@senryo/core";
import type { OperationRecord } from "@senryo/query";
import { shortAddress } from "~/lib/format";

const SHOWN_DECIMALS = 4;

function amount(intent: Record<string, string>): string {
  const raw = intent.amount;
  const decimals = Number.parseInt(intent.decimals ?? "6", 10);
  if (!raw) return "";
  try {
    const text = formatUnits(BigInt(raw), decimals, Math.min(decimals, SHOWN_DECIMALS));
    return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
  } catch {
    return "";
  }
}

export function journalTitle(record: OperationRecord): string {
  const i = record.reviewedIntent;
  const symbol = i.symbol ?? "";
  const qty = `${amount(i)} ${symbol}`.trim();
  const to = i.recipientLabel ?? (i.recipient ? shortAddress(i.recipient) : undefined);
  switch (i.kind) {
    case "send":
      return to ? `Sent ${qty} to ${to}` : `Sent ${qty}`;
    case "withdraw":
      return to ? `Withdrew ${qty} to ${to}` : `Withdrew ${qty}`;
    case "swap":
      return `Swapped ${symbol} → ${i.outSymbol ?? ""}`.trim();
    case "bridge":
      return `Bridged ${symbol} to ${i.destination ?? "another chain"}`;
    default:
      return qty ? `${record.kind} · ${qty}` : record.kind;
  }
}
