import { DECIMALS, formatUnits } from "@senryo/core";
import { ids } from "@senryo/identity";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel, SectionLabel } from "~/components/kit/Surface";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { MarginGauge } from "~/components/trade/MarginGauge";
import { STATUS_CHIP, STATUS_LABEL, statusTone } from "~/features/markets/session";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { TradeTrace } from "~/features/trade/TradeTrace";
import { pct, price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { BLOCK_MS_ESTIMATE, REDUCE_ALL_BPS, REDUCE_STEPS_BPS } from "./constants";
import { TriggerPanel } from "./TriggerPanel";
import { usePosition } from "./usePosition";

const SIZE_DECIMALS = 4;
const GAUGE_WIDTH = 132;
const MS_PER_SECOND = 1000n;
const STEP_LABEL = (bps: bigint) => (bps >= REDUCE_ALL_BPS ? "All" : pct(bps));

/**
 * F11 / F12: the position — PnL at the conservative exit with the funding/borrow breakdown, size, entry, mark,
 * liquidation price and how far away, margin use — and the reduce ticket (25/50/75 % / all) behind a hold. Two
 * borderless filled groups; the breakdown and the facts are separated by spacing, not a rule.
 * Reducing works in every session status (closed/paused use the status-matrix price, explained).
 */
export function PositionDetail({ marketId }: { marketId: number }) {
  const network = useNetwork();
  const { color } = useTheme();
  const p = usePosition(marketId);
  const outcome = useSettledOutcome(p.trace.events);
  if (p.trace.events.length > 0) {
    return (
      <TradeTrace
        events={p.trace.events}
        running={p.trace.running}
        outcome={outcome}
        onDone={() => p.trace.reset()}
        onLeave={() => router.back()}
      />
    );
  }
  if (p.loading) return <LoadingState shape="plate" label="Reading the position" />;
  if (!p.position || !p.market || !p.health) {
    return <EmptyState why="No open position in this market" detail="It may have just closed or been liquidated." />;
  }
  const { market: m, position, health, reduce } = p;
  const side = position.isLong ? "Long" : "Short";
  const net = health.upnlUsd6 - p.fundingUsd6 - p.borrowUsd6;
  const away = health.liqDistanceBps;
  const waitMs =
    reduce?.holdReadyBlock !== undefined && p.headBlock !== undefined
      ? (reduce.holdReadyBlock - p.headBlock) * BLOCK_MS_ESTIMATE
      : undefined;
  const label = p.closingAll ? `Hold · Close ${m.symbol} ${side.toLowerCase()}` : `Hold · Close ${pct(p.shareBps)}`;

  return (
    <View style={styles.stack}>
      <View style={styles.head}>
        <View style={styles.identity}>
          <EntityMark id={ids.engineMarket(network.chainId, marketId)} size={SIZE.markDetail} decorative />
          <View style={styles.titles}>
            <Text style={[TYPE.sectionTitle, { color: color.ink }]}>
              {m.symbol}-PERP <Text style={{ color: position.isLong ? color.up : color.down }}>{side}</Text>
            </Text>
            <VenueChip venue={ids.venue("senryo")} />
          </View>
        </View>
        <Text style={[TYPE.chipCategory, { color: statusTone(m.pv.status, color) }]}>{STATUS_LABEL[m.pv.status]}</Text>
      </View>

      <Panel style={styles.panel}>
        <SectionLabel>Unrealised · net</SectionLabel>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          style={[TYPE.numXl, { color: net < 0n ? color.down : color.up }]}
          accessibilityLabel={`Unrealised ${net < 0n ? "loss" : "profit"} ${signedUsd(net)}`}
        >
          {signedUsd(net)}
        </Text>
        <View>
          <KeyValue label="Price" value={signedUsd(health.upnlUsd6)} />
          <KeyValue label="Funding" value={signedUsd(-p.fundingUsd6)} />
          <KeyValue label="Borrow" value={signedUsd(-p.borrowUsd6)} />
        </View>
        <View style={styles.row}>
          <View style={styles.rows}>
            <KeyValue label="Size" value={`${formatUnits(position.size, DECIMALS.e18, SIZE_DECIMALS)} oz`} />
            <KeyValue label="Notional" value={usd(p.currentNotionalUsd6)} />
            <KeyValue label="Entry" value={price18(position.entry, priceDecimalsOf(marketId))} />
            <KeyValue label="Oracle" value={price18(m.pv.price18, priceDecimalsOf(marketId))} />
            <KeyValue
              label="Liq."
              value={
                health.liqPrice18 === null
                  ? "none above $0"
                  : `${price18(health.liqPrice18, priceDecimalsOf(marketId))}${away === null ? "" : ` · ${away <= 0n ? "now" : `${pct(away)} away`}`}`
              }
              valueColor={away !== null && away <= 0n ? color.down : undefined}
            />
          </View>
          <MarginGauge usageBps={health.marginUsageBps} width={GAUGE_WIDTH} label="Margin use" />
        </View>
      </Panel>

      <Panel style={styles.panel}>
        <SectionLabel>Close</SectionLabel>
        <Segmented
          options={REDUCE_STEPS_BPS.map((b) => ({ value: String(b), label: STEP_LABEL(b) }))}
          value={String(p.shareBps)}
          onChange={(v) => p.setShareBps(BigInt(v))}
          label="How much to close"
        />
        {reduce ? (
          <>
            <KeyValue label="Exit price" value={price18(reduce.execPrice18, priceDecimalsOf(marketId))} />
            <KeyValue
              label={reduce.profitCapped ? "Realised · capped" : "Realised"}
              value={signedUsd(reduce.realizedPnlUsd6)}
            />
            <KeyValue label="Fee" value={usd(reduce.feeUsd6)} />
            <KeyValue label="To your balance" value={signedUsd(reduce.netUsd6)} />
          </>
        ) : null}
        {m.pv.status !== "OPEN" ? (
          <Text style={[TYPE.rowDetail, { color: color.warn }]}>
            {m.name} is {STATUS_CHIP[m.pv.status].toLowerCase()}: closing still works, at the conservative price.
          </Text>
        ) : null}
        {waitMs !== undefined && waitMs > 0n ? (
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
            Profit close available in about {(waitMs + MS_PER_SECOND - 1n) / MS_PER_SECOND}s (anti-flash wait).
          </Text>
        ) : null}
        <HoldToConfirm
          label={label}
          disabled={!reduce || !p.ready || (waitMs !== undefined && waitMs > 0n)}
          onConfirm={() => void p.submit()}
          accessibilityHint="Hold for half a second to close"
        />
      </Panel>

      <TriggerPanel market={m} position={position} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, flexShrink: 1 },
  titles: { gap: SPACE.xs, flexShrink: 1 },
  panel: { padding: SPACE.lg, gap: SPACE.md },
  row: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.md },
  rows: { flex: 1 },
});
