import { DECIMALS, formatUnits } from "@senryo/core";
import { Info } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { KeyValue } from "~/components/kit/Surface";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { fire } from "~/feedback/fire";
import { pct, price18, priceDecimalsOf, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { type CandlePalette, type CandleStyle, saveCandleStyle, useCandleStyle } from "./candle-style";
import { QUANTITY_DECIMALS } from "./constants";
import type { useTicket } from "./useTicket";

type TicketModel = ReturnType<typeof useTicket>;

/**
 * Liquidation info (FT109/C42, F43): what the liquidation price means on Senryo's engine, with this order's own numbers
 * when there are some. The parent ticket stays behind it, values kept (FT112).
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
  const side = t.side === "long" ? "long" : "short";
  return (
    <ChildSheet open={open} onClose={onClose} title="Liquidation price">
      <View style={styles.center}>
        <Info size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text2} />
      </View>
      <Text style={[TYPE.body, styles.centerText, { color: color.text2 }]}>
        If the oracle price reaches this level, your position closes automatically and you lose the margin backing it,
        plus a liquidation fee.
      </Text>
      <Text style={[TYPE.body, styles.centerText, { color: color.text2 }]}>
        The level moves after you open: funding and borrow accrue over time, and your other positions share the same
        margin.
      </Text>
      {liq !== undefined && liq !== null && away !== undefined && away !== null ? (
        <Text style={[TYPE.meta, styles.centerText, { color: color.text3 }]}>
          This order: {line.symbol} {side} at {t.leverage}× would liquidate at $
          {price18(liq, priceDecimalsOf(line.marketId))}, {pct(away < 0n ? -away : away)} {away < 0n ? "past" : "from"}{" "}
          the oracle price.
        </Text>
      ) : null}
      <Button label="Close" variant="secondary" onPress={onClose} />
    </ChildSheet>
  );
}

/**
 * The explicit review (D-177's accessible alternative, Codex S1b.7 consult #4): every number of the order and an
 * "Open Long/Short" button that runs the same confirm path as the hold (risk introduction and gas handling included).
 */
export function ReviewOrder({
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
  const network = useNetwork();
  const p = t.preview;
  const decimals = priceDecimalsOf(line.marketId);
  const sideWord = t.side === "long" ? "Long" : "Short";
  return (
    <ChildSheet open={open} onClose={onClose} title="Review order" subtitle={`${network.modeLabel} · ${network.name}`}>
      <View>
        <KeyValue label="Market" value={`${line.symbol} · ${line.name} · Senryo`} />
        <KeyValue label="Side" value={sideWord} />
        <KeyValue label="Margin" value={usd(p?.marginUsd6 ?? 0n)} />
        <KeyValue label="Leverage" value={`${t.leverage}×`} />
        <KeyValue label="Exposure" value={usd(t.notionalUsd6)} />
        <KeyValue
          label="Quantity"
          value={p ? `${formatUnits(p.sizeDelta, DECIMALS.e18, QUANTITY_DECIMALS)} ${line.symbol}` : "—"}
        />
        <KeyValue label="Estimated fill" value={p ? `$${price18(p.execPrice18, decimals)}` : "—"} />
        <KeyValue label="Fee" value={p ? usd(p.feeUsd6) : "—"} />
        <KeyValue
          label="Liquidation"
          value={p?.liqPrice18 === null ? "None above $0" : p ? `$${price18(p.liqPrice18, decimals)}` : "—"}
        />
        <KeyValue label="Free to trade after" value={p ? usd(p.freeToTradeAfter) : "—"} />
      </View>
      <Button label={`Open ${sideWord}`} disabled={!canOpen} onPress={onOpen} />
      <Button label="Back to order" variant="ghost" onPress={onClose} />
    </ChildSheet>
  );
}

const PALETTES: ReadonlyArray<{ value: CandlePalette; label: string }> = [
  { value: "greenRed", label: "Green / red" },
  { value: "cyanRose", label: "Cyan / rose" },
];

/**
 * Candle settings (FT106/C41, F40; Codex S1b.7 consult #10): body on/off, the colour pair, colour by previous close —
 * Cancel discards, Save persists. Borders are listed as unavailable rather than offered and ignored.
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
      <View style={[styles.optionRow, { borderColor: color.border }]}>
        <Text style={[TYPE.row, { color: color.text3 }]}>Borders</Text>
        <Text style={[TYPE.meta, { color: color.text3 }]}>Unavailable</Text>
      </View>
      <View style={styles.palettes} accessibilityRole="radiogroup" accessibilityLabel="Up and down colours">
        {PALETTES.map((p) => {
          const on = draft.palette === p.value;
          const [up, down] = swatch(p.value);
          return (
            <Pressable
              key={p.value}
              onPress={() => set({ palette: p.value })}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.label}
              style={[styles.palette, { borderColor: on ? color.link : color.border }]}
            >
              <View style={[styles.swatch, { backgroundColor: up }]} />
              <View style={[styles.swatch, { backgroundColor: down }]} />
              <Text style={[TYPE.meta, { color: color.ink }]}>{p.label}</Text>
            </Pressable>
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

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { color } = useTheme();
  return (
    <View style={[styles.optionRow, { borderColor: color.border }]}>
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
  center: { alignItems: "center" },
  centerText: { textAlign: "center" },
  optionRow: {
    minHeight: SIZE.touch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: HAIRLINE_PX,
  },
  palettes: { flexDirection: "row", gap: SPACE.sm },
  palette: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    minHeight: SIZE.touch,
    paddingHorizontal: SPACE.md,
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.sm,
  },
  swatch: { width: SIZE.markChip, height: SIZE.markChip, borderRadius: RADIUS.xs },
  actions: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
});
