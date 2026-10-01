import { entity } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { EntityMark } from "./EntityMark";

/**
 * The explicit venue on a ticket, position or receipt (v2-plan §5.12): the venue's own mark and its name, separate from
 * the asset, the network and any status. Never another venue's badge.
 */
export function VenueChip({ venue }: { venue: string }) {
  const { color } = useTheme();
  const name = entity(venue)?.name ?? "Unknown venue";
  return (
    <View
      accessible
      accessibilityLabel={`Venue ${name}`}
      style={[styles.chip, { borderColor: color.hairline, backgroundColor: color.card }]}
    >
      <EntityMark id={venue} size={SIZE.markChip} variant="symbol" decorative />
      <Text style={[TYPE.caption, { color: color.ink }]}>{name}</Text>
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
    borderRadius: RADIUS.pill,
    borderWidth: HAIRLINE_PX,
  },
});
