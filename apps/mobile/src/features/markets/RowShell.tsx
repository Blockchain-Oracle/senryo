/**
 * The one market-row grammar (Fomo F11; flow book C1 step 2; plan §0.9 Markets): bare on the page — a 40 pt mark (with
 * the venue's badge when it isn't Senryo), the ticker with its leverage badge or a lock and one word, the short name
 * under it, and at the right the price over its 24 h change with ▲▼ and a sign (never colour alone). Price and change
 * sit in a tabular right column (ported from 21st.dev ssychui/market-watchlist, id 20110: the right-aligned
 * price-over-change cell; its bordered table, sort header and accent rail are dropped — F11 rows are borderless).
 * The plate shrinks to 0.97 under the finger; long-press stars it when the row can be starred (C10).
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { Skeleton } from "~/components/kit/states";
import { Lock } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { arrow, signedPct } from "~/lib/money";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** F11 measures the row mark at 40 pt. */
export const ROW_MARK = SIZE.avatarMd;
const PRICE_SKELETON = 72;
const LOCK_GLYPH = 12;

export interface RowShellProps {
  mark: string | undefined;
  /** The venue's mark as a small badge on the row mark (Perpl); none for Senryo's own markets. */
  badge?: string | undefined;
  /** Fallback text for a mark the registry doesn't know. */
  markLabel?: string;
  title: string;
  /** Beside the ticker: the leverage badge, or a lock with one word. */
  tag?: ReactNode;
  subtitle: string;
  subtitleTone?: string | undefined;
  /** `undefined` while it loads (skeleton); `null` when there is no price to show. */
  price: string | null | undefined;
  /** 24 h change in bps; `undefined` when unknown. */
  changeBps: bigint | undefined;
  /** Replaces the change line (a Retry, a held amount). */
  trailing?: ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}

export function RowShell(props: RowShellProps) {
  const { color } = useTheme();
  const press = usePressScale();
  const change = props.changeBps;
  const tint = change === undefined ? color.text3 : change >= 0n ? color.up : color.down;
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          props.onPress();
        }}
        {...(props.onLongPress
          ? {
              onLongPress: () => {
                fire("tick");
                props.onLongPress?.();
              },
            }
          : {})}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        {...(props.accessibilityHint ? { accessibilityHint: props.accessibilityHint } : {})}
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        <EntityMark id={props.mark} badge={props.badge} size={ROW_MARK} label={props.markLabel} decorative />
        <View style={styles.name}>
          <View style={styles.titleLine}>
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              numberOfLines={1}
              style={[TYPE.rowTitle, styles.shrink, { color: color.ink }]}
            >
              {props.title}
            </Text>
            {props.tag}
          </View>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            style={[TYPE.rowDetail, { color: props.subtitleTone ?? color.text3 }]}
          >
            {props.subtitle}
          </Text>
        </View>
        <View style={styles.price}>
          {props.price === undefined ? (
            <Skeleton width={PRICE_SKELETON} />
          ) : props.price === null ? null : (
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowPrice, { color: color.ink }]}>
              {props.price}
            </Text>
          )}
          {props.trailing ??
            (props.price === null ? null : (
              <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowChange, { color: tint }]}>
                {change === undefined ? "—" : `${arrow(change)} ${signedPct(change)}`}
              </Text>
            ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** A locked row's tag: the lock and one word ("Mainnet", "Soon", "No feed", "Read-only") — never a sentence. */
export function LockTag({ word }: { word: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.lock} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Lock size={LOCK_GLYPH} strokeWidth={SIZE.iconStroke} color={color.text3} />
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.label, { color: color.text3 }]}>
        {word}
      </Text>
    </View>
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
  name: { flex: 1, gap: SPACE.xxs },
  titleLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  shrink: { flexShrink: 1 },
  price: { alignItems: "flex-end", gap: SPACE.xxs },
  lock: { flexDirection: "row", alignItems: "center", gap: SPACE.xxs },
});
