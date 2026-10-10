/**
 * A side's mark on the phone (the web's `TeamMark`, R2.7): the team's logo from the identity registry (`ids.team`)
 * where one is on file; otherwise its abbreviation on a round plate. Never an image from a feed.
 */
import type { EventView } from "@senryo/api-client";
import { hasArt, ids } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { TYPE, useTheme } from "~/theme";

const PLATE = 36;

export function TeamMark({ league, team }: { league: string; team: EventView["home"] }) {
  const { color } = useTheme();
  const id = ids.team(league, team.abbr);
  if (hasArt(id)) return <EntityMark id={id} size={PLATE} label={team.name} />;
  return (
    <View accessible accessibilityLabel={team.name} style={[styles.plate, { backgroundColor: color.raised2 }]}>
      <Text style={[TYPE.micro, { color: color.inkMuted }]}>{team.abbr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    width: PLATE,
    height: PLATE,
    borderRadius: PLATE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
