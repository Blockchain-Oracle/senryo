import { engineMarketsOn } from "@senryo/config";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { EngineMarketRow } from "~/features/markets/MarketRow";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * Home without an account (review R14): something worth looking at — the listed markets at their oracle prices (each row says how old its price is),
 * each opening its detail — and one invitation tied to what an account gives here (practice money to start with, or
 * real trading on Mainnet). One account action on the screen; the session chip only says "Browsing".
 */
export function GuestHome() {
  const { color } = useTheme();
  const network = useNetwork();
  const practice = network.key === "testnet";
  const markets = engineMarketsOn(network.chainId);
  return (
    <>
      <Panel style={styles.invite}>
        <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
          {practice ? "Start with paper money" : "Trade with one account"}
        </Text>
        <Text style={[TYPE.body, { color: color.text2 }]}>
          {practice
            ? "Claim paper money and practice at live market prices."
            : "Your assets, trades and card in one account."}
        </Text>
        <Button
          label="Create account"
          leading={<PasskeyGlyph color={color.primaryForeground} />}
          onPress={() => router.push(ROUTES.accountRequired)}
        />
      </Panel>
      {markets.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
              Markets now
            </Text>
            <Text style={[TYPE.meta, { color: color.text3 }]}>Oracle prices</Text>
          </View>
          <View>
            {markets.map((m) => (
              <EngineMarketRow key={m.id} marketId={m.id} />
            ))}
          </View>
          <Button label="See all markets" variant="ghost" onPress={() => router.navigate(ROUTES.markets)} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  invite: { padding: SPACE.lg, gap: SPACE.md },
  section: { gap: SPACE.sm },
  heading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm },
});
