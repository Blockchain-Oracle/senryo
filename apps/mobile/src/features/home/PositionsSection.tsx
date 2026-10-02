import { useAccountRisk, usePositions } from "@senryo/query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ReadingView } from "~/components/kit/states";
import { useAccountRetry } from "~/features/portfolio/account";
import { PositionRow } from "~/features/portfolio/PositionRow";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { usePositionsSummary } from "~/features/portfolio/usePositionsSummary";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { pct, signedUsd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";
import { PositionRowsSkeleton, SectionHeading } from "./HomeParts";

/**
 * Positions on Home (direction §7; Fomo F12's rows, F16's "Positions (0)" and "No positions yet"): a quiet heading
 * with the count, then one bare row per open position in the market-row anatomy — no table, no card around the list.
 * The heading's right side carries what the retired mini-bar showed: total unrealised P&L at the conservative exit
 * and the position closest to liquidation. Loading holds the rows' shape; empty is one quiet line and one action.
 */
/** `bare`: inside Home's tabs — the tab names the section, the summary line stays. */
export function PositionsSection({ bare = false }: { bare?: boolean } = {}) {
  const address = useAccount().hint?.address;
  const positions = usePositions(address);
  const live = useAccountRisk(address, "latest");
  const retry = useAccountRetry();
  const account = live.status === "fresh" || live.status === "stale" ? live.value : undefined;
  if (positions.status === "unknown") {
    return (
      <View style={styles.section}>
        {bare ? null : <SectionHeading title="Positions" />}
        <PositionRowsSkeleton />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <ReadingView reading={positions} retry={retry}>
        {(list) => (
          <>
            {bare ? (
              list.length > 0 ? (
                <Summary />
              ) : null
            ) : (
              <SectionHeading title="Positions" count={list.length} trailing={<Summary />} />
            )}
            {list.length === 0 ? (
              <QuietLine action={{ label: "Explore markets", onPress: () => router.navigate(ROUTES.markets) }}>
                No positions yet
              </QuietLine>
            ) : (
              <View>
                {list.map((p, i) => (
                  <PositionRow key={p.marketId} position={p} account={account} index={i} />
                ))}
              </View>
            )}
          </>
        )}
      </ReadingView>
    </View>
  );
}

/** "+P$115.80 · XAU liq 12% away": the open book at a glance, quiet beside the heading. */
function Summary() {
  const { color } = useTheme();
  const summary = usePositionsSummary();
  if (!summary) return null;
  const n = summary.nearest;
  return (
    <Text style={[TYPE.moneyMeta, styles.summary, { color: color.text3 }]} numberOfLines={1}>
      <Text style={{ color: summary.upnlUsd6 < 0n ? color.down : color.up }}>{signedUsd(summary.upnlUsd6)}</Text>
      {n ? (
        <Text style={n.distanceBps <= 0n ? { color: color.down } : null}>
          {" "}
          · {n.symbol} liq {n.distanceBps <= 0n ? "now" : `${pct(n.distanceBps)} away`}
        </Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.sm },
  summary: { flexShrink: 1, textAlign: "right" },
});
