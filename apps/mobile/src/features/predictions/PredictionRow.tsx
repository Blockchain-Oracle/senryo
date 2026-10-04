import type { Prediction } from "@senryo/api-client";
import { usePrediction } from "@senryo/query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ReadingView } from "~/components/kit/states";
import { RowShell } from "~/features/markets/RowShell";
import { useNowSec } from "~/features/markets/useNowSec";
import { useWatchlist } from "~/features/markets/useWatchlist";
import { predictionRoute } from "~/lib/constants/routes";
import { SPACE, TYPE, useTheme } from "~/theme";
import { percent, predictionMark, statusText, time } from "./format";
import { type PredictionReference, predictionWatchKey } from "./references";
import { useFocused } from "./useFocused";

/** Search and Watchlist use the existing row grammar; a share price is labelled with its actual outcome. */
export function PredictionRow({ market: m, onOpen }: { market: Prediction; onOpen?: () => void }) {
  const { color } = useTheme();
  const watchlist = useWatchlist();
  const now = Number(useNowSec());
  const key = predictionWatchKey(m);
  const status = statusText(m, now);
  const outcome = m.kind === "binary" ? m.outcomes[0] : undefined;
  return (
    <RowShell
      mark={predictionMark(m.asset)}
      title={m.title}
      subtitle={`${m.provider === "polymarket" ? "Polymarket" : "Castora"} · ${m.settlementNetwork} · ${status} · ${time(m.closesAt)}`}
      price={outcome ? `${outcome.label} ${percent(outcome.priceBps)}` : null}
      changeBps={undefined}
      trailing={<Text style={[TYPE.meta, { color: color.text3 }]}>{watchlist.has(key) ? "★ Saved" : "View only"}</Text>}
      onPress={() => {
        onOpen?.();
        router.push(predictionRoute(m.provider, m.id));
      }}
      onLongPress={() => watchlist.toggle(key)}
      accessibilityLabel={`${m.title}, ${m.settlementNetwork}, ${status}${outcome ? `, ${outcome.label} ${percent(outcome.priceBps)}` : ""}${watchlist.has(key) ? ", saved" : ""}, view details`}
      accessibilityHint="Long-press to add or remove from your watchlist"
    />
  );
}

/** Saved/Recent entries read by immutable venue id, even after the market leaves live discovery. */
export function PredictionReferenceRow({
  reference,
  onOpen,
  removable = false,
}: {
  reference: PredictionReference;
  onOpen?: () => void;
  removable?: boolean;
}) {
  const focused = useFocused();
  // No timer per saved row: fetch on focus/mount and pull-refresh, while detail keeps its live interval.
  const data = usePrediction(reference.provider, reference.id, focused, false);
  const watchlist = useWatchlist();
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      {data.reading.status === "failed" ? (
        <Text style={[TYPE.meta, { color: color.text2 }]}>
          {reference.provider === "polymarket" ? "Polymarket" : "Castora"} · #{reference.id}
        </Text>
      ) : null}
      <ReadingView reading={data.reading} loadingLabel="Loading saved prediction" retry={data.retry}>
        {(market) => <PredictionRow market={market} {...(onOpen ? { onOpen } : {})} />}
      </ReadingView>
      {data.reading.status === "failed" && removable ? (
        <Button
          label="Remove unavailable prediction"
          variant="ghost"
          size="sm"
          onPress={() => watchlist.toggle(predictionWatchKey(reference))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ row: { paddingVertical: SPACE.xs } });
