import { blockerCopy, ONE_USD6 } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { Panel, Rule, SectionLabel } from "~/components/kit/Surface";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { Keypad } from "~/components/trade/Keypad";
import { LeverageSlider } from "~/components/trade/LeverageSlider";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { DISABLED_OPACITY, HAIRLINE_PX, HERO_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { AMOUNT_CHIPS_USD } from "./constants";
import { TicketSummary } from "./TicketSummary";
import { TradeTrace } from "./TradeTrace";
import { type Side, useTicket } from "./useTicket";

const SIDES = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
] as const;

/**
 * The F10 ticket (D2): side, margin amount (keypad + $10/$25/$50/MAX chips), leverage (slider with detents), live
 * notional/fee/margin/after/liquidation beside the margin gauge, the first blocker with its fix, then hold 500 ms →
 * the execution trace. First leveraged trade → the three-card risk explainer before anything is signed.
 */
export function Ticket({ market }: { market: LiveMarket }) {
  const { color } = useTheme();
  const t = useTicket(market);
  const sideTone = (s: Side) => (s === "long" ? color.up : color.down);

  if (t.trace.events.length > 0) {
    return <TradeTrace events={t.trace.events} running={t.trace.running} onDone={() => t.trace.reset()} />;
  }

  const copy = t.blocker ? blockerCopy(t.blocker, market.name, t.nowSec) : undefined;
  const holdLabel = `Hold · ${t.side === "long" ? "Long" : "Short"} ${market.symbol} ${t.leverage}×`;
  const confirm = () => {
    if (!(storage.getBoolean(STORAGE_KEYS.riskExplained) ?? false)) {
      router.push(ROUTES.riskExplainer);
      return;
    }
    void t.submit();
  };

  return (
    <Panel style={styles.panel}>
      <Segmented options={SIDES} value={t.side} onChange={t.setSide} label="Side" tone={sideTone} />

      <View style={styles.field}>
        <View style={styles.between}>
          <SectionLabel>MARGIN (USD)</SectionLabel>
          <Text style={[TYPE.label, { color: color.inkMuted }]}>
            FREE·TRADE {t.snapshot ? usd(t.snapshot.freeToTrade) : "—"}
          </Text>
        </View>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          style={[TYPE.numXl, { color: t.amountText === "" ? color.inkMuted : color.ink }]}
          accessibilityLabel={`Margin ${t.amountText === "" ? "not set" : `${t.amountText} dollars`}`}
        >
          ${t.amountText === "" ? "0" : t.amountText}
        </Text>
        <View style={styles.chips}>
          {AMOUNT_CHIPS_USD.map((c) => (
            <Chip key={String(c)} label={`$${c}`} onPress={() => t.setAmountUsd6(c * ONE_USD6)} />
          ))}
          <Chip label="MAX" disabled={t.maxAmountUsd6 === 0n} onPress={() => t.setAmountUsd6(t.maxAmountUsd6)} />
        </View>
        <Keypad onKey={t.onKey} />
      </View>

      <View style={styles.field}>
        <View style={styles.between}>
          <SectionLabel>LEVERAGE</SectionLabel>
          <Text style={[TYPE.numSm, { color: color.ink }]}>{t.leverage}×</Text>
        </View>
        <LeverageSlider value={t.leverage} max={market.maxLeverageX} onChange={t.setLeverage} />
      </View>

      <Rule />
      <TicketSummary
        notionalUsd6={t.notionalUsd6}
        preview={t.preview}
        freeToTradeUsd6={t.snapshot?.freeToTrade}
        feeBps={market.risk.feeBps}
      />

      {copy ? (
        <View
          style={[styles.blocker, { borderColor: color.hairline, backgroundColor: color.warnWash }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{copy.title}</Text>
          {copy.action ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{copy.action}</Text> : null}
        </View>
      ) : null}

      {!t.hasAccount ? (
        <Button label="Create account to trade" onPress={() => router.push(ROUTES.accountRequired)} />
      ) : t.blocker?.code === "INSUFFICIENT_FREE" ? (
        <Button label="Add money" onPress={() => router.push(ROUTES.addMoney)} />
      ) : (
        <HoldToConfirm
          label={holdLabel}
          disabled={t.blocker !== undefined || t.preview === undefined || !t.ready}
          onConfirm={confirm}
          accessibilityHint="Hold for half a second to place the trade"
        />
      )}
    </Panel>
  );
}

function Chip({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.chip,
        { borderColor: color.hairline, backgroundColor: pressed ? color.muted : color.ground },
        disabled ? { opacity: DISABLED_OPACITY } : null,
      ]}
    >
      <Text style={[TYPE.numSm, { color: color.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.md, gap: SPACE.lg },
  field: { gap: SPACE.sm },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chips: { flexDirection: "row", gap: SPACE.sm },
  chip: {
    flex: 1,
    minHeight: SIZE.buttonHeightSm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.sm,
  },
  blocker: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, padding: SPACE.md, gap: SPACE.xxs },
});
