/**
 * A receipt (B12): what moved, from where to where, the route and fee when known, the steps of a composed operation,
 * each transaction (opens the explorer), when — and, for a cross-chain transfer, its live timeline. Compact rows, no
 * hero. Share sends a plain-text receipt; Explorer opens the last transaction. A row still being checked says not to
 * send it again; there is never a resend here.
 */

import { type ChainId, explorerTxUrl } from "@senryo/config";
import { ids } from "@senryo/identity";
import type { FeedItem } from "@senryo/query";
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { OperationSummary } from "~/components/trade/OperationSummary";
import { BridgeTimeline } from "~/features/money/BridgeTimeline";
import { ReviewRow, ReviewRows } from "~/features/money/Review";
import { fire } from "~/feedback/fire";
import { shortAddress } from "~/lib/format";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { FeedLead, type LogoOf, STATUS_WORDS } from "./FeedRow";
import { receiptLines } from "./receipt-facts";

export { receiptLines } from "./receipt-facts";

import { ReceiptSaveButton } from "./ReceiptSaveButton";
import { exportFacts, saveReceipt } from "./receipt-export";

function shareText(item: FeedItem, me: string, chainId: ChainId): string {
  const facts = exportFacts(item, me, chainId).map((l) => `${l.label}: ${l.value}`);
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
        <EntityMark id={ids.brand("senryo")} size={SIZE.avatarSm} variant="symbol" decorative />
        <FeedLead item={item} logoOf={logoOf} />
        {item.status === "done" ? null : (
          <Text style={[TYPE.rowDetail, { color: item.status === "failed" ? color.down : color.warn }]}>
            {item.status === "checking" ? "Checking the chain · don’t send it again" : STATUS_WORDS[item.status]}
          </Text>
        )}
      </View>
      <ReviewRows>
        {receiptLines(item, me).map((l, i) => (
          <ReviewRow key={`${l.label}:${i}`} label={l.label} value={l.value} />
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
      <ReceiptSaveButton save={() => saveReceipt(item, me, chainId)} />
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
