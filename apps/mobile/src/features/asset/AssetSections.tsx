/**
 * The asset page's sections (B2): the unverified banner with Hide, "Your balance" with the dollar breakdown (Wallet ·
 * In trades · Held by card, each with the path behind it), About as fact rows, and this asset's money from this
 * phone's journal. Rows, not boxes; no sentences.
 */
import { type ChainId, explorerAddressUrl } from "@senryo/config";
import { ids } from "@senryo/identity";
import { type OperationRecord, operationsFor, subscribeOperations } from "@senryo/query";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { SectionLabel } from "~/components/kit/Surface";
import { TriangleAlert } from "~/components/kit/symbols";
import type { MoneyAsset } from "~/features/money/assets";
import { amountOf, valueText } from "~/features/money/format";
import { fire } from "~/feedback/fire";
import { shortAddress } from "~/lib/format";
import { usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { journalTitle } from "./journal-title";

const ACTIVITY_ROWS = 5;

export function UnverifiedBanner({ asset, onHide }: { asset: MoneyAsset; onHide: () => void }) {
  const { color } = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: color.warnWash }]} accessibilityRole="alert">
      <TriangleAlert size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.warn} />
      <View style={styles.grow}>
        <Text style={[TYPE.rowStrong, { color: color.ink }]}>Unverified token</Text>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          {asset.lookalike ? `Not the listed ${asset.symbol}` : "Not on Monad’s token list"}
        </Text>
      </View>
      <Button label="Hide" variant="secondary" size="sm" block={false} onPress={onHide} />
    </View>
  );
}

/** One line of a section: label at the left, value (and its path) at the right. */
export function FactRow({
  label,
  value,
  onPress,
  mark,
}: {
  label: string;
  value: string;
  onPress?: (() => void) | undefined;
  mark?: string | undefined;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        fire("tick");
        onPress?.();
      }}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${label} ${value}`}
      style={styles.fact}
    >
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, styles.grow, { color: color.text3 }]}>
        {label}
      </Text>
      {mark ? <EntityMark id={mark} size={SIZE.markChip} decorative /> : null}
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        style={[TYPE.rowAmount, { color: onPress ? color.link : color.ink }]}
      >
        {value}
        {onPress ? " ›" : ""}
      </Text>
    </Pressable>
  );
}

export function BalanceSection({
  asset,
  chainId,
  holdsUsd6,
  onTrades,
  onCard,
}: {
  asset: MoneyAsset;
  chainId: number;
  holdsUsd6: bigint;
  onTrades: () => void;
  onCard: () => void;
}) {
  const { color } = useTheme();
  const locked = asset.trading - asset.tradingFree;
  return (
    <View style={styles.section}>
      <SectionLabel>Your balance</SectionLabel>
      <View style={styles.balance}>
        <Text style={[TYPE.numMd, styles.grow, { color: asset.total === 0n ? color.text3 : color.ink }]}>
          {asset.total === 0n ? "None yet" : amountOf(asset, asset.total)}
        </Text>
        {asset.total > 0n ? (
          <Text style={[TYPE.rowPrice, { color: color.text2 }]}>{valueText(asset, chainId)}</Text>
        ) : null}
      </View>
      {asset.collateral && asset.total > 0n ? (
        <View>
          <FactRow label="Wallet" value={amountOf(asset, asset.wallet)} />
          {asset.trading > 0n ? (
            <FactRow
              label={locked > 0n ? `In trades · ${amountOf(asset, locked)} backs positions` : "In trades"}
              value={amountOf(asset, asset.trading)}
              onPress={onTrades}
            />
          ) : null}
          {holdsUsd6 > 0n ? <FactRow label="Held by card" value={usd(holdsUsd6)} onPress={onCard} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export function AboutSection({
  asset,
  chainId,
  networkName,
}: {
  asset: MoneyAsset;
  chainId: ChainId;
  networkName: string;
}) {
  return (
    <View style={styles.section}>
      <SectionLabel>About</SectionLabel>
      <FactRow label="Network" value={networkName} mark={ids.evmChain(chainId)} />
      <FactRow
        label="Contract"
        value={asset.native ? "Native MON" : shortAddress(asset.address)}
        onPress={asset.native ? undefined : () => void Linking.openURL(explorerAddressUrl(chainId, asset.address))}
      />
      <FactRow label="Decimals" value={String(asset.decimals)} />
      <FactRow label="Listed" value={asset.verified ? "Monad token list" : "Not listed"} />
    </View>
  );
}

/** This asset's money on this phone's journal (sends, swaps, withdrawals, bridges), newest first. */
export function AssetActivity({
  asset,
  chainId,
  account,
  onOpen,
  onAll,
}: {
  asset: MoneyAsset;
  chainId: number;
  account: string;
  onOpen: (record: OperationRecord) => void;
  onAll: () => void;
}) {
  const { color } = useTheme();
  const [, refresh] = useState(0);
  useEffect(() => subscribeOperations(() => refresh((n) => n + 1)), []);
  const rows = operationsFor(chainId, account)
    .filter((r) => r.reviewedIntent.symbol === asset.symbol || r.reviewedIntent.outSymbol === asset.symbol)
    .slice(0, ACTIVITY_ROWS);
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <SectionLabel>Activity</SectionLabel>
        <Pressable onPress={onAll} accessibilityRole="link" hitSlop={SPACE.sm}>
          <Text style={[TYPE.rowDetail, { color: color.link }]}>All activity ›</Text>
        </Pressable>
      </View>
      {rows.length === 0 ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Nothing from this phone yet</Text>
      ) : (
        rows.map((r) => (
          <FactRow
            key={r.id}
            label={new Date(r.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            value={journalTitle(r)}
            onPress={() => onOpen(r)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: SHEET_SHAPE.rowRadius,
  },
  grow: { flex: 1 },
  section: { gap: SPACE.xs },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balance: { flexDirection: "row", alignItems: "baseline", gap: SPACE.md, paddingVertical: SPACE.xs },
  fact: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.touch },
});
