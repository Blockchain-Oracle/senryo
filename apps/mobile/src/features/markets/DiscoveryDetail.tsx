/**
 * A read-only instrument's page (review S03; market detail's anatomy, F32): identity and venue in the bar → the
 * authoritative price (Perpl's mark, or a calculated wrapper feed's price) with what its change compares → the chart
 * from its own history → the facts it has (open interest, volume, funding — or why not) → for a calculated feed, the
 * wrapper disclosure → and, where Short / Long would be, one disabled row: a lock and its word ("Mainnet", "Soon",
 * "Read-only", "No feed"), with the reason one tap away (ⓘ). Watch and Share sit in the bar (flow book C2 rule
 * "symmetry"; C10). No ticket, no invented number. Crude oil (no feed on Monad) gets the same page with no price.
 */
import { type DiscoveryInstrument, discoveryInstrument, UNPRICED_INSTRUMENTS, WEB_ORIGIN } from "@senryo/config";
import { ids } from "@senryo/identity";
import { type DiscoveryFunding, type DiscoveryQuote, useDiscoveryCandles, useDiscoveryQuote } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HistoryChart } from "~/components/charts/HistoryChart";
import { KeyValue } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { compactUsd6, finePct, tokenPrice } from "~/features/tokens/format";
import { LockedBar } from "~/features/trade/SideBar";
import { MarketIdentity } from "~/features/trade/TradeHeader";
import { clockTime } from "~/lib/format";
import { arrow, signedPct } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { discoveryMark } from "./discovery-marks";
import { gateTitle, lockWord, NO_FEED } from "./discovery-words";
import { MarketActions } from "./MarketActions";
import { PageHeader, PageTitle } from "./PageHeader";
import { DEFAULT_PERIOD, type PeriodKey, periodOf } from "./periods";
import { QuietLine } from "./QuietLine";

const MS_PER_SECOND = 1000;
/** `ratePct100k` is in 1e-5 (100 = 0.1 %): percent = rate / 1000. */
const FUNDING_PER_PERCENT = 1000;
/** One rate unit is 0.001 %. */
const FUNDING_SHOWN = 3;
const SEC_PER_HOUR = 3600;

const SEC_PER_MINUTE = 60;

/** "every 8 h", "every 43 min" from seconds. */
function everyText(sec: number): string {
  return sec % SEC_PER_HOUR === 0 ? `${sec / SEC_PER_HOUR} h` : `${Math.round(sec / SEC_PER_MINUTE)} min`;
}

/** "0.010% per 43 min · longs pay" — the last applied rate, its interval when Perpl lists one, and who pays. */
function fundingText(f: DiscoveryFunding): string {
  const every = f.intervalSec.available ? ` per ${everyText(f.intervalSec.value)}` : " per interval";
  if (f.ratePct100k === 0) return `0%${every} · neither side pays`;
  const rate = `${(Math.abs(f.ratePct100k) / FUNDING_PER_PERCENT).toFixed(FUNDING_SHOWN)}%`;
  return `${rate}${every} · ${f.ratePct100k > 0 ? "longs pay" : "shorts pay"}`;
}

export function DiscoveryDetail({ id }: { id: string }) {
  useHideDockWhileFocused("discovery-detail");
  const instrument = discoveryInstrument(id);
  const unpriced = UNPRICED_INSTRUMENTS.find((u) => u.id === id);
  const { color } = useTheme();
  if (unpriced) {
    return (
      <View style={[styles.fill, { backgroundColor: color.ground }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageHeader>
          <MarketIdentity
            mark={ids.equity(unpriced.symbol)}
            symbol={unpriced.symbol}
            name={unpriced.name}
            maxLeverageX={undefined}
            venue="No venue yet"
          />
        </PageHeader>
        <View style={styles.body}>
          <Text style={[TYPE.body, { color: color.text2 }]}>{unpriced.data.reason}.</Text>
        </View>
        <View style={styles.spacer} />
        <LockedBar word={NO_FEED} />
      </View>
    );
  }
  if (!instrument) {
    return (
      <View style={[styles.fill, { backgroundColor: color.ground }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageHeader>
          <PageTitle>Market</PageTitle>
        </PageHeader>
        <QuietLine>This instrument isn’t in Senryo’s universe</QuietLine>
      </View>
    );
  }
  return <Detail instrument={instrument} />;
}

function Detail({ instrument }: { instrument: DiscoveryInstrument }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const network = useNetwork();
  const client = useQueryClient();
  const quote = useDiscoveryQuote(instrument.id);
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const [why, setWhy] = useState(false);
  const candles = useDiscoveryCandles(instrument.id, periodOf(period).interval);
  const gate = instrument.execution[network.chainId];
  const known = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const crypto = instrument.class === "crypto";
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader
        right={
          <MarketActions
            name={instrument.symbol}
            watchKey={instrument.id}
            shareUrl={`${WEB_ORIGIN}/markets/${instrument.symbol}`}
          />
        }
      >
        <MarketIdentity
          mark={discoveryMark(instrument)}
          venueMark={crypto ? ids.venue("perpl") : undefined}
          symbol={instrument.symbol}
          name={crypto ? instrument.name : instrument.underlying.name}
          maxLeverageX={undefined}
          venue={crypto ? "Perpl" : "Chainlink feed"}
        />
      </PageHeader>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]}>
        <ReadingView
          reading={quote}
          loading="line"
          loadingLabel="Reading the price"
          retry={() => void client.invalidateQueries({ queryKey: ["discovery"] })}
        >
          {(q) => (
            <View style={styles.price}>
              <Text accessibilityRole="header" style={[TYPE.displayPrice, { color: color.ink }]}>
                {tokenPrice(q.price18)}
              </Text>
              {q.change24h.available ? (
                <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
                  <Text style={[TYPE.rowChange, { color: q.change24h.value.bps >= 0n ? color.up : color.down }]}>
                    {arrow(q.change24h.value.bps)} {signedPct(q.change24h.value.bps)}
                  </Text>{" "}
                  · {q.change24h.value.basis}
                </Text>
              ) : (
                <Text style={[TYPE.rowDetail, { color: color.text3 }]}>24h — · {q.change24h.reason}</Text>
              )}
              <Text style={[TYPE.meta, { color: q.activity.state === "live" ? color.text3 : color.warn }]}>
                {q.priceKind === "mark" ? "Perpl mark price" : "Calculated wrapper price"} · as of{" "}
                {clockTime(q.updatedAt * MS_PER_SECOND)}
                {q.activity.state === "quiet" ? ` · ${q.activity.reason}` : ""}
              </Text>
            </View>
          )}
        </ReadingView>
        <HistoryChart
          reading={candles}
          period={period}
          onPeriod={setPeriod}
          priceUsd18={known?.price18}
          caption={`${instrument.class === "crypto" ? instrument.symbol : instrument.wrapper.symbol}/USD`}
          loadingLabel="Loading its history"
          retry={() => void client.invalidateQueries({ queryKey: ["discovery"] })}
        />
        {known ? <Facts instrument={instrument} quote={known} /> : null}
      </ScrollView>
      <LockedBar word={lockWord(instrument, network.chainId)} onInfo={() => setWhy(true)} />
      <ChildSheet open={why} onClose={() => setWhy(false)} title={gateTitle(gate)}>
        <Text style={[TYPE.body, { color: color.text2 }]}>
          {gate?.reason ?? "This network doesn’t list it"}.
          {gate?.state === "blocked" ? ` It opens with ${gate.unblocks}.` : ""}
        </Text>
      </ChildSheet>
    </View>
  );
}

/**
 * What the source has beside the price: a Perpl market's open interest, volume and funding (a metric it can't read
 * shows "—" and its reason underneath), or, for a calculated feed, that it has no market and what it really prices.
 */
function Facts({ instrument, quote }: { instrument: DiscoveryInstrument; quote: DiscoveryQuote }) {
  const { color } = useTheme();
  if (instrument.class === "equity-calculated") {
    return (
      <View style={styles.facts}>
        <KeyValue label="Prices" value={instrument.wrapper.name} />
        <KeyValue label="Tracks" value={`${instrument.underlying.name} (${instrument.underlying.ticker})`} />
        <KeyValue
          label="Updates"
          value={`24/5 · every ${instrument.feed.heartbeatSec / SEC_PER_HOUR} h or on a ${finePct(BigInt(instrument.feed.deviationBps))} move`}
        />
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          {instrument.disclosure}. A calculated feed has no market of its own — no open interest, volume or funding.
        </Text>
      </View>
    );
  }
  const missing = [quote.openInterest, quote.volume24hUsd6, quote.funding].flatMap((m) =>
    m.available ? [] : [m.reason],
  );
  return (
    <View style={styles.facts}>
      <KeyValue
        label="Open interest"
        value={quote.openInterest.available ? `${compactUsd6(quote.openInterest.value.usd6)} a side` : "—"}
      />
      <KeyValue
        label="Volume, 24 h"
        value={quote.volume24hUsd6.available ? compactUsd6(quote.volume24hUsd6.value) : "—"}
      />
      <KeyValue label="Funding" value={quote.funding.available ? fundingText(quote.funding.value) : "—"} />
      {missing.length > 0 ? (
        <Text style={[TYPE.meta, { color: color.text3 }]}>{[...new Set(missing)].join(" · ")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.xl },
  spacer: { flex: 1 },
  price: { gap: SPACE.xs },
  facts: { gap: SPACE.sm },
});
