/**
 * One Activity row (B12; Fomo F12 row anatomy, 21st.dev hari/transaction-list #2943's row → detail behaviour): the
 * subject's real mark (two overlapped for a swap; the group's glyph only when the event names no entity), the verb
 * title over when it happened — or, while it settles, "Pending" / "Checking" with a spinner, "Partly done" — and the
 * signed figure at the right. Bare on the page, a 0.985 press, a 30 ms stagger once per mount. Opens the receipt.
 */
import type { FeedItem, FeedStatus } from "@senryo/query";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { ArrowLeftRight, ChartCandlestick, CreditCard } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { AssetMark } from "~/features/money/AssetMark";
import { activityTime } from "~/features/portfolio/activity-copy";
import { fire } from "~/feedback/fire";
import { BUTTON, CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";

const ROW_PRESS_SCALE = 0.985;
const MS_PER_SECOND = 1000;
/** Rows past this index arrive without a delay (the stagger is for the first screenful). */
const STAGGER_ROWS = 12;
const GROUP_ICON = { trades: ChartCandlestick, money: ArrowLeftRight, card: CreditCard } as const;

export const STATUS_WORDS: Record<Exclude<FeedStatus, "done">, string> = {
  pending: "Pending",
  checking: "Checking",
  partial: "Partly done",
  failed: "Didn’t go through",
};

/** Resolves a mark id to its token-list logo when the holdings know one (unknown tokens). */
export type LogoOf = (markId: string | undefined) => string | null;

export function FeedLead({ item, logoOf }: { item: FeedItem; logoOf?: LogoOf | undefined }) {
  const { color } = useTheme();
  const [first, second] = item.marks;
  if (first && second)
    return <MarkCluster ids={[first.id ?? "", second.id ?? ""]} size={SIZE.markToken} ground={color.ground} />;
  if (first) {
    return (
      <AssetMark
        asset={{ mark: first.id ?? "", symbol: first.label, logoUrl: logoOf?.(first.id) ?? null }}
        size={SIZE.markDetail}
        ground={color.ground}
      />
    );
  }
  const Glyph = GROUP_ICON[item.group];
  return (
    <View style={[styles.disc, { backgroundColor: color.card }]}>
      <Glyph size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text2} />
    </View>
  );
}

export function FeedRow({
  item,
  index,
  onPress,
  logoOf,
}: {
  item: FeedItem;
  index: number;
  onPress: () => void;
  logoOf?: LogoOf | undefined;
}) {
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
  const live = item.status === "pending" || item.status === "checking";
  const when = activityTime(Math.floor(item.at / MS_PER_SECOND));
  const sub = item.status === "done" ? when : `${STATUS_WORDS[item.status]} · ${when}`;
  const subInk =
    item.status === "partial" || item.status === "checking"
      ? color.warn
      : item.status === "failed"
        ? color.down
        : color.text3;
  const tone = item.figure?.tone === "up" ? color.up : item.figure?.tone === "down" ? color.down : color.ink;
  return (
    <Animated.View
      entering={FadeInDown.duration(TIMING.staggerItem)
        .delay(Math.min(index, STAGGER_ROWS) * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
      style={press.style}
    >
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${sub}${item.figure ? `, ${item.figure.text}` : ""}`}
        accessibilityHint="Opens the receipt"
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        <View style={styles.lead}>
          <FeedLead item={item} logoOf={logoOf} />
        </View>
        <View style={styles.name}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            style={[TYPE.rowTitle, { color: color.ink }]}
          >
            {item.title}
          </Text>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            style={[TYPE.rowDetail, { color: subInk }]}
          >
            {sub}
          </Text>
        </View>
        {live ? <ActivityIndicator color={color.text2} /> : null}
        {item.figure && !live ? (
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            style={[TYPE.rowPrice, styles.figure, { color: tone }]}
          >
            {item.figure.text}
          </Text>
        ) : null}
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
  lead: { width: SIZE.markDetail, alignItems: "center" },
  disc: {
    width: SIZE.markDetail,
    height: SIZE.markDetail,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, gap: SPACE.xxs },
  figure: { maxWidth: "45%", textAlign: "right" },
});
