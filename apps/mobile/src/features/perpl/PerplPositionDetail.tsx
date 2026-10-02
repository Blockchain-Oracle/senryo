import { useDiscoveryCandles, useDiscoveryQuote } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { type ReactNode, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { HistoryChart } from "~/components/charts/HistoryChart";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { AmountHero } from "~/components/kit/AmountHero";
import { Button } from "~/components/kit/Button";
import { ChipRow } from "~/components/kit/ChipRow";
import { Screen } from "~/components/kit/Screen";
import { ErrorState, Skeleton } from "~/components/kit/states";
import { Info } from "~/components/kit/symbols";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { DetailRow } from "~/features/markets/Disclosure";
import { marketShareUrl } from "~/features/markets/MarketActions";
import { DEFAULT_PERIOD, type PeriodKey, periodOf } from "~/features/markets/periods";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { SideBadge } from "~/features/portfolio/SideBadge";
import { CloseBar } from "~/features/positions/CloseTicket";
import { REDUCE_ALL_BPS, REDUCE_STEPS_BPS } from "~/features/positions/constants";
import { Facts } from "~/features/trade/TicketReceipt";
import { fire } from "~/feedback/fire";
import { marketRoute, perplWithdrawRoute, ticketRoute } from "~/lib/constants/routes";
import { pct } from "~/lib/money";
import { CONTROL_FONT_SCALE, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { monText, perplPrice, perplPrice18, perplSignedUsd, perplSize, perplUsd } from "./format";
import { type PerplMarketMeta, perplWatchKey } from "./market";
import { PerplCloseOutcome } from "./PerplCloseOutcome";
import { LinkLine } from "./PerplOutcome";
import { usePerplPosition } from "./usePerplPosition";

const STEP_LABEL = (bps: bigint) => (bps >= REDUCE_ALL_BPS ? "100%" : pct(bps));

/**
 * A held Perpl position (flow book C5 for Perpl, Part D1) on the positions route: identity with Perpl's chip → the
 * P&L the Exchange computes at its mark, coloured by profit (ⓘ: price and funding) → Perpl's candles with the entry
 * line → Size (in the asset) · Entry · Mark · Liq. (Perpl's own formula) → margin and funding so far, and what's free
 * on Perpl with "Move it back" → TP/SL "On Perpl soon" → Add · Share → Reduce 25/50/75/100 % with its quote and the
 * pinned slide. After the slide the page is the outcome surface.
 */
export function PerplPositionDetail({ meta }: { meta: PerplMarketMeta }) {
  const p = usePerplPosition(meta);
  const { color } = useTheme();
  const client = useQueryClient();
  const [pnl, setPnl] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const id = perplWatchKey(meta.symbol);
  const quote = useDiscoveryQuote(id);
  const candles = useDiscoveryCandles(id, periodOf(period).interval);
  const { trace, active } = p.runner;
  const title = <Stack.Screen options={{ title: `${meta.symbol} position` }} />;
  if (trace.events.length > 0 || active) {
    return (
      <Screen contentStyle={styles.outcome}>
        {title}
        <PerplCloseOutcome
          runner={p.runner}
          meta={meta}
          onDone={() => p.runner.reset()}
          onLeave={() => router.back()}
          onMoveBack={() => {
            p.runner.reset();
            router.push(perplWithdrawRoute);
          }}
        />
      </Screen>
    );
  }
  const free = p.snapshot?.account?.availableCNS ?? 0n;
  const moveBack =
    free > 0n ? (
      <LinkLine
        label={`Free on Perpl ${perplUsd(free)}`}
        action="Move it back"
        onPress={() => router.push(perplWithdrawRoute)}
      />
    ) : null;
  if (p.failed) {
    return (
      <Screen>
        {title}
        <ErrorState diagnosis={p.failed} retry={() => void client.invalidateQueries({ queryKey: ["account"] })} />
      </Screen>
    );
  }
  if (p.loading) {
    return (
      <Screen>
        {title}
        <Skeleton height={SIZE.chartCandles} />
      </Screen>
    );
  }
  const position = p.position;
  if (!position) {
    return (
      <Screen>
        {title}
        <QuietLine action={{ label: "See market", onPress: () => router.replace(marketRoute(meta.symbol)) }}>
          No open position
        </QuietLine>
        {moveBack}
      </Screen>
    );
  }
  const long = position.side === "long";
  const markPNS = p.terms?.markPNS ?? position.markPricePNS;
  const share = () => {
    const url = marketShareUrl(meta.symbol);
    const message = `I'm ${position.side} ${meta.symbol} on Perpl with Senryo.`;
    void Share.share(Platform.OS === "ios" ? { message, url } : { message: `${message}\n${url}` });
  };
  return (
    <View style={styles.fill}>
      {title}
      <Screen contentStyle={styles.content}>
        <Rise index={0}>
          <View style={styles.head}>
            <EntityMark id={meta.mark} badge={meta.venueMark} size={SIZE.markDetail} label={meta.symbol} decorative />
            <View style={styles.titles}>
              <View style={styles.symbol}>
                <Text
                  maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                  accessibilityRole="header"
                  style={[TYPE.sectionTitle, { color: color.ink }]}
                >
                  {meta.symbol}
                </Text>
                <SideBadge isLong={long} />
                {p.leverageX !== undefined ? <Quiet>{`${p.leverageX}×`}</Quiet> : null}
              </View>
              <VenueChip venue={meta.venueMark} />
            </View>
          </View>
        </Rise>
        <Rise index={1}>
          <Pnl pnl={position.pnlCNS} onInfo={() => setPnl(true)} />
        </Rise>
        <Rise index={2}>
          <HistoryChart
            reading={candles}
            period={period}
            onPeriod={setPeriod}
            priceUsd18={quote.status === "fresh" || quote.status === "stale" ? quote.value.price18 : undefined}
            caption={`${meta.symbol}/USD`}
            loadingLabel="Loading its history"
            retry={() => void client.invalidateQueries({ queryKey: ["discovery"] })}
            entry={{
              value: perplPrice18(position.entryPricePNS, meta),
              label: `Entry ${perplPrice(position.entryPricePNS, meta)}`,
            }}
          />
        </Rise>
        <Rise index={3}>
          <View style={styles.stats}>
            <Facts
              facts={[
                { label: "Size", value: perplSize(position.lots, meta) },
                { label: "Entry", value: perplPrice(position.entryPricePNS, meta) },
                { label: "Mark", value: perplPrice(markPNS, meta) },
                { label: "Liq.", value: p.liqPricePNS === null ? "None" : perplPrice(p.liqPricePNS, meta) },
              ]}
            />
            <Quiet center>
              {`Margin ${perplUsd(position.depositCNS)} · Funding ${perplSignedUsd(position.premiumPnlCNS)} so far`}
            </Quiet>
            {moveBack}
          </View>
        </Rise>
        <Rise index={4}>
          <View style={styles.row} accessible accessibilityLabel="Stop loss and take profit on Perpl soon">
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>
              TP / SL
            </Text>
            <Quiet>On Perpl soon</Quiet>
          </View>
        </Rise>
        <Rise index={5}>
          <View style={styles.actions}>
            <Button
              label="Add"
              variant="secondary"
              style={styles.flex}
              onPress={() => router.push(ticketRoute(meta.symbol, position.side))}
              accessibilityHint={`Opens the ticket on the ${position.side} side`}
            />
            <Button label="Share" variant="secondary" style={styles.flex} onPress={share} />
          </View>
        </Rise>
        <Rise index={6}>
          <View style={styles.reduce}>
            <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
              Reduce
            </Text>
            <View style={styles.chips}>
              <ChipRow
                options={REDUCE_STEPS_BPS.map((b) => ({ value: String(b), label: STEP_LABEL(b) }))}
                value={String(p.shareBps)}
                onChange={(v) => p.setShareBps(BigInt(v))}
                label="How much to close"
              />
            </View>
            {p.plan ? (
              <View>
                <DetailRow label="Exit price" value={`${long ? "≥" : "≤"} ${perplPrice(p.plan.limitPricePNS, meta)}`} />
                <DetailRow label="Size" value={perplSize(p.lots, meta)} />
                <DetailRow label="Realised (est.)" value={perplSignedUsd(p.realizedUsd6)} />
                <DetailRow label="Fee (est.)" value={perplUsd(p.feeUsd6)} />
              </View>
            ) : (
              <Skeleton height={SIZE.skeletonRow} />
            )}
          </View>
        </Rise>
      </Screen>
      <CloseBar
        label={
          p.feeShortWei > 0n
            ? `Add ${monText(p.feeShortWei)} for fees`
            : p.closingAll
              ? "Slide to close"
              : `Slide to reduce ${pct(p.shareBps)}`
        }
        isLong={long}
        resetKey={[meta.marketId, p.shareBps, position.lots, p.plan?.limitPricePNS ?? ""].join("|")}
        disabled={!p.plan || Boolean(p.plan.blocker) || !p.ready || p.feeShortWei > 0n}
        onConfirm={() => void p.submit()}
      />
      <ChildSheet open={pnl} onClose={() => setPnl(false)} title="Unrealised P&L">
        <View>
          <DetailRow label="Price" value={perplSignedUsd(position.deltaPnlCNS)} />
          <DetailRow label="Funding" value={perplSignedUsd(position.premiumPnlCNS)} />
          <DetailRow label="Net" value={perplSignedUsd(position.pnlCNS)} />
        </View>
        <Quiet>At Perpl’s mark price, as the Exchange computes it.</Quiet>
      </ChildSheet>
    </View>
  );
}

function Quiet({ children, center }: { children: string; center?: boolean }) {
  const { color } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={CONTROL_FONT_SCALE}
      style={[TYPE.rowDetail, center ? styles.center : null, { color: color.text3 }]}
    >
      {children}
    </Text>
  );
}

/** The one hero: the Exchange's unrealised P&L at its mark, coloured by profit (never by side, C3a). */
function Pnl({ pnl, onInfo }: { pnl: bigint; onInfo: () => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.hero}>
      <Pressable
        onPress={() => {
          fire("tick");
          onInfo();
        }}
        accessibilityRole="button"
        accessibilityLabel="What the P&L is made of"
        hitSlop={SPACE.sm}
        style={styles.inline}
      >
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
          Unrealised P&L
        </Text>
        <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
      </Pressable>
      <AmountHero
        text={perplSignedUsd(pnl)}
        role={TYPE.displayPrice}
        color={pnl < 0n ? color.down : color.up}
        dimDecimals={false}
        accessibilityLabel={`Unrealised ${pnl < 0n ? "loss" : "profit"} ${perplSignedUsd(pnl)}`}
      />
    </View>
  );
}

/** Sections arrive in a 30 ms stagger once per mount (rule A7). */
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: SPACE.xl },
  outcome: { gap: SPACE.xl },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  titles: { flex: 1, gap: SPACE.xs },
  symbol: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  hero: { gap: SPACE.xs },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, alignSelf: "flex-start" },
  stats: { gap: SPACE.sm },
  center: { textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.touch },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: SPACE.md },
  reduce: { gap: SPACE.sm },
  chips: { marginHorizontal: -SIZE.gutter },
});
