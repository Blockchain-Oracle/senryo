/**
 * F12 on the portfolio: (1) liquidation risk — maintenance margin ÷ liquidation equity in the danger band → "Add money
 * or reduce" with both actions; (2) a held market's price paused (STALE/CIRCUIT/HALTED) → "liquidations paused" so a
 * frozen number isn't read as safety; (3) a liquidation in the last week → the post-mortem (positions closed, penalty,
 * realised, tx), the `liquidation` haptic once, dismissible. All from the chain + indexer, nothing inferred.
 */
import { PAUSED_STATUSES, RISK } from "@senryo/core";
import { useAccountRisk, useMarkets, usePositions, useQueryEnv, useRecentLiquidations } from "@senryo/query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { GAUGE_DANGER_BPS } from "~/components/trade/MarginGauge";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { positionRoute, ROUTES } from "~/lib/constants/routes";
import { shortAddress } from "~/lib/format";
import { pct, signedUsd, usd } from "~/lib/money";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { LIQUIDATION_WINDOW_SEC } from "./constants";

export function RiskBanner() {
  const { color } = useTheme();
  // Seen/dismissed liquidation ids are kept per network (S8.22): a practice notice never hides a mainnet one.
  const env = useQueryEnv();
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "latest");
  const positions = usePositions(address);
  const markets = useMarkets();
  const liqs = useRecentLiquidations(address, LIQUIDATION_WINDOW_SEC);
  const [dismissed, setDismissed] = useState(() =>
    storage.getString(`${STORAGE_KEYS.liquidationDismissed}:${env.chainId}`),
  );
  const latest = liqs.status === "fresh" || liqs.status === "stale" ? liqs.value[0] : undefined;

  useEffect(() => {
    if (!latest || storage.getString(`${STORAGE_KEYS.liquidationSeen}:${env.chainId}`) === latest.id) return;
    storage.set(`${STORAGE_KEYS.liquidationSeen}:${env.chainId}`, latest.id);
    fire("liquidation");
  }, [latest]);

  const s = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const held = positions.status === "fresh" || positions.status === "stale" ? positions.value : [];
  const usage = s && s.positionBitmap !== 0 ? (s.equityLiq <= 0n ? RISK.BPS : (s.mm * RISK.BPS) / s.equityLiq) : 0n;
  const danger = usage >= GAUGE_DANGER_BPS;
  const paused = held
    .map((p) =>
      markets.find(
        (m) =>
          (m.reading.status === "fresh" || m.reading.status === "stale") && m.reading.value.marketId === p.marketId,
      ),
    )
    .flatMap((m) => (m && (m.reading.status === "fresh" || m.reading.status === "stale") ? [m.reading.value] : []))
    .filter((m) => PAUSED_STATUSES.has(m.pv.status));
  const nearest = held[0];

  return (
    <>
      {danger ? (
        <View
          style={[styles.box, { borderColor: color.down, backgroundColor: color.downWash }]}
          accessibilityLiveRegion="assertive"
        >
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Liquidation risk · margin use {pct(usage)}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            At 100 % your positions are closed with a {pct(RISK.LIQ_PENALTY_BPS)} penalty. Add money or reduce.
          </Text>
          <View style={styles.actions}>
            <Button label="Add money" size="sm" block={false} onPress={() => router.push(ROUTES.addMoney)} />
            {nearest ? (
              <Button
                label="Reduce"
                size="sm"
                variant="outline"
                block={false}
                onPress={() => router.push(positionRoute(String(nearest.marketId)))}
              />
            ) : null}
          </View>
        </View>
      ) : null}
      {paused.length > 0 ? (
        <View style={[styles.box, { borderColor: color.hairline, backgroundColor: color.warnWash }]}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
            {paused.map((m) => m.name).join(", ")} price paused · liquidations paused
          </Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            Closing still works at the conservative price; opens and liquidations resume when the price confirms.
          </Text>
        </View>
      ) : null}
      {latest && latest.id !== dismissed ? (
        <View style={[styles.box, { borderColor: color.hairline, backgroundColor: color.card }]}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
            Liquidated · {latest.positionsClosed} {latest.positionsClosed === 1 ? "position" : "positions"} closed
          </Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            Realised {signedUsd(latest.realizedPnl)} · penalty {usd(latest.penalty)} · what remains stays in your
            balance · tx {shortAddress(latest.txHash)}
          </Text>
          <View style={styles.actions}>
            <Button
              label="Got it"
              size="sm"
              variant="outline"
              block={false}
              onPress={() => {
                storage.set(`${STORAGE_KEYS.liquidationDismissed}:${env.chainId}`, latest.id);
                setDismissed(latest.id);
              }}
            />
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, padding: SPACE.md, gap: SPACE.xs },
  actions: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.xs },
});
