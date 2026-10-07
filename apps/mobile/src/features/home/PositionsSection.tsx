import type { PositionView } from "@senryo/chain";
import { isDeployed } from "@senryo/chain";
import type { Reading } from "@senryo/core";
import { useAccountRisk, usePerplAccount, usePositions, useQueryEnv } from "@senryo/query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ErrorState } from "~/components/kit/states";
import { PerplBalanceRow, PerplPositionRow } from "~/features/perpl/PerplPositionRow";
import { useAccountRetry } from "~/features/portfolio/account";
import { PositionRow } from "~/features/portfolio/PositionRow";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { usePositionsSummary } from "~/features/portfolio/usePositionsSummary";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { pct, signedUsd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";
import { PositionRowsSkeleton, SectionHeading } from "./HomeParts";

/** No engine on this network (Mainnet before the deploy): an empty book, not an error or a skeleton. */
const NONE: Reading<PositionView[]> = { status: "fresh", value: [], at: 0 };

/**
 * Positions on Home (direction §7; Fomo F12's rows, F16's "Positions (0)" and "No positions yet"): a quiet heading
 * with the count, then one bare row per open position in the market-row anatomy — our engine's where it is deployed,
 * then Perpl's on Mainnet (venue badge on the mark, flow book C4 "After") and AUSD left free on Perpl with the way
 * back. The heading's right side carries the total unrealised P&L and the engine position closest to liquidation.
 * Loading holds the rows' shape; empty is one quiet line and one action.
 */
/** `bare`: inside Home's tabs — the tab names the section, the summary line stays. */
export function PositionsSection({ bare = false }: { bare?: boolean } = {}) {
  const env = useQueryEnv();
  const address = useAccount().hint?.address;
  const coreReady = isDeployed(env.chainId, "SenryoCore");
  const engine = usePositions(coreReady ? address : undefined);
  const live = useAccountRisk(coreReady ? address : undefined, "latest");
  const perpl = usePerplAccount(address);
  const retry = useAccountRetry();
  const account = live.status === "fresh" || live.status === "stale" ? live.value : undefined;
  const ours = coreReady ? engine : NONE;
  const theirs = perpl.status === "fresh" || perpl.status === "stale" ? perpl.value : undefined;
  const perplLoading = address !== undefined && perpl.status === "unknown";
  if (ours.status === "unknown" || perplLoading) {
    return (
      <View style={styles.section}>
        {bare ? null : <SectionHeading title="Positions" />}
        <PositionRowsSkeleton />
      </View>
    );
  }
  if (ours.status === "failed") {
    return (
      <View style={styles.section}>
        <ErrorState diagnosis={ours.error} retry={retry} />
      </View>
    );
  }
  const list = ours.value;
  const perplPositions = theirs?.positions ?? [];
  const free = theirs?.account?.availableCNS ?? 0n;
  const count = list.length + perplPositions.length;
  const perplPnl = perplPositions.reduce((sum, p) => sum + p.pnlCNS, 0n);
  return (
    <View style={styles.section}>
      {bare ? (
        count > 0 ? (
          <Summary perplPnl={perplPnl} hasPerpl={perplPositions.length > 0} />
        ) : null
      ) : (
        <SectionHeading
          title="Positions"
          count={count}
          trailing={<Summary perplPnl={perplPnl} hasPerpl={perplPositions.length > 0} />}
        />
      )}
      {count === 0 && free === 0n ? (
        perpl.status === "failed" ? (
          <ErrorState diagnosis={perpl.error} retry={retry} />
        ) : (
          <QuietLine action={{ label: "Explore markets", onPress: () => router.navigate(ROUTES.markets) }}>
            No positions yet
          </QuietLine>
        )
      ) : (
        <View>
          {list.map((p, i) => (
            <PositionRow key={p.marketId} position={p} account={account} index={i} />
          ))}
          {perplPositions.map((p, i) => (
            <PerplPositionRow key={`perpl-${p.marketId}`} position={p} index={list.length + i} />
          ))}
          {free > 0n ? <PerplBalanceRow freeCNS={free} index={count} /> : null}
        </View>
      )}
    </View>
  );
}

/** "+P$115.80 · XAU liq 12% away": the open book at a glance, quiet beside the heading (Perpl's P&L included). */
function Summary({ perplPnl, hasPerpl }: { perplPnl: bigint; hasPerpl: boolean }) {
  const { color } = useTheme();
  const summary = usePositionsSummary();
  if (!summary && !hasPerpl) return null;
  const total = (summary?.upnlUsd6 ?? 0n) + perplPnl;
  const n = summary?.nearest;
  return (
    <Text style={[TYPE.moneyMeta, styles.summary, { color: color.text3 }]} numberOfLines={1}>
      <Text style={{ color: total < 0n ? color.down : color.up }}>{signedUsd(total)}</Text>
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
