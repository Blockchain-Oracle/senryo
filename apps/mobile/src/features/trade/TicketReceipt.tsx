import { explorerTxUrl } from "@senryo/config";
import { DECIMALS } from "@senryo/core";
import type { OperationRecord, TraceEvent, TraceOutcome } from "@senryo/query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Linking, Share, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { DetailRow } from "~/features/markets/Disclosure";
import { shortAddress } from "~/lib/format";
import { price18, priceDecimalsOf, usd } from "~/lib/money";
import type { NetworkKey } from "~/lib/network";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { quantityText } from "./quantity";
import { ORDER_WORDS, TradeTrace } from "./TradeTrace";
import type { Side } from "./useTicket";

/** What the order was at the moment of the slide — the outcome carries its own mode, never the app's current one. */
export interface SubmittedOrder {
  network: NetworkKey;
  chainId: number;
  marketId: number;
  symbol: string;
  side: Side;
  leverage: number;
  /** The margin the user entered: margin × leverage = exposure, exactly as the ticket showed it. */
  marginUsd6: bigint;
  /** What the engine locks against the position at the slide (its initial-margin requirement), quoted. */
  lockedUsd6: bigint;
  notionalUsd6: bigint;
  execPrice18: bigint;
  feeUsd6: bigint;
  sizeDelta: bigint;
  /** The liquidation price quoted at review; null when there is none above $0, undefined on older records. */
  liqPrice18: bigint | null | undefined;
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
      liqPrice18: i.liqPrice18 === undefined ? undefined : i.liqPrice18 === "" ? null : BigInt(i.liqPrice18),
    };
  } catch {
    return undefined;
  }
}

/**
 * The order's outcome (plan §0.9 Order status; Part A8): the one outcome surface, `TradeTrace`, in the order's words —
 * "Opening short" with a spinner while it runs, then the check, "Short XAU opened" and three facts (Size · Entry ·
 * Liq.) taken from the reviewed intent and, once read, the fill event; View position and Share; and under Details the
 * margin, leverage, fee, fill and the transaction. A failure hands back to review and never resends; an unknown
 * result offers no new action. Protection placed after the fill (`protection`) shows its own lines under the facts.
 */
export function OrderOutcome({
  order,
  events,
  record,
  running,
  outcome,
  protection,
  onDone,
  onLeave,
  onViewPosition,
  onShare,
}: {
  order: SubmittedOrder | undefined;
  events: readonly TraceEvent[];
  record: OperationRecord | undefined;
  running: boolean;
  outcome: TraceOutcome | undefined;
  protection?: ReactNode;
  onDone: () => void;
  onLeave: () => void;
  onViewPosition: () => void;
  onShare: () => void;
}) {
  const settled = events.some((e) => e.stage === "finalized");
  const sideWord = order ? (order.side === "long" ? "Long" : "Short") : undefined;
  const fill = order
    ? record?.steps
        .flatMap((s) => s.facts ?? [])
        .find((f) => f.event === "PositionUpdated" && f.values.marketId === String(order.marketId))?.values
    : undefined;
  const hash = events.find((e) => e.hash)?.hash;
  const words = order
    ? {
        ...ORDER_WORDS,
        pending: `Opening ${order.side}`,
        success: `${sideWord} ${order.symbol} opened`,
        done: "Done",
      }
    : ORDER_WORDS;
  const decimals = order ? priceDecimalsOf(order.marketId) : undefined;
  const money = (v: bigint) => usd(v, DECIMALS.cents, order?.network);
  const entry = order ? (fill?.execPrice ? BigInt(fill.execPrice) : order.execPrice18) : undefined;
  return (
    <TradeTrace
      events={events}
      record={record}
      running={running}
      outcome={outcome}
      onDone={onDone}
      onLeave={onLeave}
      words={words}
      next={
        <View style={styles.next}>
          <Button label="Share" variant="outline" style={styles.flex} onPress={onShare} />
          <Button label="View position" variant="secondary" style={styles.flex} onPress={onViewPosition} />
        </View>
      }
      details={
        order ? (
          <View>
            <DetailRow label="Margin" value={money(order.marginUsd6)} />
            <DetailRow label="Leverage" value={`${order.leverage}×`} />
            <DetailRow
              label={fill ? "Fee" : "Fee (estimated)"}
              value={money(fill?.fee ? BigInt(fill.fee) : order.feeUsd6)}
            />
            {hash ? (
              <Button
                label={`Transaction ${shortAddress(hash)}`}
                variant="ghost"
                size="sm"
                onPress={() =>
                  void Linking.openURL(explorerTxUrl(order.chainId as Parameters<typeof explorerTxUrl>[0], hash))
                }
              />
            ) : null}
          </View>
        ) : null
      }
    >
      {settled && order && entry !== undefined ? (
        <>
          <Facts
            facts={[
              {
                label: "Size",
                value: quantityText(order.marketId, fill?.sizeDelta ? BigInt(fill.sizeDelta) : order.sizeDelta),
              },
              { label: fill ? "Entry" : "Entry (est.)", value: `$${price18(entry, decimals)}` },
              {
                label: "Liq.",
                value:
                  order.liqPrice18 === undefined
                    ? "—"
                    : order.liqPrice18 === null
                      ? "None"
                      : `$${price18(order.liqPrice18, decimals)}`,
              },
            ]}
          />
          {protection}
        </>
      ) : null}
    </TradeTrace>
  );
}

/** Three value-over-label facts in one strip (Fomo F13's "Invested / Avg. entry" pairs). */
export function Facts({ facts }: { facts: ReadonlyArray<{ label: string; value: string }> }) {
  const { color } = useTheme();
  return (
    <View style={styles.facts}>
      {facts.map((f) => (
        <View key={f.label} style={styles.fact} accessible accessibilityLabel={`${f.label} ${f.value}`}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[TYPE.rowAmount, { color: color.ink }]}
          >
            {f.value}
          </Text>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
            {f.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The share preview: a compact child over the ticket, then the native share sheet. Amounts are opt-in. */
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
  next: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  facts: { flexDirection: "row", gap: SPACE.md, paddingVertical: SPACE.sm },
  fact: { flex: 1, alignItems: "center", gap: SPACE.xxs },
  preview: { padding: SPACE.lg, gap: SPACE.xs },
  option: {
    minHeight: SIZE.touch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.md,
  },
});
