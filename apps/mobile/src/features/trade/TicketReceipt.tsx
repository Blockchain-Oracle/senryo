import { explorerTxUrl, NETWORKS } from "@senryo/config";
import { DECIMALS, formatUnits } from "@senryo/core";
import type { TraceEvent } from "@senryo/query";
import { CircleCheck } from "lucide-react-native";
import { useState } from "react";
import { Linking, Share, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { KeyValue } from "~/components/kit/Surface";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { shortAddress } from "~/lib/format";
import { price18, priceDecimalsOf, usd } from "~/lib/money";
import type { NetworkKey } from "~/lib/network";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { QUANTITY_DECIMALS } from "./constants";
import type { Side } from "./useTicket";

/** What the order was at the moment of the hold — the receipt carries its own mode, never the app's current one. */
export interface SubmittedOrder {
  network: NetworkKey;
  chainId: number;
  marketId: number;
  symbol: string;
  side: Side;
  leverage: number;
  marginUsd6: bigint;
  notionalUsd6: bigint;
  execPrice18: bigint;
  feeUsd6: bigint;
  sizeDelta: bigint;
}

/**
 * The receipt (inventory #21; D-114/D-163): shown only once the trace reached **finalized** — never on a submit or a
 * vote. Quoted values are labelled as quoted at the hold; the transaction links to the network's explorer. Share
 * opens a compact preview (inventory #22) before the native share sheet; amounts are opt-in, no identity is attached.
 * The completed-outcome claim stays Blocked B1 until our own finalized lifecycles are recorded in acceptance.md.
 */
export function TicketReceipt({
  order,
  events,
  onDone,
  onViewPosition,
  onShare,
}: {
  order: SubmittedOrder;
  events: readonly TraceEvent[];
  onDone: () => void;
  onViewPosition: () => void;
  onShare: () => void;
}) {
  const { color } = useTheme();
  const network = NETWORKS[order.network];
  const practice = order.network === "testnet";
  const tone = practice ? color.practice : color.mainnet;
  const hash = events.find((e) => e.hash)?.hash;
  const finalizedAt = events.find((e) => e.stage === "finalized")?.at;
  const decimals = priceDecimalsOf(order.marketId);
  const side = order.side === "long" ? "Long" : "Short";
  const money = (v: bigint) => usd(v, DECIMALS.cents, order.network);
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <CircleCheck size={SIZE.avatarSm} strokeWidth={SIZE.iconStroke} color={color.up} />
        <Text accessibilityRole="header" style={[TYPE.sheetTitle, { color: color.ink }]}>
          {side} {order.symbol} opened
        </Text>
        <Text style={[TYPE.meta, { color: tone }]}>
          {practice ? "Practice · Paper money" : "Mainnet · Real money"} · {network.name} · Finalized
          {finalizedAt ? ` ${new Date(finalizedAt).toLocaleTimeString()}` : ""}
        </Text>
      </View>
      <View style={[styles.card, { borderColor: color.border, backgroundColor: color.card }]}>
        <KeyValue label="Margin" value={money(order.marginUsd6)} />
        <KeyValue label="Leverage" value={`${order.leverage}×`} />
        <KeyValue label="Exposure" value={money(order.notionalUsd6)} />
        <KeyValue
          label="Quantity (quoted)"
          value={`${formatUnits(order.sizeDelta, DECIMALS.e18, QUANTITY_DECIMALS)} ${order.symbol}`}
        />
        <KeyValue label="Fill price (quoted)" value={`$${price18(order.execPrice18, decimals)}`} />
        <KeyValue label="Fee (quoted)" value={money(order.feeUsd6)} />
        {hash ? <KeyValue label="Transaction" value={shortAddress(hash)} /> : null}
      </View>
      <Text style={[TYPE.meta, { color: color.text3 }]}>Quoted at your hold; the position shows the filled entry.</Text>
      {hash ? (
        <Button
          label="View on explorer"
          variant="ghost"
          size="sm"
          onPress={() =>
            void Linking.openURL(explorerTxUrl(order.chainId as Parameters<typeof explorerTxUrl>[0], hash))
          }
        />
      ) : null}
      <View style={styles.actions}>
        <Button label="Share" variant="outline" style={styles.flex} onPress={onShare} />
        <Button label="View position" variant="secondary" style={styles.flex} onPress={onViewPosition} />
      </View>
      <Button label="Done" onPress={onDone} />
    </View>
  );
}

/** The share preview (inventory #22): a compact child over the ticket, then the native share sheet. */
export function SharePreview({
  open,
  onClose,
  order,
  hash,
}: {
  open: boolean;
  onClose: () => void;
  order: SubmittedOrder;
  hash: `0x${string}` | undefined;
}) {
  const { color } = useTheme();
  const [amounts, setAmounts] = useState(false);
  const [status, setStatus] = useState<"ready" | "shared" | "cancelled">("ready");
  const practice = order.network === "testnet";
  const side = order.side === "long" ? "long" : "short";
  const lines = [
    `Opened a ${order.leverage}× ${side} on ${order.symbol} with Senryo (${practice ? "practice, paper money" : "real money"}).`,
    ...(amounts
      ? [
          `Margin ${usd(order.marginUsd6, DECIMALS.cents, order.network)} · exposure ${usd(order.notionalUsd6, DECIMALS.cents, order.network)}`,
        ]
      : []),
    ...(hash ? [explorerTxUrl(order.chainId as Parameters<typeof explorerTxUrl>[0], hash)] : []),
  ];
  const message = lines.join("\n");
  return (
    <ChildSheet open={open} onClose={onClose} title="Share">
      <View style={[styles.preview, { borderColor: color.border, backgroundColor: color.card }]}>
        <Text style={[TYPE.rowStrong, { color: color.ink }]}>{lines[0]}</Text>
        {lines.slice(1).map((l) => (
          <Text key={l} style={[TYPE.meta, { color: color.text2 }]} numberOfLines={2}>
            {l}
          </Text>
        ))}
      </View>
      <View style={[styles.option, { borderColor: color.border }]}>
        <Text style={[TYPE.row, { color: color.ink }]}>Include margin and exposure</Text>
        <Switch value={amounts} onValueChange={setAmounts} accessibilityLabel="Include margin and exposure" />
      </View>
      {status !== "ready" ? (
        <Text style={[TYPE.meta, { color: color.text3 }]}>{status === "shared" ? "Shared." : "Not shared."}</Text>
      ) : null}
      <Button
        label="Share"
        onPress={() =>
          void Share.share({ message })
            .then((r) => setStatus(r.action === Share.sharedAction ? "shared" : "cancelled"))
            .catch(() => setStatus("cancelled"))
        }
      />
    </ChildSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: SIZE.gutter, gap: SPACE.md },
  head: { alignItems: "center", gap: SPACE.xs, paddingVertical: SPACE.md },
  card: { padding: SPACE.md, borderRadius: RADIUS.md, borderWidth: HAIRLINE_PX },
  actions: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  preview: { padding: SPACE.md, gap: SPACE.xs, borderRadius: RADIUS.md, borderWidth: HAIRLINE_PX },
  option: {
    minHeight: SIZE.touch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: HAIRLINE_PX,
  },
});
