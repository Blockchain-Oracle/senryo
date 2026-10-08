import { SUPPORT_EMAIL } from "@senryo/api-client";
import { ids } from "@senryo/identity";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { InfoTip } from "~/features/setup/InfoTip";
import { APP } from "~/lib/constants/app";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const SEAL = ids.brand("senryo");

/** The questions people ask first (A10 Help/FAQ); each answer sits behind its ⓘ. */
const FAQ = [
  {
    q: "What is Practice?",
    a: "Practice runs on Monad’s test network with test dollars that have no value. Every call works the same, so you can learn before Real money.",
  },
  {
    q: "Who holds my money?",
    a: "You do. Your account is created from your passkey; Senryo never holds your keys and can’t move your funds or undo a transaction.",
  },
  {
    q: "How do I get back in?",
    a: "Open Senryo on any phone and tap “I have an account”. Your synced passkey opens the same address. Settings → Recovery adds a backup passkey.",
  },
  {
    q: "Why does Face ID ask?",
    a: "One Face ID turns on one-tap calls for a while, within a spending cap; it locks when you leave the app or stop. Sends, withdrawals and security changes always ask for Face ID again. Your passkey is for signing in on a new phone.",
  },
  {
    q: "What does a call cost?",
    a: "Only your stake. Senryo pays the network fee, so you never need MON. The call shows what it pays before you tap.",
  },
] as const;

/** Where every number comes from, with the attribution each source asks for (DB-IP Lite is CC BY 4.0, S8.15). */
const SOURCES = [
  {
    title: "Prices",
    mark: { id: ids.provider("pyth"), variant: "symbol" },
    name: "Pyth",
    about: "Pyth prices draw the chart and settle every call — the same print, verified on Monad.",
  },
  {
    title: "Charts and history",
    mark: { id: ids.provider("envio"), variant: "wordmark" },
    name: "Envio",
    about: "Your calls, results and the leaderboard, indexed by Envio from Monad.",
  },
  {
    title: "Region check",
    mark: { id: ids.provider("db-ip"), variant: "wordmark" },
    name: "IP Geolocation by DB-IP",
    about: "IP Geolocation by DB-IP (db-ip.com), CC BY 4.0 — used only to apply the Real money rules.",
    link: "https://db-ip.com",
  },
] as const;

/** Credits the marks' owners ask for (packages/identity/src/art records each source and licence). */
const MARKS_CREDIT =
  "Asset, network, venue and provider logos are their owners' trademarks, shown only to identify them; no " +
  "endorsement is implied. All trademarks shown are the property of Circle Internet Group, Inc. and/or its " +
  "affiliates (USDC), and of their respective owners. ETH diamond: ethereum.org, CC BY 4.0. Flags: Wikimedia " +
  "Commons, public domain. Passkey icon: Material Symbols by Google, Apache License 2.0.";

/**
 * Help (A10): the seal, version and mode; the first questions as rows with their answers behind an ⓘ; the contact
 * address (App Store 1.2); the data sources with their real marks and attributions; and the logo credits in small print.
 */
export default function HelpScreen() {
  const network = useNetwork();
  const { color } = useTheme();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Help" }} />
      <View style={styles.about}>
        <EntityMark id={SEAL} size={SIZE.avatarLg} variant="symbol" decorative ground={color.ground} />
        <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
          {APP.name}
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          {APP.version} · {network.modeLabel}
        </Text>
      </View>
      <View style={styles.section}>
        <SectionHeading>Questions</SectionHeading>
        <Panel>
          {FAQ.map((item) => (
            <ListRow key={item.q} title={item.q} trailing={<InfoTip title={item.q} body={item.a} />} />
          ))}
        </Panel>
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
        <SectionHeading>Sources</SectionHeading>
        <Panel>
          {SOURCES.map((s) => (
            <ListRow
              key={s.title}
              title={s.title}
              detail={s.name}
              leading={<EntityMark id={s.mark.id} size={SIZE.markRow} variant={s.mark.variant} decorative />}
              trailing={<InfoTip title={s.title} body={s.about} />}
              {...("link" in s ? { onPress: () => void Linking.openURL(s.link) } : {})}
            />
          ))}
        </Panel>
      </View>
      <Text style={[TYPE.meta, { color: color.text3 }]}>{MARKS_CREDIT}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  about: { alignItems: "center", gap: SPACE.xs },
  section: { gap: SPACE.md },
});
