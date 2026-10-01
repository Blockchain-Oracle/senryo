import { entity } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { useGroupFill } from "~/components/kit/Surface";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { EntityMark } from "./EntityMark";

/**
 * The explicit venue on a ticket, position or receipt (v2-plan §5.12): the venue's own mark and its name, separate from
 * the asset, the network and any status. Never another venue's badge. A small filled badge (Fomo's "10x" / "New"):
 * 8 pt corners, no outline.
 */
export function VenueChip({ venue }: { venue: string }) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const name = entity(venue)?.name ?? "Unknown venue";
  return (
    <View accessible accessibilityLabel={`Venue ${name}`} style={[styles.chip, { backgroundColor: fill }]}>
      <EntityMark id={venue} size={SIZE.markChip} variant="symbol" decorative />
      <Text style={[TYPE.chipLabel, { color: color.text2 }]}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: SPACE.xs,
    paddingVertical: SPACE.xxs,
    paddingLeft: SPACE.xs,
    paddingRight: SPACE.sm,
    borderRadius: RADIUS.xs,
  },
});
