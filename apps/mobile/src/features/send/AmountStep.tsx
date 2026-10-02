/**
 * The amount step every outgoing flow shares (B7 step 2, B8 step 3; Phantom P20's token chip, Fomo F23): the asset
 * chip "AUSD ⌄" (any holding — opens the picker the screen owns), the amount pad with Max (MON keeps its fee reserve)
 * and the path that frees a locked part, any warnings as one line each, and Review. Lives inside a `ChildSheet`.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { ChevronDown, TriangleAlert } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { AmountPad } from "~/features/money/AmountPad";
import { AssetMark } from "~/features/money/AssetMark";
import type { AmountInput } from "~/features/money/amount";
import type { MoneyAsset } from "~/features/money/assets";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function AssetChip({ asset, onPress }: { asset: MoneyAsset; onPress: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={[styles.chipWrap, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${asset.symbol}, change asset`}
        style={[styles.chip, { backgroundColor: color.raised2 }]}
      >
        <AssetMark asset={asset} size={SIZE.markInline + SPACE.xs} />
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, { color: color.ink }]}>
          {asset.symbol}
        </Text>
        <ChevronDown size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text2} />
      </Pressable>
    </Animated.View>
  );
}

export function AmountStep({
  asset,
  input,
  available,
  locked,
  warnings,
  onAsset,
  onReview,
  reviewLabel = "Review",
  blocked,
  extra,
}: {
  asset: MoneyAsset;
  input: AmountInput;
  available: bigint;
  locked?: { text: string; onPress: () => void } | undefined;
  warnings: readonly string[];
  onAsset: () => void;
  onReview: () => void;
  reviewLabel?: string;
  /** Why Review can't go on yet (≤ 4 words); replaces its label. */
  blocked?: string | undefined;
  extra?: ReactNode;
}) {
  const { color } = useTheme();
  const reason =
    blocked ?? (input.amount === 0n ? "Enter an amount" : input.over ? `Not enough ${asset.symbol}` : undefined);
  return (
    <View style={styles.stack}>
      <AssetChip asset={asset} onPress={onAsset} />
      <AmountPad asset={asset} input={input} available={available} locked={locked} />
      {warnings.map((w) => (
        <View key={w} style={styles.warning}>
          <TriangleAlert size={SIZE.iconSm} color={color.warn} />
          <Text style={[TYPE.rowDetail, { color: color.warn }]}>{w}</Text>
        </View>
      ))}
      {extra}
      <Button label={reason ?? reviewLabel} disabled={reason !== undefined} onPress={onReview} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  chipWrap: { alignSelf: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs + SPACE.xxs,
    paddingLeft: SPACE.xs + SPACE.xxs,
    paddingRight: SPACE.md,
    paddingVertical: SPACE.xs + SPACE.xxs,
    borderRadius: RADIUS.pill,
  },
  warning: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
