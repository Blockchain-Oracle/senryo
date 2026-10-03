import { DECIMALS, formatUnits, RISK } from "@senryo/core";
import { stepsLine, TRADE_SLIPPAGE_BPS } from "@senryo/query";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { Check } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { DetailRow } from "~/features/markets/Disclosure";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { fire } from "~/feedback/fire";
import { pct, price18, priceDecimalsOf, usd } from "~/lib/money";
import { BUTTON, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { type CandlePalette, type CandleStyle, saveCandleStyle, useCandleStyle } from "./candle-style";
import { quantityText } from "./quantity";
import { borrowApr, fundingForSide, marketRates } from "./rates";
import type { useTicket } from "./useTicket";

type TicketModel = ReturnType<typeof useTicket>;

/**
 * Liquidation info (F43; flow book C3a): what the liquidation price means, said for the side being entered — below
 * the entry for a long, above it for a short — with this order's own level when there is one. The parent ticket stays
 * behind it, values kept (FT112).
 */
export function LiquidationInfo({
  open,
  onClose,
  t,
  line,
}: {
  open: boolean;
  onClose: () => void;
  t: TicketModel;
  line: MarketLine;
}) {
  const { color } = useTheme();
  const liq = t.preview?.liqPrice18;
  const away = t.preview?.liqDistanceBps;
  const long = t.side === "long";
  return (
    <ChildSheet open={open} onClose={onClose} title="Liquidation price">
      <Text style={[TYPE.body, styles.centerText, { color: color.text2 }]}>
        If {line.symbol} {long ? "falls" : "rises"} to this price, the position closes and its margin is lost, plus a 1%
        fee. It moves as funding and borrow accrue.
      </Text>
      {liq !== undefined && liq !== null && away !== undefined && away !== null ? (
        <DetailRow
          label={`${long ? "Long" : "Short"} ${t.leverage}×`}
          value={`$${price18(liq, priceDecimalsOf(line.marketId))} · ${pct(away < 0n ? -away : away)} ${away < 0n ? "past" : "away"}`}
        />
      ) : null}
      <Button label="Close" variant="secondary" onPress={onClose} />
    </ChildSheet>
  );
}

/**
 * Details (flow book C3 step 5; plan §0.9 Ticket "Details"): the order's every number as quiet rows — fee, spread,
 * impact and the estimated fill; funding ("You pay / receive …") and borrow; the acceptable price (fill ± 0.5 %,
 * a 120 s quote); liquidation, what stays locked and the buying power after. With a screen reader on it also carries
 * an explicit "Open long" button that runs the same confirm path as the slide (risk explainer and fees included).
 */
export function TicketDetails({
  open,
  onClose,
  t,
  line,
  canOpen,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  t: TicketModel;
  line: MarketLine;
  canOpen: boolean;
  onOpen: () => void;
}) {
  const { color } = useTheme();
  const screenReader = useScreenReader();
  const p = t.preview;
  const decimals = priceDecimalsOf(line.marketId);
  const long = t.side === "long";
  const rates = marketRates(line.market);
  const acceptable = p
    ? long
      ? (p.execPrice18 * (RISK.BPS + TRADE_SLIPPAGE_BPS)) / RISK.BPS
      : (p.execPrice18 * (RISK.BPS - TRADE_SLIPPAGE_BPS)) / RISK.BPS
    : undefined;
  const price = (v: bigint) => `$${price18(v, decimals)}`;
  return (
    <ChildSheet
      open={open}
      onClose={onClose}
      title="Details"
      subtitle={`${long ? "Long" : "Short"} ${line.symbol} · ${t.leverage}×`}
    >
      <View>
        <DetailRow label="Margin" value={usd(t.amountUsd6)} />
        <DetailRow label="Leveraged size" value={usd(t.notionalUsd6)} />
        {p ? <DetailRow label="Quantity" value={quantityText(line.marketId, p.sizeDelta)} /> : null}
        {p ? <DetailRow label="Estimated fill" value={price(p.execPrice18)} /> : null}
        {acceptable !== undefined ? (
          <DetailRow label="Acceptable price" value={`${long ? "≤" : "≥"} ${price(acceptable)} · 120 s`} />
        ) : null}
        {p ? <DetailRow label="Fee" value={`${usd(p.feeUsd6)} · ${bpsPct(line.market.risk.feeBps)}`} /> : null}
        <DetailRow label="Spread now" value={bpsPct(line.market.pv.spreadBps)} />
        {p ? <DetailRow label="Impact" value={pct(p.impactBps)} /> : null}
        <DetailRow
          label="Funding now"
          value={line.status === "OPEN" ? fundingForSide(rates, long) : "Paused while closed"}
        />
        <DetailRow label="Borrow" value={borrowApr(rates)} />
        {p ? (
          <DetailRow
            label="Liquidation"
            value={p.liqPrice18 === null ? "None" : price(p.liqPrice18)}
            tone={color.ink}
          />
        ) : null}
        {p ? <DetailRow label="Locked while open" value={usd(p.marginUsd6)} /> : null}
        {p ? <DetailRow label="Buying power after" value={usd(p.freeToTradeAfter)} /> : null}
        {t.pay.labels.length > 0 ? (
          <DetailRow label="Steps" value={stepsLine([...t.pay.labels, "Open"].map((label) => ({ label })))} />
        ) : null}
      </View>
      {screenReader ? <Button label={`Open ${long ? "long" : "short"}`} disabled={!canOpen} onPress={onOpen} /> : null}
      <Button label="Back to order" variant="ghost" onPress={onClose} />
    </ChildSheet>
  );
}

/** 5 bps → "0.05%". */
const bpsPct = (bps: bigint) => `${formatUnits(bps, DECIMALS.bpsAsPct, DECIMALS.cents)}%`;

function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setOn);
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setOn);
    return () => sub.remove();
  }, []);
  return on;
}

const PALETTES: ReadonlyArray<{ value: CandlePalette; label: string }> = [
  { value: "greenRed", label: "Green / red" },
  { value: "cyanRose", label: "Cyan / rose" },
];

/**
 * Candle settings (FT106/C41, F40; Codex S1b.7 consult #10): body on/off, the colour pair, colour by previous close —
 * Cancel discards, Save persists. Candle borders are listed as unavailable rather than offered and ignored. Options are
 * rows separated by their own height; the colour pair is two borderless plates, the chosen one filled and checked.
 */
export function CandleSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { color } = useTheme();
  const saved = useCandleStyle();
  const [draft, setDraft] = useState<CandleStyle>(saved);
  const set = (patch: Partial<CandleStyle>) => {
    fire("tick");
    setDraft((d) => ({ ...d, ...patch }));
  };
  const close = () => {
    setDraft(saved);
    onClose();
  };
  const swatch = (palette: CandlePalette) =>
    palette === "cyanRose" ? [color.chart3, color.chart4] : [color.chartUp, color.chartCandleDown];
  return (
    <ChildSheet open={open} onClose={close} title="Candles">
      <Toggle
        label="Colour bars by previous close"
        value={draft.previousClose}
        onChange={(v) => set({ previousClose: v })}
      />
      <Toggle label="Body" value={draft.body} onChange={(v) => set({ body: v })} />
      <View style={styles.optionRow}>
        <Text style={[TYPE.row, { color: color.text3 }]}>Borders</Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Unavailable</Text>
      </View>
      <View style={styles.palettes} accessibilityRole="radiogroup" accessibilityLabel="Up and down colours">
        {PALETTES.map((p) => {
          const [up, down] = swatch(p.value);
          return (
            <PaletteOption
              key={p.value}
              label={p.label}
              up={up}
              down={down}
              on={draft.palette === p.value}
              onPress={() => set({ palette: p.value })}
            />
          );
        })}
      </View>
      <View style={styles.actions}>
        <Button label="Cancel" variant="outline" style={styles.flex} onPress={close} />
        <Button
          label="Save"
          style={styles.flex}
          onPress={() => {
            saveCandleStyle(draft);
            onClose();
          }}
        />
      </View>
    </ChildSheet>
  );
}

/** One colour pair: the chosen one is a filled plate with a check (never fill alone), the other a bare label. */
function PaletteOption({
  label,
  up,
  down,
  on,
  onPress,
}: {
  label: string;
  up: string | undefined;
  down: string | undefined;
  on: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={[styles.flex, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={label}
        style={[styles.palette, { backgroundColor: on ? color.raised2 : color.transparent }]}
      >
        <View style={[styles.swatch, { backgroundColor: up }]} />
        <View style={[styles.swatch, { backgroundColor: down }]} />
        <Text style={[TYPE.chipCategory, styles.flex, { color: on ? color.ink : color.text3 }]} numberOfLines={1}>
          {label}
        </Text>
        {on ? <Check size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.link} /> : null}
      </Pressable>
    </Animated.View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.optionRow}>
      <Text style={[TYPE.row, { color: color.ink }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: color.primary, false: color.raised2 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centerText: { textAlign: "center" },
  optionRow: {
    minHeight: SIZE.touch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.md,
  },
  palettes: { flexDirection: "row", gap: SPACE.sm },
  palette: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    minHeight: SIZE.touch,
    paddingHorizontal: SPACE.md,
    borderRadius: BUTTON.radius.sm,
  },
  swatch: { width: SIZE.markChip, height: SIZE.markChip, borderRadius: RADIUS.xs },
  actions: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
});
