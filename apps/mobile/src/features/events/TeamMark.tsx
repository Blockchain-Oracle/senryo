/**
 * A side's mark on the phone (the web's `TeamMark`): its logo as the source feed publishes it (ESPN's) on a round
 * plate; its abbreviation when there is none or it fails to load.
 */
import type { EventView } from "@senryo/api-client";
import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TYPE, useTheme } from "~/theme";

const PLATE = 36;
const LOGO = 28;

export function TeamMark({ team }: { team: EventView["home"] }) {
  const { color } = useTheme();
  const [failed, setFailed] = useState(false);
  return (
    <View accessibilityLabel={team.name} style={[styles.plate, { backgroundColor: color.raised2 }]}>
      {team.logo && !failed ? (
        <Image
          source={{ uri: team.logo }}
          contentFit="contain"
          cachePolicy="disk"
          onError={() => setFailed(true)}
          style={styles.logo}
        />
      ) : (
        <Text style={[TYPE.micro, { color: color.inkMuted }]}>{team.abbr}</Text>
      )}
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
    overflow: "hidden",
  },
  logo: { width: LOGO, height: LOGO },
});
