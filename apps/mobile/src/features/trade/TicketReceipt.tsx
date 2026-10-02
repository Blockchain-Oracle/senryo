import { explorerTxUrl, NETWORKS } from "@senryo/config";
import { DECIMALS, formatUnits } from "@senryo/core";
import type { OperationRecord, TraceEvent } from "@senryo/query";
import { CircleCheck } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { Linking, Share, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { shortAddress } from "~/lib/format";
import { price18, priceDecimalsOf, usd } from "~/lib/money";
import type { NetworkKey } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
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
  /** The margin the user entered: margin × leverage = exposure, exactly as the ticket showed it. */
  marginUsd6: bigint;
  /** What the engine locks against the position at the hold (its initial-margin requirement), quoted. */
  lockedUsd6: bigint;
  notionalUsd6: bigint;
  execPrice18: bigint;
  feeUsd6: bigint;
  sizeDelta: bigint;
}

export function restoredOrder(record: OperationRecord | undefined): SubmittedOrder | undefined {
  const i = record?.reviewedIntent;
  if (
    !record ||
    !i?.symbol ||
    (i.network !== "mainnet" && i.network !== "testnet") ||
    (i.side !== "long" && i.side !== "short")
  )
    return undefined;
  try {
    return {
      network: i.network,
      chainId: record.chainId,
      marketId: Number(i.marketId),
      symbol: i.symbol,
      side: i.side,
      leverage: Number(i.leverage),
      marginUsd6: BigInt(i.marginUsd6 ?? ""),
      lockedUsd6: BigInt(i.lockedUsd6 ?? ""),
      notionalUsd6: BigInt(i.notionalUsd6 ?? ""),
      execPrice18: BigInt(i.execPrice18 ?? ""),
      feeUsd6: BigInt(i.feeUsd6 ?? ""),
      sizeDelta: BigInt(i.sizeDelta ?? ""),
    };
  } catch {
    return undefined;
  }
}

/**
 * The receipt (inventory #21; D-114/D-163): shown only once the trace reached **finalized** — never on a submit or a
 * vote. Quoted values are labelled as quoted at the hold; the transaction links to the network's explorer. Share
 * opens a compact preview (inventory #22) before the native share sheet; amounts are opt-in, no identity is attached.
 * The figures sit in one borderless filled group.
 * The completed-outcome claim stays Blocked B1 until our own finalized lifecycles are recorded in acceptance.md.
 */
export function TicketReceipt({
  order,
  events,
  onDone,
  onViewPosition,
  onShare,
  protection,
  record,
}: {
  record?: OperationRecord | undefined;
  order: SubmittedOrder;
  events: readonly TraceEvent[];
  onDone: () => void;
  onViewPosition: () => void;
  onShare: () => void;
  /** The stop loss / take profit placed after the open (S1b.8a), each with its outcome. */
  protection?: ReactNode;
}) {
  const { color } = useTheme();
  const [details, setDetails] = useState(false);
  const fill = record?.steps
    .flatMap((s) => s.facts ?? [])
    .find((f) => f.event === "PositionUpdated" && f.values.marketId === String(order.marketId))?.values;
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
        <Text style={[TYPE.rowDetail, { color: tone }]}>
          {practice ? "Practice · Paper money" : "Mainnet · Real money"} · {network.name} · Finalized
          {finalizedAt ? ` ${new Date(finalizedAt).toLocaleTimeString()}` : ""}
        </Text>
      </View>
      <Panel style={styles.card}>
        <KeyValue label="Amount" value={money(order.marginUsd6)} />
        <KeyValue
          label={fill ? "Fill price" : "Fill price (estimated)"}
          value={`$${price18(fill?.execPrice ? BigInt(fill.execPrice) : order.execPrice18, decimals)}`}
        />
        <KeyValue
          label={fill ? "Fee" : "Fee (estimated)"}
          value={money(fill?.fee ? BigInt(fill.fee) : order.feeUsd6)}
        />
        {details ? (
          <>
            <KeyValue label="Leverage requested" value={`${order.leverage}×`} />
            <KeyValue label="Exposure requested" value={money(order.notionalUsd6)} />
            <KeyValue
              label={fill ? "Quantity" : "Quantity (estimated)"}
              value={`${formatUnits(fill?.sizeDelta ? BigInt(fill.sizeDelta) : order.sizeDelta, DECIMALS.e18, QUANTITY_DECIMALS)} ${order.symbol}`}
            />
            {hash ? <KeyValue label="Transaction" value={shortAddress(hash)} /> : null}
          </>
        ) : null}
      </Panel>
      <Button
        label={details ? "Hide details" : "Details"}
        variant="ghost"
        size="sm"
        onPress={() => setDetails(!details)}
      />
      {protection}
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
      <Panel style={styles.preview}>
        <Text style={[TYPE.rowStrong, { color: color.ink }]}>{lines[0]}</Text>
        {lines.slice(1).map((l) => (
          <Text key={l} style={[TYPE.rowDetail, { color: color.text2 }]} numberOfLines={2}>
            {l}
          </Text>
        ))}
      </Panel>
      <View style={styles.option}>
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
  card: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  actions: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  preview: { padding: SPACE.lg, gap: SPACE.xs },
  option: {
    minHeight: SIZE.touch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.md,
  },
});
