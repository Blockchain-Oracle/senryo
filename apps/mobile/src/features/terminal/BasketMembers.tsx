/**
 * A basket's members under the terminal (S7.5, D-286; the web's `BasketMembers`): each one's mark, weight, move since
 * the basket was 1,000 points and what it adds to the basket now. One row per member, each on its own live price.
 * Nothing for a single market.
 */
import { basketOf, memberLine } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MARK = 24;
const POINTS_WIDTH = 96;

function MemberRow({ member }: { member: ReturnType<typeof basketOf>[number] }) {
  const { color } = useTheme();
  const priceE8 = useLivePrice(member.symbol);
  const line = memberLine(member, priceE8);
  const tone = line.tone === "up" ? color.up : line.tone === "down" ? color.down : color.inkMuted;
  return (
    <View style={styles.row}>
      <EntityMark id={marketId(member.symbol)} size={MARK} decorative />
      <View style={styles.name}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{member.symbol}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{line.weight}</Text>
      </View>
      <Text style={[TYPE.caption, { color: tone }]}>{line.move ?? "—"}</Text>
      <Text style={[TYPE.caption, styles.points, { color: color.ink }]}>{line.points ?? "—"}</Text>
    </View>
  );
}

export function BasketMembers({ symbol }: { symbol: string }) {
  const { color } = useTheme();
  const members = basketOf(symbol);
  if (members.length === 0) return null;
  return (
    <View style={styles.wrap} accessibilityLabel="In this basket">
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>In this basket · started at 1,000 pts</Text>
      {members.map((m) => (
        <MemberRow key={m.symbol} member={m} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xs, paddingHorizontal: SIZE.gutter },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.touch - SPACE.sm },
  name: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: SPACE.sm },
  points: { width: POINTS_WIDTH, textAlign: "right" },
});
