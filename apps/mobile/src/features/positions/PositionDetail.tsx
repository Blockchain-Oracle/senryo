import { engineMarket } from "@senryo/config";
import { useQueryEnv } from "@senryo/query";
import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import { Platform, Share, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { marketShareUrl } from "~/features/markets/MarketActions";
import { MarketChart } from "~/features/markets/MarketChart";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { planKey } from "~/features/trade/planned-triggers";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { TpSlChild } from "~/features/trade/TpSlChild";
import { useAccount } from "~/lib/account/provider";
import { marketRoute, ticketRoute } from "~/lib/constants/routes";
import { pct } from "~/lib/money";
import { SIZE, SPACE, STAGGER_RISE, TIMING } from "~/theme";
import { CloseOutcome } from "./CloseSummary";
import { CloseBar, CloseTicket } from "./CloseTicket";
import { BLOCK_MS_ESTIMATE } from "./constants";
import { LeftoverOrders } from "./LeftoverOrders";
import { PnlHero, PnlParts } from "./PnlHero";
import { PositionHeader } from "./PositionHeader";
import { FundingLine, PositionStats } from "./PositionStats";
import { TpSlRow } from "./TpSlRow";
import { usePosition } from "./usePosition";

/**
 * A held position (Fomo F13/F14; flow book C5/C6; plan §0.9 Position) on a pushed page: identity → the P&L hero
 * coloured by profit (ⓘ for its parts) → the chart with the entry line → Size · Entry · Mark · Liq. → funding and
 * borrow in one line → the TP/SL row (F44 sheet: save replaces) → Add · Share → Reduce 25/50/75/100 % with its quote,
 * and the slide pinned under the scroll ("Slide to close" / "Slide to reduce 25%"). A full close also cancels the
 * market's leftover TP/SL in the same operation. After the slide the page is the outcome surface.
 */
export function PositionDetail({ marketId }: { marketId: number }) {
  const p = usePosition(marketId);
  const env = useQueryEnv();
  const address = useAccount().hint?.address;
  const outcome = useSettledOutcome(p.trace.events);
  const [child, setChild] = useState<"pnl" | "tpsl" | undefined>();
  if (p.trace.events.length > 0) {
    return (
      <Screen contentStyle={styles.outcome}>
        <CloseOutcome
          marketId={marketId}
          quote={p.quoted}
          events={p.trace.events}
          record={p.trace.record}
          running={p.trace.running}
          outcome={outcome}
          cleanup={p.cleanup}
          onDone={() => {
            p.trace.reset();
            p.cleanup.reset();
          }}
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
        <QuietLine
          action={{
            label: "See market",
            onPress: () => router.replace(marketRoute(engineMarket(marketId)?.symbol ?? "")),
          }}
        >
          No open position
        </QuietLine>
        <LeftoverOrders marketId={marketId} />
      </Screen>
    );
  }
  const { market: m, position, health, reduce } = p;
  const side = position.isLong ? "long" : "short";
  const waitMs =
    reduce?.holdReadyBlock !== undefined && p.headBlock !== undefined
      ? (reduce.holdReadyBlock - p.headBlock) * BLOCK_MS_ESTIMATE
      : undefined;
  const label = p.closingAll ? "Slide to close" : `Slide to reduce ${pct(p.shareBps)}`;
  const share = () => {
    const url = marketShareUrl(m.symbol);
    const message = `I'm ${side} ${m.symbol} on Senryo.`;
    void Share.share(Platform.OS === "ios" ? { message, url } : { message: `${message}\n${url}` });
  };
  return (
    <View style={styles.fill}>
      <Screen contentStyle={styles.content}>
        <Rise index={0}>
          <PositionHeader market={m} position={position} />
        </Rise>
        <Rise index={1}>
          <MarketChart
            line={{ symbol: m.symbol, marketId: m.marketId, price18: m.pv.price18, updatedAt: m.updatedAt }}
            entry={position.entry}
            profitable={health.upnlUsd6 - p.fundingUsd6 - p.borrowUsd6 >= 0n}
          />
        </Rise>
        <Rise index={2}>
          <Panel style={styles.summary}>
            <PnlHero
              priceUsd6={health.upnlUsd6}
              fundingUsd6={p.fundingUsd6}
              borrowUsd6={p.borrowUsd6}
              onInfo={() => setChild("pnl")}
            />
            <PositionStats market={m} position={position} health={health} />
            <FundingLine market={m} isLong={position.isLong} fundingUsd6={p.fundingUsd6} borrowUsd6={p.borrowUsd6} />
            <Button label="Share position" variant="secondary" onPress={share} />
          </Panel>
        </Rise>
        <Rise index={4}>
          <TpSlRow market={m} onOpen={() => setChild("tpsl")} />
        </Rise>
        <Rise index={5}>
          <View style={styles.actions}>
            <Button
              label="Add"
              variant="secondary"
              style={styles.flex}
              onPress={() => router.push(ticketRoute(m.symbol, side))}
              accessibilityHint={`Opens the ticket on the ${side} side`}
            />
          </View>
        </Rise>
        <Rise index={6}>
          <CloseTicket market={m} shareBps={p.shareBps} onShare={p.setShareBps} reduce={reduce} waitMs={waitMs} />
        </Rise>
      </Screen>
      <CloseBar
        label={label}
        isLong={position.isLong}
        resetKey={[env.chainId, marketId, p.shareBps, position.size, reduce?.execPrice18 ?? ""].join("|")}
        disabled={!reduce || !p.ready || (waitMs !== undefined && waitMs > 0n)}
        onConfirm={() => void p.submit()}
      />
      <PnlParts
        open={child === "pnl"}
        onClose={() => setChild(undefined)}
        priceUsd6={health.upnlUsd6}
        fundingUsd6={p.fundingUsd6}
        borrowUsd6={p.borrowUsd6}
      />
      <TpSlChild
        open={child === "tpsl"}
        onClose={() => setChild(undefined)}
        market={m}
        held={position}
        isLong={position.isLong}
        previewLiq={health.liqPrice18}
        planKey={planKey(env.chainId, address, marketId)}
      />
    </View>
  );
}

/** Sections arrive in a 30 ms stagger once per mount (rule A7); a refresh changes numbers in place. */
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

/** Line widths (pt) of the loading page's header, figure and strip. */
const TITLE_WIDTH = 132;
const CHIP_WIDTH = 84;
const FIGURE_WIDTH = "60%";
/** The stat strip has four cells. */
const STRIP_CELLS = 4;
const STRIP = Array.from({ length: STRIP_CELLS }, (_, i) => i);
const CELL_WIDTH = "22%";

/** The page's final shape while the position is read: identity, the P&L figure, the chart, the stat strip. */
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
      <Skeleton width={FIGURE_WIDTH} height={SIZE.skeletonRow} />
      <Skeleton height={SIZE.chartCandles} />
      <View style={styles.strip}>
        {STRIP.map((cell) => (
          <Skeleton key={cell} width={CELL_WIDTH} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // The slide is pinned under the scroll, so the content only needs to end clear of it.
  content: { paddingBottom: SPACE.xl },
  outcome: { gap: SPACE.xl },
  summary: { gap: SPACE.md, padding: SPACE.md },
  actions: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  loading: { gap: SPACE.xl },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  mark: { borderRadius: SIZE.markDetail, overflow: "hidden" },
  titles: { flex: 1, gap: SPACE.sm },
  strip: { flexDirection: "row", justifyContent: "space-between" },
});
