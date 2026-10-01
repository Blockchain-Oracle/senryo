import { StyleSheet, View } from "react-native";
import { useTheme } from "~/theme";
import { EntityMark } from "./EntityMark";

/** Each mark after the first overlaps the previous one by this share of its edge; the ring cuts it out of the ground. */
const OVERLAP_RATIO = 0.3;
const RING_RATIO = 0.08;
const RING_MIN = 1.5;

/**
 * Several real marks overlapped left to right (a route's source chains, a swap pair), each keeping its own identity.
 * Decorative: the row it sits in names the entities in text.
 */
export function MarkCluster({ ids, size, ground }: { ids: readonly string[]; size: number; ground?: string }) {
  const { color } = useTheme();
  const ring = Math.max(RING_MIN, size * RING_RATIO);
  const bg = ground ?? color.card;
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ids.map((id, i) => (
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
          <EntityMark id={id} size={size} decorative ground={bg} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  slot: { alignItems: "center", justifyContent: "center" },
});
