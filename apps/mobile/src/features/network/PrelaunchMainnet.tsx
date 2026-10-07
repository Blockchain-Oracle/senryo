/**
 * What Mainnet shows where real money isn't open yet (S8.22, D-172; A8): one row — Monad's mark, "Opens at launch" and
 * a short line for this screen — and **Use Practice**, then, on Markets and the ticket, the live Chainlink prices on
 * Monad mainnet. No balances or tickets pretend to work, and no paragraphs (D-237 copy budget).
 */

import { MAINNET } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { ids } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { fire } from "~/feedback/fire";
import { setActiveNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { usePrelaunchPrices } from "./usePrelaunchPrices";

const MS_PER_SECOND = 1000;

/** A feed round's unix-seconds timestamp as local clock time (a time, not money). */
function feedTime(updatedSec: bigint): string {
  return new Date(Number(updatedSec) * MS_PER_SECOND).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const LINE = {
  markets: "Perps open at launch",
  trade: "Real-money trading opens soon",
  portfolio: "Practice works today",
  lp: "The pool opens at launch",
} as const;

export function PrelaunchMainnet({ surface }: { surface: keyof typeof LINE }) {
  const { color } = useTheme();
  const prices = usePrelaunchPrices();
  const showPrices = surface === "markets" || surface === "trade";
  return (
    <View style={styles.wrap}>
      <Panel>
        <ListRow
          title="Opens at launch"
          detail={LINE[surface]}
          leading={<EntityMark id={ids.evmChain(MAINNET.chainId)} size={SIZE.markRow} decorative />}
          trailing={
            <Button
              label="Use Practice"
              variant="secondary"
              size="sm"
              block={false}
              onPress={() => {
                fire("tick");
                setActiveNetwork("testnet");
              }}
            />
          }
        />
      </Panel>
      {showPrices ? (
        <View style={styles.prices}>
          <SectionHeading>Oracle prices · Chainlink</SectionHeading>
          <Panel>
            {prices.map((p) => (
              <ListRow
                key={p.symbol}
                title={p.symbol}
                detail={
                  p.price
                    ? `Updated ${feedTime(p.price.updatedAt)}${p.failed ? " · Refresh failed" : ""}`
                    : p.failed
                      ? "Feed could not be reached"
                      : "Reading…"
                }
                trailing={
                  <Text style={[TYPE.rowPrice, { color: color.ink }]}>
                    {p.price ? formatUnits(p.price.answer, p.price.decimals, p.price.shown) : "—"}
                  </Text>
                }
              />
            ))}
          </Panel>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.lg },
  prices: { gap: SPACE.md },
});
