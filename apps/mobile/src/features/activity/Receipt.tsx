/**
 * A receipt (B12): what moved, from where to where, the route and fee when known, the steps of a composed operation,
 * each transaction (opens the explorer), when — and, for a cross-chain transfer, its live timeline. Compact rows, no
 * hero. Share sends a plain-text receipt; Explorer opens the last transaction. A row still being checked says not to
 * send it again; there is never a resend here.
 */
import { type ChainId, explorerTxUrl } from "@senryo/config";
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { OperationSummary } from "~/components/trade/OperationSummary";
import { BridgeTimeline } from "~/features/money/BridgeTimeline";
import { ReviewRow, ReviewRows } from "~/features/money/Review";
import { activityTime } from "~/features/portfolio/activity-copy";
import { tokenAmount } from "~/features/tokens/format";
import { fire } from "~/feedback/fire";
import { shortAddress } from "~/lib/format";
import { usd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";
import { FeedLead, type LogoOf, STATUS_WORDS } from "./FeedRow";
import type { FeedItem } from "./feed";

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
    if (i.fee) lines.push({ label: "Fee", value: i.fee });
  }
  lines.push({ label: "When", value: activityTime(Math.floor(item.at / MS_PER_SECOND)) });
  return lines;
}

function shareText(item: FeedItem, me: string, chainId: ChainId): string {
  const facts = receiptLines(item, me).map((l) => `${l.label}: ${l.value}`);
  const tx = item.hashes.at(-1);
  return [item.title, ...facts, ...(tx ? [explorerTxUrl(chainId, tx)] : [])].join("\n");
}

export function ReceiptBody({
  item,
  me,
  chainId,
  logoOf,
}: {
  item: FeedItem;
  me: string;
  chainId: ChainId;
  logoOf?: LogoOf | undefined;
}) {
  const { color } = useTheme();
  const record = item.source.kind === "journal" ? item.source.record : undefined;
  const intent = record?.reviewedIntent;
  const bridge = intent?.kind === "bridge" || record?.plannedActions.some((a) => /relay|cctp|across|lifi/i.test(a));
  const trackingId = intent?.trackingId ?? item.hashes.at(-1);
  const toChain = intent?.destinationChainId ? Number.parseInt(intent.destinationChainId, 10) : undefined;
  const lastHash = item.hashes.at(-1);
  return (
    <View style={styles.stack}>
      <View style={styles.head}>
        <FeedLead item={item} logoOf={logoOf} />
        {item.status === "done" ? null : (
          <Text style={[TYPE.rowDetail, { color: item.status === "failed" ? color.down : color.warn }]}>
            {item.status === "checking" ? "Checking the chain · don’t send it again" : STATUS_WORDS[item.status]}
          </Text>
        )}
      </View>
      <ReviewRows>
        {receiptLines(item, me).map((l) => (
          <ReviewRow key={l.label} label={l.label} value={l.value} />
        ))}
      </ReviewRows>
      {bridge && intent?.provider && trackingId && item.status !== "pending" ? (
        <BridgeTimeline
          tracking={{
            route: intent.provider as "relay" | "cctp" | "across" | "lifi" | "aurora",
            id: trackingId,
            fromChain: intent.direction === "in" && toChain !== undefined ? toChain : chainId,
            ...(intent.direction === "in" ? { toChain: chainId } : toChain !== undefined ? { toChain } : {}),
          }}
          sent={item.status === "done" || item.status === "partial"}
          destination={intent.destination ?? "the other chain"}
        />
      ) : null}
      {record && record.plannedActions.length > 1 ? <OperationSummary record={record} /> : null}
      {item.hashes.length > 0 ? (
        <View style={styles.hashes}>
          {item.hashes.map((hash) => (
            <Pressable
              key={hash}
              onPress={() => void Linking.openURL(explorerTxUrl(chainId, hash))}
              accessibilityRole="link"
              accessibilityLabel={`Transaction ${shortAddress(hash)} in the explorer`}
              hitSlop={SPACE.xs}
            >
              <Text style={[TYPE.meta, { color: color.link }]}>Transaction {shortAddress(hash)} ›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Share"
          variant="secondary"
          style={styles.grow}
          onPress={() => void Share.share({ message: shareText(item, me, chainId) })}
        />
        {lastHash ? (
          <Button
            label="Explorer"
            variant="secondary"
            style={styles.grow}
            onPress={() => {
              fire("press");
              void Linking.openURL(explorerTxUrl(chainId, lastHash));
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg, paddingBottom: SPACE.sm },
  head: { alignItems: "center", gap: SPACE.sm },
  hashes: { gap: SPACE.xs, alignItems: "flex-start" },
  actions: { flexDirection: "row", gap: SPACE.sm },
  grow: { flex: 1 },
});
