/**
 * The own profile's Positions · Trades (F2 step 5; Fomo F16 "Positions (0)"): underline tabs over the open positions
 * (Home's rows) and the account's own trades from its indexed history — private ones included; when trades aren't
 * shared on this network, one quiet line says so above them ("Trades private on Mainnet").
 */
import type { Address } from "@senryo/account";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { PositionsSection } from "~/features/home/PositionsSection";
import { ActivityRow } from "~/features/portfolio/ActivityRow";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { useActivity } from "~/features/portfolio/useActivity";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useOwnProfile } from "./useOwnProfile";

type Tab = "positions" | "trades";
const TABS = [
  { value: "positions", label: "Positions" },
  { value: "trades", label: "Trades" },
] as const;
const TRADE_KINDS = ["TRADE", "TRIGGER_EXECUTED", "LIQUIDATION"] as const;
const TRADE_ROWS = 10;
const LOADING_KEYS = ["a", "b", "c"] as const;

export function ProfileTabs({ address }: { address: Address }) {
  const [tab, setTab] = useState<Tab>("positions");
  return (
    <View style={styles.stack}>
      <UnderlineTabs options={TABS} value={tab} onChange={setTab} label="Positions and trades" />
      {tab === "positions" ? <PositionsSection bare /> : <Trades address={address} />}
    </View>
  );
}

function Trades({ address }: { address: Address }) {
  const { color } = useTheme();
  const network = useNetwork();
  const { profile } = useOwnProfile();
  const { reading } = useActivity(address, TRADE_KINDS);
  const own = profile.kind === "ready" ? profile.own : undefined;
  const shared = own ? (network.key === "mainnet" ? own.publicTradesMainnet : own.publicTradesPractice) : undefined;
  const rows =
    reading.status === "fresh" || reading.status === "stale" ? reading.value.slice(0, TRADE_ROWS) : undefined;
  return (
    <View style={styles.list}>
      {shared === false ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Trades private on {network.modeLabel}</Text>
      ) : null}
      {reading.status === "unknown"
        ? LOADING_KEYS.map((key) => <Skeleton key={key} height={SIZE.rowMinHeight - SPACE.sm} />)
        : null}
      {reading.status === "failed" ? <QuietLine>Couldn’t load trades</QuietLine> : null}
      {rows && rows.length === 0 ? (
        <QuietLine action={{ label: "Explore markets", onPress: () => router.navigate(ROUTES.markets) }}>
          No trades yet
        </QuietLine>
      ) : null}
      {rows?.map((row) => (
        <ActivityRow key={row.id} row={row} />
      ))}
      {rows && rows.length >= TRADE_ROWS ? (
        <Button label="All activity" variant="ghost" onPress={() => router.push(ROUTES.activity)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  list: { gap: SPACE.xs },
});
