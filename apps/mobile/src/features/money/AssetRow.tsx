/**
 * One holding (B1, Fomo F09/F12 row anatomy): the asset's mark, its name over its amount (and the trading part of a
 * dollar asset), its value over the 24 h change at the right. Bare on the page, a 0.985 press, a 30 ms stagger once
 * per mount (`index`). A row that can't do the current action stays visible, dimmed, with its ≤ 4-word reason.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { useNetwork } from "~/lib/network";
import {
  BUTTON,
  CONTROL_FONT_SCALE,
  DISABLED_OPACITY,
  SIZE,
  SPACE,
  STAGGER_RISE,
  TIMING,
  TYPE,
  useTheme,
} from "~/theme";
import { AssetMark } from "./AssetMark";
import type { MoneyAsset } from "./assets";
import { changeText, holdingLine, valueText } from "./format";

const ROW_PRESS_SCALE = 0.985;

export function AssetRow({
  asset,
  onPress,
  index = 0,
  detail,
  trailing,
  disabledReason,
  selected,
}: {
  asset: MoneyAsset;
  onPress?: () => void;
  index?: number;
  /** Replaces the amount line (a picker's "Available 212"). */
  detail?: string;
  /** Replaces the value column. */
  trailing?: ReactNode;
  /** Shown instead of the detail, with the row dimmed and inert. */
  disabledReason?: string | undefined;
  selected?: boolean;
}) {
  const { color } = useTheme();
  const network = useNetwork();
  const press = usePressScale(ROW_PRESS_SCALE);
  const change = changeText(asset.change24hBps);
  const up = (asset.change24hBps ?? 0) >= 0;
  const line = disabledReason ?? detail ?? holdingLine(asset);
  const value = valueText(asset, network.chainId);
  return (
    <Animated.View
      entering={FadeInDown.duration(TIMING.staggerItem)
        .delay(index * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
      style={[press.style, disabledReason ? styles.dim : null]}
    >
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress?.();
        }}
        disabled={!onPress || disabledReason !== undefined}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabledReason !== undefined, ...(selected === undefined ? {} : { selected }) }}
        accessibilityLabel={`${asset.name}, ${line}, ${value}`}
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        <AssetMark asset={asset} size={SIZE.markRow} />
        <View style={styles.text}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            style={[TYPE.rowTitle, { color: color.ink }]}
          >
            {asset.verified ? asset.name : asset.symbol}
          </Text>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            style={[TYPE.rowDetail, { color: asset.lookalike && !disabledReason ? color.warn : color.text3 }]}
          >
            {line}
          </Text>
        </View>
        {trailing ?? (
          <View style={styles.figure}>
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              style={[TYPE.rowPrice, { color: asset.valueUsd6 === null ? color.text3 : color.ink }]}
            >
              {value}
            </Text>
            {change ? (
              <Text
                maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                style={[TYPE.rowChange, { color: up ? color.up : color.down }]}
              >
                {change}
              </Text>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
  figure: { alignItems: "flex-end", gap: SPACE.xxs },
  dim: { opacity: DISABLED_OPACITY },
});
