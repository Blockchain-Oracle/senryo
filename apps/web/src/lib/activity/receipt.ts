/**
 * The facts a receipt lists (flow book B12; the phone's `receiptLines`), in order — also the Share text: the amount,
 * the market or the counterparty, route and minimum for a swap, the fee, and when. A journal row reads its reviewed
 * intent; an indexed row its decoded event; a wallet row (D8) each token that moved and who it went to or came from.
 */
import { type ChainId, explorerTxUrl } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import { type FeedItem, walletReceiptLines } from "@senryo/query";
import { money } from "@/lib/format";
import { tokenAmount } from "@/lib/money/format";
import { activityTime } from "./copy";
import { FEED_FORMAT } from "./feed-format";

const MS_PER_SECOND = 1000;
const PROVIDER_NAMES: Record<string, string> = {
  monorail: "Monorail",
  kyberswap: "KyberSwap",
  relay: "Relay",
  cctp: "Circle CCTP",
  across: "Across",
  lifi: "LI.FI",
  aurora: "Aurora",
  ramp: "Ramp",
};

function minOutText(i: Record<string, string>): string | undefined {
  if (!i.minOut || !i.outSymbol || !i.outDecimals || !/^\d+$/.test(i.minOut)) return undefined;
  return tokenAmount(BigInt(i.minOut), Number.parseInt(i.outDecimals, 10), i.outSymbol);
}

export interface Line {
  label: string;
  value: string;
}

export function receiptLines(item: FeedItem, me: string): Line[] {
  const lines: Line[] = [];
  if (item.source.kind === "wallet") {
    lines.push(...walletReceiptLines(item.source.item, FEED_FORMAT));
    lines.push({ label: "When", value: activityTime(Math.floor(item.at / MS_PER_SECOND)) });
    return lines;
  }
  if (item.figure) lines.push({ label: "Amount", value: item.figure.text });
  if (item.source.kind === "indexed") {
    const row = item.source.row;
    if (row.market) lines.push({ label: "Market", value: row.market.symbol ?? row.market.id });
    const counterparty = row.move?.counterparty;
    if (counterparty) {
      const self = counterparty.toLowerCase() === me.toLowerCase();
      lines.push({ label: "To", value: self ? "Your wallet" : shortAddress(counterparty) });
    }
    if (row.fill && row.fill.fee > 0n) lines.push({ label: "Fee", value: money(row.fill.fee) });
  } else {
    const i = item.source.record.reviewedIntent;
    if (i.recipient) {
      const self = i.recipient.toLowerCase() === me.toLowerCase();
      const name = i.recipientLabel ? `${i.recipientLabel} · ` : "";
      lines.push({ label: "To", value: self ? "Your wallet" : `${name}${shortAddress(i.recipient)}` });
    }
    if (i.destination) lines.push({ label: "Network", value: i.destination });
    const atLeast = i.atLeast ?? minOutText(i);
    if (atLeast) lines.push({ label: "At least", value: atLeast });
    if (i.provider) lines.push({ label: "Route", value: PROVIDER_NAMES[i.provider] ?? i.provider });
    if (i.fee) lines.push({ label: "Fee", value: i.fee });
  }
  lines.push({ label: "When", value: activityTime(Math.floor(item.at / MS_PER_SECOND)) });
  return lines;
}

export function shareText(item: FeedItem, me: string, chainId: ChainId): string {
  const facts = receiptLines(item, me).map((l) => `${l.label}: ${l.value}`);
  const tx = item.hashes.at(-1);
  return [item.title, ...facts, ...(tx ? [explorerTxUrl(chainId, tx)] : [])].join("\n");
}
