/**
 * The duel tiers as tiles (P4, D-323; Codex's 132×112 carousel): each tile names its pot ("No pot", "$10 pot"), its
 * three calls' stake, and how many wait in it now ("2 waiting", "First in this tier"); the row pages tile by tile.
 * The chosen tile is filled. Under the row, the chosen tier's commitment is spelled out.
 */
import { commitment, tierTitle, waitingText } from "@senryo/calls";
import { DUEL, type DuelTierSpec } from "@senryo/config";
import { usdTidy } from "@senryo/core";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const TILE_W = 132;
const TILE_H = 112;

export function TierCarousel({
  tiers,
  value,
  onChange,
  waiting,
}: {
  tiers: readonly DuelTierSpec[];
  value: number;
  onChange: (id: number) => void;
  /** Per tier, how many wait now; undefined while unknown. */
  waiting: ReadonlyMap<number, number> | undefined;
}) {
  const { color } = useTheme();
  const chosen = tiers.find((t) => t.id === value) ?? tiers[0];
  const words = chosen ? commitment(chosen) : null;
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={TILE_W + SPACE.sm}
        decelerationRate="fast"
        accessibilityRole="radiogroup"
        accessibilityLabel="Duel tier"
        style={{ marginHorizontal: -SIZE.gutter }}
        contentContainerStyle={styles.row}
      >
        {tiers.map((t) => {
          const on = t.id === chosen?.id;
          const ink = on ? color.accentForeground : color.ink;
          const muted = on ? color.accentForeground : color.inkMuted;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                if (on) return;
                fire("tick");
                onChange(t.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${tierTitle(t)}, ${DUEL.cards} calls of ${usdTidy(t.cardStake)}, ${waitingText(waiting?.get(t.id) ?? (waiting ? 0 : undefined))}`}
              style={[styles.tile, { backgroundColor: on ? color.accent : color.card }]}
            >
              <Text style={[TYPE.title, { color: ink }]}>{tierTitle(t)}</Text>
              <Text style={[TYPE.caption, { color: muted }]}>
                {DUEL.cards} × {usdTidy(t.cardStake)} calls
              </Text>
              <Text style={[TYPE.micro, { color: muted }]}>
                {waitingText(waiting ? (waiting.get(t.id) ?? 0) : undefined)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {words ? (
        <View style={styles.commitment} accessibilityLiveRegion="polite">
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{words.sum}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.note}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  row: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    justifyContent: "space-between",
  },
  commitment: { gap: SPACE.xxs },
});
