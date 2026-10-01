/**
 * The card's daily spend limit as it stands onchain (the account snapshot's allowance): live — what is left of the
 * limit today and until when it holds; frozen / never set — the card can't spend until a limit is signed; expired —
 * the last limit ran out. A filled cell; tapping it opens the limit page.
 */
import type { AccountSnapshot } from "@senryo/chain";
import { BPS_DENOMINATOR } from "@senryo/core";
import { allowanceState } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { Panel } from "~/components/kit/Surface";
import { usd } from "~/lib/money";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_SECOND = 1000n;

export function SpendLimit({ snapshot }: { snapshot: AccountSnapshot }) {
  const { color } = useTheme();
  const now = BigInt(Date.now()) / MS_PER_SECOND;
  const state = allowanceState(snapshot.allowanceDailyLimit, snapshot.allowanceExpiry, snapshot.allowanceLeft, now);
  if (state.kind !== "live") {
    return (
      <Panel style={styles.cell}>
        <View style={styles.between}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>Spend limit</Text>
          <Text style={[TYPE.rowPrice, { color: color.text3 }]}>{state.kind === "off" ? "Frozen" : "Expired"}</Text>
        </View>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          {state.kind === "off"
            ? "The card can’t spend until you set a daily limit."
            : `Your ${usd(state.dailyLimitUsd6, 0)} daily limit ran out. Set it again to spend.`}
        </Text>
      </Panel>
    );
  }
  const leftBps = (state.leftUsd6 * BPS_DENOMINATOR) / state.dailyLimitUsd6;
  const until = new Date(Number(state.expiresAtSec * MS_PER_SECOND)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  return (
    <Panel style={styles.cell}>
      <View style={styles.between}>
        <Text style={[TYPE.rowTitle, styles.shrink, { color: color.ink }]}>Spend limit · today</Text>
        <Text style={[TYPE.rowPrice, { color: color.ink }]}>
          {usd(state.leftUsd6, 0)} <Text style={{ color: color.text3 }}>of {usd(state.dailyLimitUsd6, 0)}</Text>
        </Text>
      </View>
      <View style={[styles.meter, { backgroundColor: color.raised2 }]}>
        <View style={{ flex: Number(leftBps), backgroundColor: color.gold }} />
        <View style={{ flex: Number(BPS_DENOMINATOR - leftBps) }} />
      </View>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Resets at 00:00 UTC · holds until {until}</Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  cell: { padding: SPACE.lg, gap: SPACE.md },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACE.sm },
  shrink: { flexShrink: 1 },
  meter: { flexDirection: "row", height: SIZE.partitionBar, borderRadius: RADIUS.pill, overflow: "hidden" },
});
