import type { BinaryPrediction, Prediction, PredictionProvider, PriceContest } from "@senryo/api-client";
import { usePrediction } from "@senryo/query";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ChipRow } from "~/components/kit/ChipRow";
import { KeyValue } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { MarketActions } from "~/features/markets/MarketActions";
import { PageHeader, PageTitle } from "~/features/markets/PageHeader";
import { useNowSec } from "~/features/markets/useNowSec";
import { compactUsd6 } from "~/features/tokens/format";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { percent, predictionMark, statusText, time } from "./format";
import { OutcomeChart } from "./OutcomeChart";
import { predictionWatchKey } from "./references";
import { useFocused } from "./useFocused";

const MULTIPLIER_SCALE = 100;
const DECIMAL_BASE = 10n;

/** FT051/52: identity → event time/state → outcomes/history → rules → truthful execution availability. */
export function PredictionDetail({ provider, id }: { provider: PredictionProvider; id: string }) {
  useHideDockWhileFocused("prediction-detail");
  const focused = useFocused();
  const data = usePrediction(provider, id, focused);
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <PageHeader>
        <PageTitle>Prediction</PageTitle>
      </PageHeader>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]}>
        <ReadingView
          reading={data.reading}
          loading="plate"
          loadingLabel="Loading prediction details"
          retry={data.retry}
        >
          {(market) => <Detail market={market} />}
        </ReadingView>
      </ScrollView>
    </View>
  );
}
function Detail({ market: m }: { market: Prediction }) {
  const { color } = useTheme();
  const now = Number(useNowSec());
  return (
    <View style={styles.content}>
      <View style={styles.identity}>
        <EntityMark id={predictionMark(m.asset)} size={SIZE.icon + SPACE.md} />
        <View style={styles.fill}>
          <Text style={[TYPE.sectionTitle, { color: color.ink }]}>
            {m.asset} · {m.kind === "binary" ? (m.window ? "Up or Down" : "Price event") : "Price contest"}
          </Text>
          <Text style={[TYPE.meta, { color: color.text3 }]}>
            {m.provider === "polymarket" ? "Polymarket" : "Castora"} · {m.settlementNetwork}
          </Text>
        </View>
      </View>
      <Text accessibilityRole="header" style={[TYPE.title, { color: color.ink }]}>
        {m.title}
      </Text>
      <MarketActions name={m.title} watchKey={predictionWatchKey(m)} shareUrl={m.sourceUrl} />
      <KeyValue label="Status" value={statusText(m, now)} />
      {m.opensAt !== null ? <KeyValue label="Starts" value={time(m.opensAt)} /> : null}
      <KeyValue label={m.kind === "binary" ? "Ends" : "Entry deadline"} value={time(m.closesAt)} />
      {m.kind === "binary" ? <BinaryDetail market={m} /> : <ContestDetail market={m} />}
      <Text style={[TYPE.body, { color: color.text2 }]}>
        {m.kind === "binary"
          ? "Trading is not available in Senryo yet. These are Polygon market prices, not a quote or a Practice position."
          : "Contest entry and claims are not available in Senryo yet. These are Monad contract records, not Practice funds."}
      </Text>
      <Button label="View provider page" variant="outline" onPress={() => void Linking.openURL(m.sourceUrl)} />
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        Observed {time(m.observedAt)}
        {m.sourceUpdatedAt === null ? "" : ` · Provider updated ${time(m.sourceUpdatedAt)}`}
      </Text>
    </View>
  );
}
function BinaryDetail({ market: m }: { market: BinaryPrediction }) {
  const { color } = useTheme();
  const [outcome, setOutcome] = useState("0");
  const selected = m.outcomes[Number(outcome)];
  return (
    <View style={styles.content}>
      <View style={styles.outcomes}>
        {m.outcomes.map((o, i) => (
          <View key={o.label} style={[styles.outcome, { backgroundColor: color.card }]}>
            <Text style={[TYPE.row, { color: color.text2 }]}>{o.label}</Text>
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[
                o.priceBps === null ? TYPE.rowAmount : TYPE.displayPrice,
                { color: i === 0 ? color.up : color.down },
              ]}
            >
              {percent(o.priceBps)}
            </Text>
          </View>
        ))}
      </View>
      {m.winner ? <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{m.winner} won</Text> : null}
      <ChipRow
        options={m.outcomes.map((o, i) => ({ value: String(i), label: `${o.label} history` }))}
        value={outcome}
        onChange={setOutcome}
        label="Outcome-price history"
      />
      <OutcomeChart
        key={`${m.id}:${outcome}`}
        id={m.id}
        outcome={Number(outcome)}
        label={selected?.label ?? "Outcome"}
      />
      <KeyValue
        label="Market liquidity"
        value={m.liquidityUsd6 === null ? "Unavailable" : compactUsd6(m.liquidityUsd6)}
      />
      <KeyValue label="Market volume" value={m.volumeUsd6 === null ? "Unavailable" : compactUsd6(m.volumeUsd6)} />
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Resolution rules
      </Text>
      <Text selectable style={[TYPE.body, { color: color.text2 }]}>
        {m.rules}
      </Text>
      {m.resolutionSource ? (
        <Text selectable style={[TYPE.meta, { color: color.text3 }]}>
          Source: {m.resolutionSource}
        </Text>
      ) : null}
    </View>
  );
}
function stake(m: PriceContest) {
  if (m.stakeDecimals === null) return `${m.stakeUnits} raw units`;
  const unit = DECIMAL_BASE ** BigInt(m.stakeDecimals);
  const whole = m.stakeUnits / unit;
  const fraction = (m.stakeUnits % unit).toString().padStart(m.stakeDecimals, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} ${m.stakeSymbol}`;
}
function ContestDetail({ market: m }: { market: PriceContest }) {
  const { color } = useTheme();
  return (
    <View style={styles.content}>
      <KeyValue label="Stake per entry" value={stake(m)} />
      <KeyValue label="Pool fee" value={percent(m.feesBps)} />
      <KeyValue label="Winner selection multiplier" value={`${m.multiplier100 / MULTIPLIER_SCALE}×`} />
      <KeyValue label="Price snapshot" value={time(m.snapshotAt)} />
      <KeyValue label="Entries" value={m.entries.toString()} />
      <KeyValue label="Recorded winners" value={m.winners.toString()} />
      <KeyValue label="Recorded claims" value={m.claimed.toString()} />
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        How this contest settles
      </Text>
      <Text style={[TYPE.body, { color: color.text2 }]}>
        Participants submit a numerical price prediction with a fixed stake. Castora operators supply the snapshot price
        and assign winners. Winners claim from the pool; entries cannot be sold as Up/Down shares. The contracts are
        upgradeable.
      </Text>
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        Finalized Monad block {m.blockNumber.toString()}
        {m.paused ? " · Contract paused" : ""}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SIZE.gutter },
  content: { gap: SPACE.md },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  outcomes: { flexDirection: "row", gap: SPACE.md },
  outcome: { flex: 1, minWidth: 0, padding: SPACE.md, gap: SPACE.sm },
});
