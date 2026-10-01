/**
 * What Mainnet shows before the mainnet launch (S8.22, D-172): an honest read-only state — live Chainlink prices on
 * Monad mainnet, "trading opens at launch", and one tap back to Practice. No balances or tickets pretend to work.
 */
import { formatUnits } from "@senryo/core";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ListRow } from "~/components/kit/ListRow";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { setActiveNetwork } from "~/lib/network";
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { usePrelaunchPrices } from "./usePrelaunchPrices";

const SHOWN_DECIMALS = 2;
const MS_PER_SECOND = 1000;

/** A feed round's unix-seconds timestamp as local clock time (a time, not money). */
function feedTime(updatedSec: bigint): string {
  return new Date(Number(updatedSec) * MS_PER_SECOND).toLocaleTimeString();
}

const COPY = {
  markets: "Prices are live from Chainlink on Monad mainnet. Trading with real money opens at launch.",
  trade: "Real-money trading opens at launch. Until then, practice the same trade with paper money.",
  portfolio: "Your real-money account appears here when mainnet opens. Practice keeps working meanwhile.",
  lp: "The mainnet liquidity pool opens at launch.",
} as const;

export function PrelaunchMainnet({ surface }: { surface: keyof typeof COPY }) {
  const { color } = useTheme();
  const prices = usePrelaunchPrices();
  const showPrices = surface === "markets" || surface === "trade";
  return (
    <View style={styles.wrap}>
      <View style={[styles.banner, { borderColor: color.mainnet, backgroundColor: color.mainnetWash }]}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Mainnet · Real money opens at launch</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{COPY[surface]}</Text>
        <Button
          label="Switch to Practice"
          variant="outline"
          onPress={() => {
            fire("tick");
            setActiveNetwork("testnet");
          }}
        />
      </View>
      {showPrices ? (
        <Panel>
          <SectionLabel>LIVE ON MONAD MAINNET · CHAINLINK</SectionLabel>
          {prices.map((p, i) => (
            <ListRow
              key={p.symbol}
              first={i === 0}
              title={`${p.symbol} · ${p.name}`}
              detail={p.price ? `Updated ${feedTime(p.price.updatedAt)}` : "Reading the feed…"}
              trailing={
                <Text style={[TYPE.numSm, { color: color.ink }]}>
                  {p.price ? formatUnits(p.price.answer, p.price.decimals, SHOWN_DECIMALS) : "—"}
                </Text>
              }
            />
          ))}
        </Panel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  banner: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, padding: SPACE.md, gap: SPACE.sm },
});
