/**
 * A side's crest on the phone (D-315, F11; the web's `TeamMark`): the team's own crest from `@senryo/identity`'s team
 * table, bundled (fetched by script from ESPN's team feeds, pinned), the dark-ground crest in the dark theme; only a
 * club the feed doesn't list falls back to its abbreviation on a round plate.
 */
import type { EventView } from "@senryo/api-client";
import { ids, TEAM_CRESTS } from "@senryo/identity";
import { TEAM_CREST_SOURCES } from "@senryo/identity/native";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { TYPE, useTheme } from "~/theme";

const SIZES = { md: 36, lg: 48 } as const;

export function TeamMark({
  league,
  team,
  size = "md",
}: {
  league: string;
  team: EventView["home"];
  size?: keyof typeof SIZES;
}) {
  const { color, name } = useTheme();
  const id = ids.team(league, team.abbr);
  const crest = TEAM_CRESTS[id];
  const source = TEAM_CREST_SOURCES[name === "dark" && crest?.dark ? `${id}:dark` : id];
  const px = SIZES[size];
  if (source) {
    return (
      <Image
        source={source}
        style={{ width: px, height: px }}
        contentFit="contain"
        accessible
        accessibilityLabel={team.name}
      />
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={team.name}
      style={[styles.plate, { width: px, height: px, borderRadius: px / 2, backgroundColor: color.raised2 }]}
    >
      <Text style={[TYPE.micro, { color: color.inkMuted }]}>{team.abbr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { alignItems: "center", justifyContent: "center" },
});
