import { planMark } from "@senryo/identity";
import { StyleSheet, View } from "react-native";
import { useTheme } from "~/theme";
import { EntityMark } from "./EntityMark";

/** Each mark after the first overlaps the previous one by this share of its edge; the ring cuts it out of the ground. */
const OVERLAP_RATIO = 0.3;
const RING_RATIO = 0.08;
const RING_MIN = 1.5;
/**
 * A square mark (the Base Square) sits inside the round chip at its owner's clear space, 0.3× on each side: side
 * 1 / 1.6 of the chip, which also keeps its corners inside the circle. The square itself is never rounded or clipped.
 */
const SQUARE_CLEAR_SPACE_SCALE = 1.6;
const SQUARE_SHARE = 1 / SQUARE_CLEAR_SPACE_SCALE;

/**
 * Several real marks overlapped left to right (a route's source chains, a swap pair), each keeping its own identity.
 * Every chip is round so the row keeps one rhythm; a square mark, which its owner forbids altering, is drawn whole
 * inside its chip rather than edge to edge, where its corners would poke out of the ring.
 * Decorative: the row it sits in names the entities in text.
 */
export function MarkCluster({ ids, size, ground }: { ids: readonly string[]; size: number; ground?: string }) {
  const { color, name } = useTheme();
  const ring = Math.max(RING_MIN, size * RING_RATIO);
  const bg = ground ?? color.card;
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ids.map((id, i) => {
        const plan = planMark(id, "disc", name);
        const square = plan.kind === "art" && plan.shape === "tile";
        return (
          <View
            key={id}
            style={[
              styles.slot,
              {
                padding: ring,
                borderRadius: size,
                backgroundColor: bg,
                marginLeft: i === 0 ? 0 : -size * OVERLAP_RATIO - ring * 2,
                zIndex: ids.length - i,
              },
            ]}
          >
            {square ? (
              <View style={[styles.slot, { width: size, height: size }]}>
                <EntityMark id={id} size={size * SQUARE_SHARE} decorative ground={bg} />
              </View>
            ) : (
              <EntityMark id={id} size={size} decorative ground={bg} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  slot: { alignItems: "center", justifyContent: "center" },
});
