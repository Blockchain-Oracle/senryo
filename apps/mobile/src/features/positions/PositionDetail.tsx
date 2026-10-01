import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { effectiveLeverage } from "~/features/portfolio/leverage";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { TradeTrace } from "~/features/trade/TradeTrace";
import { pct } from "~/lib/money";
import { SIZE, SPACE, STAGGER_RISE, TIMING } from "~/theme";
import { CloseBar, CloseTicket } from "./CloseTicket";
import { BLOCK_MS_ESTIMATE } from "./constants";
import { PnlHero } from "./PnlHero";
import { PositionHeader } from "./PositionHeader";
import { PositionStats } from "./PositionStats";
import { TriggerPanel } from "./TriggerPanel";
import { usePosition } from "./usePosition";

/**
 * F11 / F12, in the anatomy of Fomo's tall position detail (F13/F14, C25) on a pushed page: identity (mark, symbol,
 * side, venue, session status) → the unrealised P&L as the page's one big figure with its price / funding / borrow
 * parts → the facts as a grid of quiet cells → TP/SL → the close ticket (25/50/75 % / all with its quote) — and the
 * hold that sends the close pinned under the scroll, above the home indicator. After the hold the page becomes the
 * execution trace. Reducing works in every session status (closed/paused use the status-matrix price, explained).
 */
export function PositionDetail({ marketId }: { marketId: number }) {
  const p = usePosition(marketId);
  const outcome = useSettledOutcome(p.trace.events);
  if (p.trace.events.length > 0) {
    return (
      <Screen>
        <TradeTrace
          events={p.trace.events}
          running={p.trace.running}
          outcome={outcome}
          onDone={() => p.trace.reset()}
          onLeave={() => router.back()}
        />
      </Screen>
    );
  }
  if (p.loading) {
    return (
      <Screen>
        <PositionSkeleton />
      </Screen>
    );
  }
  if (!p.position || !p.market || !p.health) {
    return (
      <Screen>
        <QuietLine action={{ label: "Go back", onPress: () => router.back() }}>
          No open position in this market · it may have just closed or been liquidated.
        </QuietLine>
      </Screen>
    );
  }
  const { market: m, position, health, reduce } = p;
  const side = position.isLong ? "Long" : "Short";
  const waitMs =
    reduce?.holdReadyBlock !== undefined && p.headBlock !== undefined
      ? (reduce.holdReadyBlock - p.headBlock) * BLOCK_MS_ESTIMATE
      : undefined;
  const label = p.closingAll ? `Hold · Close ${m.symbol} ${side.toLowerCase()}` : `Hold · Close ${pct(p.shareBps)}`;
  const leverage = p.snapshot ? effectiveLeverage(p.currentNotionalUsd6, p.snapshot.equityInit) : undefined;

  return (
    <>
      <Screen contentStyle={styles.content}>
        <Rise index={0}>
          <PositionHeader market={m} position={position} leverage={leverage} />
        </Rise>
        <Rise index={1}>
          <PnlHero priceUsd6={health.upnlUsd6} fundingUsd6={p.fundingUsd6} borrowUsd6={p.borrowUsd6} />
        </Rise>
        <Rise index={2}>
          <PositionStats market={m} position={position} health={health} exposureUsd6={p.currentNotionalUsd6} />
        </Rise>
        <Rise index={3}>
          <TriggerPanel market={m} position={position} />
        </Rise>
        <Rise index={4}>
          <CloseTicket market={m} shareBps={p.shareBps} onShare={p.setShareBps} reduce={reduce} waitMs={waitMs} />
        </Rise>
      </Screen>
      <CloseBar
        label={label}
        disabled={!reduce || !p.ready || (waitMs !== undefined && waitMs > 0n)}
        onConfirm={() => void p.submit()}
      />
    </>
  );
}

/** Sections arrive in a short stagger once the position is read (build brief §4); a refresh changes numbers in place. */
function Rise({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(TIMING.staggerItem)
        .delay(index * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
    >
      {children}
    </Animated.View>
  );
}

/** Line widths (pt) of the loading page's header, figure and cells. */
const TITLE_WIDTH = 132;
const CHIP_WIDTH = 84;
const FIGURE_WIDTH = "60%";
const CELL_VALUE_WIDTH = "70%";
const CELL_LABEL_WIDTH = "40%";
const GRID_ROWS = [0, 1, 2] as const;

/** The page's final shape while the position is read: identity, the P&L plate, the grid of facts. */
function PositionSkeleton() {
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Reading the position">
      <View style={styles.head}>
        <View style={styles.mark}>
          <Skeleton width={SIZE.markDetail} height={SIZE.markDetail} />
        </View>
        <View style={styles.titles}>
          <Skeleton width={TITLE_WIDTH} height={SIZE.skeletonLine + SPACE.xs} />
          <Skeleton width={CHIP_WIDTH} />
        </View>
      </View>
      <Panel style={styles.plate}>
        <Skeleton width={CELL_LABEL_WIDTH} height={SIZE.skeletonSmall} />
        <Skeleton width={FIGURE_WIDTH} height={SIZE.skeletonRow} />
        <Skeleton height={SIZE.skeletonLine} />
      </Panel>
      {GRID_ROWS.map((row) => (
        <View key={row} style={styles.gridRow}>
          <View style={styles.cell}>
            <Skeleton width={CELL_LABEL_WIDTH} height={SIZE.skeletonSmall} />
            <Skeleton width={CELL_VALUE_WIDTH} />
          </View>
          <View style={styles.cell}>
            <Skeleton width={CELL_LABEL_WIDTH} height={SIZE.skeletonSmall} />
            <Skeleton width={CELL_VALUE_WIDTH} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The hold is pinned under the scroll, so the content only needs to end clear of it.
  content: { paddingBottom: SPACE.xl },
  loading: { gap: SPACE.xl },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  mark: { borderRadius: SIZE.markDetail, overflow: "hidden" },
  titles: { flex: 1, gap: SPACE.sm },
  plate: { padding: SPACE.lgPlus, gap: SPACE.md },
  gridRow: { flexDirection: "row", gap: SPACE.lg },
  cell: { flex: 1, gap: SPACE.sm },
});
