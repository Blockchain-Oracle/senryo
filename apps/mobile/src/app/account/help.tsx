import { SUPPORT_EMAIL } from "@senryo/api-client";
import { ids } from "@senryo/identity";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { APP } from "~/lib/constants/app";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const SEAL = ids.brand("senryo");

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
  "Commons, public domain. Passkey and crude-oil icons: Material Symbols by Google, Apache License 2.0.";

/**
 * About & sources (J9): the seal, the version and the mode at the top, bare on the page; then one filled group per
 * source with its real mark, what it provides and the attribution it asks for; the contact address (the visible
 * contact point App Store 1.2 requires); and the logo credits as plain small text.
 */
export default function HelpScreen() {
  const network = useNetwork();
  const { color } = useTheme();
  return (
    <Screen>
      <Stack.Screen options={{ title: "About & sources" }} />
      <View style={styles.about}>
        <EntityMark id={SEAL} size={SIZE.avatarLg} variant="symbol" decorative ground={color.ground} />
        <View style={styles.name}>
          <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
            {APP.name}
          </Text>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
            Version {APP.version} · {network.modeLabel}
          </Text>
        </View>
        <Text style={[TYPE.body, { color: color.text2 }]}>
          Cash-settled gold and silver perps on Monad. You never own the metal; leverage multiplies gains and losses.
        </Text>
      </View>
      <View style={styles.section}>
        <SectionHeading>Sources</SectionHeading>
        {SOURCES.map((s) => (
          <Panel key={s.title} style={styles.panel}>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{s.title}</Text>
            <MarkedLine
              id={s.provider.id}
              label={s.provider.name}
              value={s.provider.role}
              variant={s.provider.variant}
            />
            <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{s.body}</Text>
            {"link" in s ? (
              <View style={styles.link}>
                <Text
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(s.link.url)}
                  style={[TYPE.bodyStrong, { color: color.link }]}
                >
                  {s.link.label}
                </Text>
              </View>
            ) : null}
          </Panel>
        ))}
      </View>
      <View style={styles.section}>
        <SectionHeading>Contact</SectionHeading>
        <Panel>
          <ListRow
            title="Email Senryo"
            detail={SUPPORT_EMAIL}
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
        </Panel>
      </View>
      <View style={styles.section}>
        <SectionHeading>Logos and trademarks</SectionHeading>
        <Text style={[TYPE.meta, { color: color.text3 }]}>{MARKS_CREDIT}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  about: { gap: SPACE.md },
  name: { gap: SPACE.xxs },
  section: { gap: SPACE.md },
  panel: { padding: SPACE.lg, gap: SPACE.sm },
  link: { alignSelf: "flex-start" },
});
