import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel, Rule, SectionLabel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { BPS_DENOMINATOR } from "~/lib/constants/units";
import { pct, usd } from "~/lib/money";
import type { SampleBuckets, SampleMarket } from "~/lib/sample";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { DEFAULT_LEVERAGE, LEVERAGE_DETENTS, PREVIEW_FEE_BPS, PREVIEW_SIZE_USD6 } from "./constants";

const SIDES = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
] as const;
type Side = (typeof SIDES)[number]["value"];

/**
 * The ticket layout (D2): side, size, leverage detents, margin use, summary and the confirm button. In the preview the
 * button opens "Create account to trade" (F03); the keypad, hold-to-confirm, Face ID and execution trace are S8.
 */
export function Ticket({ market, buckets }: { market: SampleMarket; buckets: SampleBuckets }) {
  const { color } = useTheme();
  const [side, setSide] = useState<Side>("long");
  const [leverage, setLeverage] = useState<number>(DEFAULT_LEVERAGE);
  const notional = PREVIEW_SIZE_USD6 * BigInt(leverage);
  const fee = (notional * PREVIEW_FEE_BPS) / BPS_DENOMINATOR;
  const after = buckets.freeToTrade6 - PREVIEW_SIZE_USD6 - fee;
  const useBps = buckets.freeToTrade6 === 0n ? 0n : (PREVIEW_SIZE_USD6 * BPS_DENOMINATOR) / buckets.freeToTrade6;
  const sideTone = (s: Side) => (s === "long" ? color.up : color.down);
  return (
    <Panel style={styles.panel}>
      <Segmented options={SIDES} value={side} onChange={setSide} label="Side" tone={sideTone} />
      <View style={styles.field}>
        <SectionLabel>SIZE (USD)</SectionLabel>
        <View style={[styles.input, { borderColor: color.hairline, backgroundColor: color.ground }]}>
          <Text style={[TYPE.numMd, { color: color.ink }]}>{usd(PREVIEW_SIZE_USD6)}</Text>
        </View>
      </View>
      <View style={styles.field}>
        <View style={styles.between}>
          <SectionLabel>LEVERAGE</SectionLabel>
          <Text style={[TYPE.numSm, { color: color.ink }]}>{leverage}x</Text>
        </View>
        <View style={styles.detents} accessibilityRole="radiogroup" accessibilityLabel="Leverage">
          {LEVERAGE_DETENTS.map((d) => {
            const on = d === leverage;
            return (
              <Pressable
                key={d}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  if (on) return;
                  fire("tick");
                  setLeverage(d);
                }}
                style={[
                  styles.detent,
                  {
                    borderColor: on ? color.primary : color.hairline,
                    backgroundColor: on ? color.upWash : color.ground,
                  },
                ]}
              >
                <Text style={[TYPE.numSm, { color: on ? color.primary : color.inkMuted }]}>{d}x</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.field}>
        <View style={styles.between}>
          <SectionLabel>MARGIN USE</SectionLabel>
          <Text style={[TYPE.numSm, { color: color.warn }]}>{pct(useBps)}</Text>
        </View>
        <View style={[styles.meter, { backgroundColor: color.muted }]}>
          <View style={{ flex: Number(useBps), backgroundColor: color.warn }} />
          <View style={{ flex: Number(BPS_DENOMINATOR - useBps) }} />
        </View>
      </View>
      <Rule />
      <KeyValue label="NOTIONAL" value={usd(notional)} />
      <KeyValue label={`FEE ${PREVIEW_FEE_BPS} BPS`} value={usd(fee)} />
      <KeyValue label="FROM" value="FREE·TRADE" />
      <KeyValue label="AFTER" value={usd(after)} />
      <Button
        label={`${side === "long" ? "Long" : "Short"} ${market.id} ${leverage}x · Face ID`}
        onPress={() => router.push(ROUTES.accountRequired)}
        accessibilityHint="Opens account creation; trading needs an account"
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.md, gap: SPACE.lg },
  field: { gap: SPACE.sm },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: {
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md,
    minHeight: SIZE.touch,
    justifyContent: "center",
  },
  detents: { flexDirection: "row", gap: SPACE.sm },
  detent: {
    flex: 1,
    minHeight: SIZE.touch,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.sm,
  },
  meter: { flexDirection: "row", height: SIZE.partitionBar, borderRadius: RADIUS.sm, overflow: "hidden" },
});
