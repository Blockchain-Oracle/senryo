import { ids } from "@senryo/identity";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Screen } from "~/components/kit/Screen";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * Where every number comes from, with the attributions the sources require (DB-IP Lite is CC BY 4.0, S8.15). Each
 * source shows its own mark and what it provides ("Price source", v2-plan §5.12); freshness stays a separate label.
 */
const SOURCES = [
  {
    title: "Prices",
    provider: { id: ids.provider("chainlink"), name: "Chainlink", role: "Price source", variant: "symbol" },
    body: "Chainlink push feeds on Monad (XAU/USD, XAG/USD). Practice mode relays the same feeds to Monad testnet.",
  },
  {
    title: "Charts and history",
    provider: { id: ids.provider("envio"), name: "Envio", role: "Indexer", variant: "wordmark" },
    body: "Chainlink rounds and your fills, indexed by Envio from Monad.",
  },
  {
    title: "Region check",
    provider: { id: ids.provider("db-ip"), name: "DB-IP", role: "IP geolocation", variant: "wordmark" },
    body: "IP Geolocation by DB-IP — used only to apply the mainnet trading rules. Practice is open everywhere.",
    link: { label: "db-ip.com", url: "https://db-ip.com" },
  },
] as const;

/** Credits the marks' owners ask for (packages/identity/src/art records each source and licence). */
const MARKS_CREDIT =
  "Asset, network, venue and provider logos are their owners' trademarks, shown only to identify them; no " +
  "endorsement is implied. All trademarks shown are the property of Circle Internet Group, Inc. and/or its " +
  "affiliates (USDC), and of their respective owners. ETH diamond: ethereum.org, CC BY 4.0. Flags: Wikimedia " +
  "Commons, public domain.";

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
          <MarkedLine id={s.provider.id} label={s.provider.name} value={s.provider.role} variant={s.provider.variant} />
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
      <Panel style={styles.panel}>
        <SectionLabel>LOGOS</SectionLabel>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{MARKS_CREDIT}</Text>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({ panel: { padding: SPACE.md, gap: SPACE.xs } });
