/**
 * A wallet movement as an Activity row (B12, D8; activity-feed.ts has the merge): "Received 20.00 USDC", "Sent 0.5000
 * MON to 0x12ab…cdef", "Swapped 10.00 USDC → 0.1200 MON" — the api folded the transaction; this gives it the feed's
 * words, marks and figure. Marks follow the token by address: a verified token gets its own mark (AUSD and USDC their
 * collateral art), an unverified one only its address's monogram, never the art of the symbol it copies. Movements
 * with Senryo's own contracts (`internal`), spam (B14) and tokens the user hid stay out of the feed. Rows are silent:
 * the arrival moment belongs to Receive, never to a row.
 */
import type { WalletActivityItem, WalletLeg } from "@senryo/api-client";
import { ids } from "@senryo/identity";
import { type FeedFormat, type FeedItem, type FeedMark, symbolMark } from "./activity-feed.ts";

const MS_PER_SECOND = 1000;

function markOf(chainId: number, leg: WalletLeg): FeedMark {
  const { token } = leg;
  if (token.native) return { id: ids.native(chainId, token.symbol), label: token.symbol };
  if (!token.verified) return { id: ids.token(chainId, token.address), label: token.symbol };
  return symbolMark(chainId, token.symbol, token.address);
}

/** " + 1 more" when a transaction moved more than one token in the row's direction. */
function more(legs: readonly WalletLeg[], direction: WalletLeg["direction"]): string {
  const extra = legs.filter((l) => l.direction === direction).length - 1;
  return extra > 0 ? ` + ${extra} more` : "";
}

function titleOf(
  item: WalletActivityItem,
  sent: WalletLeg | undefined,
  got: WalletLeg | undefined,
  format: FeedFormat,
): string {
  const amountOf = (leg: WalletLeg) => format.tokenAmount(leg.amount, leg.token.decimals, leg.token.symbol);
  if (item.kind === "swap" && sent && got) return `Swapped ${amountOf(sent)} → ${amountOf(got)}`;
  if (item.kind === "received" && got) return `Received ${amountOf(got)}${more(item.legs, "in")}`;
  if (!sent) return "Transaction";
  const to = sent.counterparty ? ` to ${format.shortAddress(sent.counterparty)}` : "";
  return `Sent ${amountOf(sent)}${to}${more(item.legs, "out")}`;
}

export function walletItem(item: WalletActivityItem, chainId: number, format: FeedFormat): FeedItem {
  const sent = item.legs.find((l) => l.direction === "out");
  const got = item.legs.find((l) => l.direction === "in");
  const amountOf = (leg: WalletLeg) => format.tokenAmount(leg.amount, leg.token.decimals, leg.token.symbol);
  return {
    id: `wallet:${item.txHash}`,
    at: item.timestamp * MS_PER_SECOND,
    group: "money",
    title: titleOf(item, sent, got, format),
    marks: [sent, got].flatMap((leg) => (leg ? [markOf(chainId, leg)] : [])),
    figure: got
      ? { text: `+${amountOf(got)}`, tone: "up" }
      : sent
        ? { text: `−${amountOf(sent)}`, tone: "plain" }
        : undefined,
    status: "done",
    hashes: [item.txHash.toLowerCase()],
    source: { kind: "wallet", item },
  };
}

/** Whether a wallet item belongs in the feed: not Senryo's own story, not spam, not only hidden tokens. */
export function walletShown(item: WalletActivityItem, hidden: (address: string) => boolean): boolean {
  if (item.internal || item.spam) return false;
  return !item.legs.every((l) => hidden(l.token.address));
}

/** The receipt's facts for a wallet item: each token that moved, then who it went to or came from. */
export function walletReceiptLines(
  item: WalletActivityItem,
  format: FeedFormat,
): Array<{ label: string; value: string }> {
  const lines = item.legs.map((leg) => ({
    label: leg.direction === "in" ? "Received" : item.kind === "swap" ? "Paid" : "Sent",
    value: `${format.tokenAmount(leg.amount, leg.token.decimals, leg.token.symbol)}${leg.token.verified ? "" : " · Unverified"}`,
  }));
  const counterparty = item.legs.find((l) => l.counterparty !== null)?.counterparty;
  if (counterparty) {
    const label = item.kind === "swap" ? "Via" : item.kind === "received" ? "From" : "To";
    lines.push({ label, value: format.shortAddress(counterparty) });
  }
  return lines;
}
