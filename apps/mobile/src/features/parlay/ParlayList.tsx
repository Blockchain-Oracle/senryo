/**
 * Your parlays (S8.5; the web's `ParlayList`): each slip's big line (what it pays while live, the result once done),
 * where it stands and every leg's outcome as it settles — newest first; rows, not boxes.
 */
import { LEG_WORD, parlayHero, parlayStatus, pickLine } from "@senryo/calls";
import { usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useParlays } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MARK = 24;

export function ParlayList({ owner }: { owner: `0x${string}` | undefined }) {
  const { color } = useTheme();
  const parlays = useParlays(owner);
  if (!owner || !("value" in parlays)) return null;
  const list = parlays.value.parlays;
  const tone = { up: color.up, down: color.down, ink: color.ink } as const;
  return (
    <View style={styles.wrap} accessibilityLabel="Your parlays">
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Your parlays
      </Text>
      {list.length === 0 ? (
        <Text style={[TYPE.body, { color: color.inkMuted }]}>Your parlays show here once placed.</Text>
      ) : (
        list.map((p) => {
          const hero = parlayHero(p);
          return (
            <View key={String(p.parlayId)} style={[styles.slip, { borderBottomColor: color.hairline }]}>
              <View style={styles.head}>
                <Text style={[TYPE.rowTitle, { color: tone[hero.tone] }]}>{hero.text}</Text>
                <Text style={[TYPE.caption, { color: color.inkMuted }]}>
                  {parlayStatus(p)} · {usd(p.stake)}
                </Text>
              </View>
              {p.legs.map((l) => (
                <View key={l.windowId} style={styles.leg}>
                  <EntityMark id={marketId(l.symbol)} size={MARK} decorative />
                  <Text style={[TYPE.caption, styles.flex, { color: color.ink }]}>{pickLine(l)}</Text>
                  <Text
                    style={[
                      TYPE.caption,
                      { color: l.outcome === "won" ? color.up : l.outcome === "lost" ? color.down : color.inkMuted },
                    ]}
                  >
                    {LEG_WORD[l.outcome]}
                  </Text>
                </View>
              ))}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm },
  slip: { gap: SPACE.xs, paddingVertical: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: SPACE.sm },
  leg: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  flex: { flex: 1 },
});
