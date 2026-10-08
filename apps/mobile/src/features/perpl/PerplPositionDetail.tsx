import {
  PERPL_PROTECTION_GATES,
  useDiscoveryCandles,
  useDiscoveryQuote,
  usePerplConnection,
  usePerplLivePrice,
  useQueryEnv,
} from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { type ReactNode, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { HistoryChart } from "~/components/charts/HistoryChart";
import { EntityMark } from "~/components/identity/EntityMark";
import { VenueChip } from "~/components/identity/VenueChip";
import { Button } from "~/components/kit/Button";
import { ChipRow } from "~/components/kit/ChipRow";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { ErrorState, Skeleton } from "~/components/kit/states";
import { Info } from "~/components/kit/symbols";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { DetailRow } from "~/features/markets/Disclosure";
import { marketShareUrl } from "~/features/markets/MarketActions";
import { DEFAULT_PERIOD, type PeriodKey, periodOf } from "~/features/markets/periods";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { SideBadge } from "~/features/portfolio/SideBadge";
import { CloseBar } from "~/features/positions/CloseTicket";
import { REDUCE_ALL_BPS, REDUCE_STEPS_BPS } from "~/features/positions/constants";
import { fire } from "~/feedback/fire";
import { usePositionReaction } from "~/feedback/usePositionReaction";
import { marketRoute, perplWithdrawRoute, ticketRoute } from "~/lib/constants/routes";
import { DEV_WORKSPACE } from "~/lib/dev/config";
import { pct } from "~/lib/money";
import { CONTROL_FONT_SCALE, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { monText, perplNetworkFee, perplPrice, perplPrice18, perplSignedUsd, perplSize, perplUsd } from "./format";
import { type PerplMarketMeta, perplWatchKey } from "./market";
import { PerplCloseOutcome } from "./PerplCloseOutcome";
import { PerplLiveChart } from "./PerplLiveChart";
import { LinkLine } from "./PerplOutcome";
import { usePerplPosition } from "./usePerplPosition";

const STEP_LABEL = (bps: bigint) => (bps >= REDUCE_ALL_BPS ? "100%" : pct(bps));

/**
 * A held Perpl position (flow book C5 for Perpl, Part D1) on the positions route: identity with Perpl's chip → the
 * P&L the Exchange computes at its mark, coloured by profit (ⓘ: price and funding) → a two-column grid of Size (in
 * the asset) · Entry · Mark · Liq. (Perpl's own formula) → margin and funding so far, then Perpl's compact live chart
 * with the entry line and what's free
 * on Perpl with "Move it back" → TP/SL setup requirements → Add · Share → Reduce 25/50/75/100 % with its quote and the
 * pinned slide. After the slide the page is the outcome surface.
 */
export function PerplPositionDetail({ meta }: { meta: PerplMarketMeta }) {
  useHideDockWhileFocused("perpl-position");
  const p = usePerplPosition(meta);
  const env = useQueryEnv();
  const live = usePerplLivePrice(meta.marketId);
  const connection = usePerplConnection();
  usePositionReaction(
    `${connection.epoch}:${env.chainId}:${p.snapshot?.account?.accountId ?? ""}:${meta.marketId}:${p.position?.side ?? ""}:${p.position?.lots ?? ""}`,
    live?.at ?? 0,
    p.position?.pnlCNS ?? 0n,
    Boolean(
      connection.state === "connected" &&
        p.terms !== undefined &&
        !p.terms.paused &&
        p.position?.markPriceValid &&
        live &&
        perplPrice18(p.position.markPricePNS, meta) === live.price18,
    ),
  );
  const { color } = useTheme();
  const client = useQueryClient();
  const [protection, setProtection] = useState(false);
  const [pnl, setPnl] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const id = perplWatchKey(meta.symbol);
  const quote = useDiscoveryQuote(id);
  const candles = useDiscoveryCandles(id, periodOf(period).interval, !DEV_WORKSPACE);
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
  const markPNS = position.markPricePNS;
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
                {p.leverageText !== undefined ? <Quiet>{`${p.leverageText}×`}</Quiet> : null}
              </View>
              <VenueChip venue={meta.venueMark} />
            </View>
          </View>
        </Rise>
        <Rise index={1}>
          <Panel style={styles.stats}>
            <Pnl pnl={position.pnlCNS} onInfo={() => setPnl(true)} />
            <View style={styles.factGrid}>
              <PositionFact label="Size" value={perplSize(position.lots, meta)} />
              <PositionFact label="Entry" value={perplPrice(position.entryPricePNS, meta)} />
              <PositionFact label="Mark" value={perplPrice(markPNS, meta)} />
              <PositionFact label="Liq." value={p.liqPricePNS === null ? "None" : perplPrice(p.liqPricePNS, meta)} />
            </View>
            <View style={styles.collateral}>
              <PositionLine label="Margin" value={perplUsd(position.depositCNS)} />
              <PositionLine label="Funding so far" value={perplSignedUsd(position.premiumPnlCNS)} />
            </View>
            {moveBack}
          </Panel>
        </Rise>
        <Rise index={2}>
          <PerplLiveChart
            marketId={meta.marketId}
            compact
            entry={{
              value: perplPrice18(position.entryPricePNS, meta),
              label: `Entry ${perplPrice(position.entryPricePNS, meta)}`,
            }}
            profitable={position.pnlCNS >= 0n}
            history={
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
            }
          />
        </Rise>
        <Rise index={3}>
          <Pressable
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel="Protection setup requirements"
            onPress={() => setProtection(true)}
          >
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>
              TP / SL
            </Text>
            <Quiet>Setup required</Quiet>
          </Pressable>
        </Rise>
        <Rise index={4}>
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
        <Rise index={5}>
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
                <DetailRow
                  label="Network fee"
                  value={p.networkFeeWei === undefined ? "Preparing…" : perplNetworkFee(p.networkFeeWei)}
                />
              </View>
            ) : (
              <Skeleton height={SIZE.skeletonRow} />
            )}
          </View>
        </Rise>
      </Screen>
      <CloseBar
        brand
        label={
          p.feeBlock
            ? p.feeBlock
            : p.feeBusy
              ? "Preparing network fee…"
              : p.feeShortWei > 0n
                ? `Add ${monText(p.feeShortWei)} for fees`
                : p.closingAll
                  ? "Slide to close"
                  : `Slide to reduce ${pct(p.shareBps)}`
        }
        isLong={long}
        resetKey={[meta.marketId, p.shareBps, position.lots, p.plan?.limitPricePNS ?? "", p.networkFeeWei ?? ""].join(
          "|",
        )}
        disabled={!p.plan || Boolean(p.plan.blocker) || !p.ready || p.feeShortWei > 0n}
        onConfirm={() => void p.submit()}
      />
      <ChildSheet open={protection} onClose={() => setProtection(false)} title="Perpl protection">
        <View>
          <DetailRow label="Venue account" value={String(p.snapshot?.account?.accountId ?? "Unavailable")} />
          <DetailRow label="Held position" value={`${position.side} ${perplSize(position.lots, meta)}`} />
          <DetailRow label="Mark" value={perplPrice(position.markPricePNS, meta)} />
          <DetailRow label="Protection status" value="Not activated" />
        </View>
        <Quiet>
          Perpl supports server-managed stop loss and take profit. Activation requires separate provider authorization;
          saving a level cannot silently enable it.
        </Quiet>
        {PERPL_PROTECTION_GATES.map((gate) => (
          <Quiet key={gate}>{gate}</Quiet>
        ))}
        <Quiet>Existing direct reviewed close remains available. No protection order is active from this screen.</Quiet>
      </ChildSheet>
      <ChildSheet open={pnl} onClose={() => setPnl(false)} title="Unrealised P&L">
        <View>
          <DetailRow label="Price" value={perplSignedUsd(position.deltaPnlCNS)} />
          <DetailRow label="Funding" value={perplSignedUsd(position.premiumPnlCNS)} />
          <DetailRow label="Net" value={perplSignedUsd(position.pnlCNS)} />
        </View>
        <Quiet>
          Live mark estimate, including the funding last booked by the Exchange. The close receipt gives the realised
          result.
        </Quiet>
      </ChildSheet>
    </View>
  );
}

function Quiet({ children }: { children: string }) {
  const { color } = useTheme();
  return (
    <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
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
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          TYPE.displayPrice,
          styles.pnlAmount,
          { color: pnl < 0n ? color.down : pnl > 0n ? color.up : color.ink },
        ]}
        accessibilityLabel={`Unrealised P&L ${perplSignedUsd(pnl)}`}
      >
        {perplSignedUsd(pnl)}
      </Text>
      <Quiet>Live mark estimate</Quiet>
    </View>
  );
}

function PositionFact({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label} ${value}`}>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
        {label}
      </Text>
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[TYPE.rowAmount, { color: color.ink }]}
      >
        {value}
      </Text>
    </View>
  );
}

function PositionLine({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.positionLine} accessible accessibilityLabel={`${label} ${value}`}>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: color.ink }]}>
        {value}
      </Text>
    </View>
  );
}

/** Sections arrive in a 30 ms stagger once per mount (rule A7). */
function Rise({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View
      style={styles.rise}
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
  content: { paddingBottom: SPACE.xl, gap: SPACE.lg },
  rise: { width: "100%", minWidth: 0 },
  outcome: { gap: SPACE.xl },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  titles: { flex: 1, gap: SPACE.xs },
  symbol: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  hero: { gap: SPACE.xxs, minWidth: 0 },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, alignSelf: "flex-start" },
  stats: { width: "100%", minWidth: 0, gap: SPACE.md, padding: SPACE.lg },
  pnlAmount: { width: "100%" },
  factGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACE.md },
  fact: { width: "50%", minWidth: 0, gap: SPACE.xxs, paddingRight: SPACE.sm },
  collateral: { gap: SPACE.xs },
  positionLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.touch },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: SPACE.md },
  reduce: { gap: SPACE.sm },
  chips: { marginHorizontal: -SIZE.gutter },
});
