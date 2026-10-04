import { type FeedItem, walletReceiptLines } from "@senryo/query";
import { activityTime } from "~/features/portfolio/activity-copy";
import { tokenAmount } from "~/features/tokens/format";
import { shortAddress } from "~/lib/format";
import { usd } from "~/lib/money";
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

/** A swap's reviewed minimum ("At least 0.0025 XAUt0"). */
function minOutText(i: Record<string, string>): string | undefined {
  if (!i.minOut || !i.outSymbol || !i.outDecimals || !/^\d+$/.test(i.minOut)) return undefined;
  return tokenAmount(BigInt(i.minOut), Number.parseInt(i.outDecimals, 10), i.outSymbol);
}

interface Line {
  label: string;
  value: string;
}

/** The facts a receipt lists, in order (also the Share text). */
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
    if (row.fill && row.fill.fee > 0n) lines.push({ label: "Fee", value: usd(row.fill.fee) });
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
    else if (i.route) lines.push({ label: "Route", value: i.route });
    if (i.fee) lines.push({ label: "Fee", value: i.fee });
  }
  lines.push({ label: "When", value: activityTime(Math.floor(item.at / MS_PER_SECOND)) });
  return lines;
}
