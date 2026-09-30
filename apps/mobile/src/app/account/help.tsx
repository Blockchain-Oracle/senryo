import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { SPACE, TYPE, useTheme } from "~/theme";

/** Where every number comes from, with the attributions the sources require (DB-IP Lite is CC BY 4.0, S8.15). */
const SOURCES = [
  {
    title: "Prices",
    body: "Chainlink push feeds on Monad (XAU/USD, XAG/USD). Practice mode relays the same feeds to Monad testnet.",
  },
  {
    title: "Charts and history",
    body: "Chainlink rounds and your fills, indexed by Envio from Monad.",
  },
  {
    title: "Region check",
    body: "IP Geolocation by DB-IP — used only to apply the mainnet trading rules. Practice is open everywhere.",
    link: { label: "db-ip.com", url: "https://db-ip.com" },
  },
] as const;

export default function HelpScreen() {
  const { color } = useTheme();
  return (
    <Screen>
      <Stack.Screen options={{ title: "About & sources" }} />
      <Panel style={styles.panel}>
        <SectionLabel>SENRYO · {ACTIVE_NETWORK.modeLabel.toUpperCase()}</SectionLabel>
        <Text style={[TYPE.body, { color: color.inkMuted }]}>
          Cash-settled gold and silver perps on Monad. You never own the metal; leverage multiplies gains and losses.
        </Text>
      </Panel>
      {SOURCES.map((s) => (
        <Panel key={s.title} style={styles.panel}>
          <SectionLabel>{s.title.toUpperCase()}</SectionLabel>
          <Text style={[TYPE.body, { color: color.ink }]}>{s.body}</Text>
          {"link" in s ? (
            <View>
              <Text
                accessibilityRole="link"
                onPress={() => void Linking.openURL(s.link.url)}
                style={[TYPE.bodyStrong, { color: color.primary }]}
              >
                {s.link.label}
              </Text>
            </View>
          ) : null}
        </Panel>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ panel: { padding: SPACE.md, gap: SPACE.xs } });
