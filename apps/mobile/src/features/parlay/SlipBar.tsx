/**
 * The slip, folded (P3, D-326; Codex's 88-point bar, Mitoshi's slip pill): always there at the bottom of Parlay, before
 * anything is picked — "Choose your first leg" — then the legs' marks, how many, and the live price of the whole
 * parlay, with the way in: "Add one more" at one leg, "Review parlay" from two. Tapping it opens the slip.
 */
import { type ParlayPick, slipBarWords } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { BUTTON, ELEVATION, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const BAR = 88;
const MARK = 28;
const OVERLAP = 10;

export const slipBarSpace = (bottomInset: number) => BAR + bottomInset;

export function SlipBar({
  picks,
  price,
  trading,
  onOpen,
}: {
  picks: readonly ParlayPick[];
  /** "Pays 3.84× · About 26%" once priced (never between rounds). */
  price: string | null;
  trading: boolean;
  onOpen: () => void;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const words = slipBarWords(picks.length, price, trading);
  const ready = words.action !== null && picks.length > 1;
  return (
    <Pressable
      onPress={onOpen}
      disabled={picks.length === 0}
      accessibilityRole="button"
      accessibilityLabel={`${words.title}. ${words.detail}${words.action ? `. ${words.action}` : ""}`}
      style={[
        styles.bar,
        ELEVATION.sheet,
        { backgroundColor: color.popover, minHeight: BAR + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.marks}>
        {picks.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: color.raised2 }]} />
        ) : (
          picks.map((p, i) => (
            <View
              key={p.symbol}
              style={[styles.mark, { marginLeft: i === 0 ? 0 : -OVERLAP, zIndex: picks.length - i }]}
            >
              <EntityMark id={marketId(p.symbol)} size={MARK} decorative />
            </View>
          ))
        )}
      </View>
      <View style={styles.text}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{words.title}</Text>
        <Text numberOfLines={1} style={[TYPE.caption, { color: color.inkMuted }]}>
          {words.detail}
        </Text>
      </View>
      {words.action ? (
        <View style={[styles.action, { backgroundColor: ready ? color.primary : color.raised2 }]}>
          <Text style={[TYPE.buttonCompact, { color: ready ? color.primaryForeground : color.ink }]}>
            {words.action}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SIZE.gutter,
    borderTopLeftRadius: BUTTON.radius.md,
    borderTopRightRadius: BUTTON.radius.md,
  },
  marks: { flexDirection: "row", alignItems: "center" },
  mark: { borderRadius: MARK / 2 },
  empty: { width: MARK, height: MARK, borderRadius: MARK / 2 },
  text: { flex: 1 },
  action: {
    height: SIZE.buttonHeightSm,
    borderRadius: BUTTON.radius.sm,
    paddingHorizontal: SPACE.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
