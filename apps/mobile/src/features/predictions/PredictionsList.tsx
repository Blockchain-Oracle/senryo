import type { Prediction, PredictionListQuery } from "@senryo/api-client";
import { usePredictions } from "@senryo/query";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ChipRow } from "~/components/kit/ChipRow";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { useNowSec } from "~/features/markets/useNowSec";
import { fire } from "~/feedback/fire";
import { predictionRoute } from "~/lib/constants/routes";
import { CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { countdown, percent, predictionMark, statusText, time } from "./format";
import { useFocused } from "./useFocused";

const VIEWS = [
  { value: "open", label: "Live & upcoming" },
  { value: "recent", label: "Recent" },
  { value: "contests", label: "Monad contests" },
] as const;
const ASSETS = [
  { value: "all", label: "All" },
  { value: "BTC", label: "Bitcoin" },
  { value: "ETH", label: "Ethereum" },
] as const;
const WINDOWS = [
  { value: "15m", label: "15 minutes" },
  { value: "5m", label: "5 minutes" },
  { value: "price-events", label: "Price events" },
] as const;

/** FT050: compact outcome cards → public detail; each provider keeps its real model and settlement network. */
export function PredictionsList({ bottom }: { bottom: number }) {
  const { color } = useTheme();
  const [view, setView] = useState<"open" | "recent" | "contests">("open");
  const [asset, setAsset] = useState<PredictionListQuery["asset"]>("all");
  const [window, setWindow] = useState<PredictionListQuery["window"]>("15m");
  const focused = useFocused();
  const data = usePredictions(
    {
      provider: view === "contests" ? "castora" : "polymarket",
      asset,
      window,
      state: view === "recent" ? "recent" : "open",
    },
    focused,
  );
  const now = Number(useNowSec());
  return (
    <View style={styles.fill}>
      <View style={styles.controls}>
        <ChipRow options={VIEWS} value={view} onChange={setView} label="Prediction type" />
        {view === "contests" ? null : (
          <>
            <ChipRow options={ASSETS} value={asset} onChange={setAsset} label="Prediction asset" />
            <ChipRow options={WINDOWS} value={window} onChange={setWindow} label="Prediction window" />
          </>
        )}
        <Text style={[TYPE.meta, styles.caption, { color: color.text3 }]}>
          {view === "contests"
            ? "Castora · Monad · Price contests · View only"
            : "Polymarket · Polygon · Outcome shares · View only"}
        </Text>
      </View>
      <ReadingView reading={data.reading} loading="list" loadingLabel="Loading prediction markets" retry={data.retry}>
        {(page) => {
          const markets = view === "open" ? page.markets.filter((m) => m.closesAt > now) : page.markets;
          return (
            <FlashList
              data={markets}
              numColumns={2}
              keyExtractor={(m) => `${m.provider}:${m.id}`}
              renderItem={({ item }) => <PredictionCard market={item} now={now} />}
              contentContainerStyle={{ paddingHorizontal: SIZE.gutter - SPACE.xs, paddingBottom: bottom }}
              refreshControl={<RefreshControl refreshing={false} onRefresh={data.retry} tintColor={color.text2} />}
              ListHeaderComponent={
                view === "contests" && !markets.some((m) => m.status === "open" && m.closesAt > now) ? (
                  <View style={styles.empty}>
                    <EmptyState
                      why="No open contests in this scan"
                      detail="Past contests and their recorded settlement states appear below."
                    />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <EmptyState
                    why="No markets in this window"
                    detail="Try another time window or refresh for the next event."
                    action={{ label: "Refresh", onPress: data.retry }}
                  />
                </View>
              }
              ListFooterComponent={
                <Text style={[TYPE.meta, styles.caption, { color: color.text3 }]}>
                  Observed {time(page.observedAt)}
                  {page.limited ? " · Showing a bounded selection" : ""}
                </Text>
              }
            />
          );
        }}
      </ReadingView>
    </View>
  );
}

function PredictionCard({ market: m, now }: { market: Prediction; now: number }) {
  const { color } = useTheme();
  const status = statusText(m, now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${m.title}, ${status}, view details`}
      onPress={() => {
        fire("tick");
        router.push(predictionRoute(m.provider, m.id));
      }}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? color.rowPressed : color.card }]}
    >
      <View style={styles.identity}>
        <EntityMark id={predictionMark(m.asset)} size={SIZE.icon + SPACE.sm} />
        <Text style={[TYPE.row, { color: color.ink }]}>{m.asset}</Text>
      </View>
      <Text style={[TYPE.sectionTitle, { color: color.ink }]}>
        {m.kind === "binary" ? (m.window ? "Up or Down" : m.title) : "Price contest"}
      </Text>
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        {m.kind === "binary" ? `${m.window ?? ""} · ${time(m.closesAt)}` : `#${m.id} · ${time(m.snapshotAt)}`}
      </Text>
      <Text style={[TYPE.meta, { color: color.text2 }]}>
        {status}
        {status === "Live" ? ` · ${countdown(m.closesAt, now)}` : ""}
      </Text>
      {m.kind === "binary" ? (
        <View style={styles.outcomes}>
          {m.outcomes.map((o, i) => (
            <View key={o.label} style={styles.outcome}>
              <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
                {o.label}
              </Text>
              <Text
                maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                style={[TYPE.rowAmount, { color: i === 0 ? color.up : color.down }]}
              >
                {percent(o.priceBps)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          {m.entries.toString()} entries · {m.winners.toString()} winners
        </Text>
      )}
      {m.kind === "binary" && m.winner ? <Text style={[TYPE.meta, { color: color.ink }]}>{m.winner} won</Text> : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  controls: { gap: SPACE.sm, paddingBottom: SPACE.md },
  caption: { paddingHorizontal: SIZE.gutter, paddingVertical: SPACE.sm },
  card: { flex: 1, minWidth: 0, padding: SPACE.md, gap: SPACE.sm, margin: SPACE.xs, borderRadius: RADIUS.lg },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  outcomes: { flexDirection: "row", gap: SPACE.sm, paddingTop: SPACE.sm },
  outcome: { flex: 1, gap: SPACE.xs },
  empty: { padding: SPACE.sm },
});
