import type { Prediction, PredictionListQuery } from "@senryo/api-client";
import { usePredictions } from "@senryo/query";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { SectionLabel } from "~/components/kit/Surface";
import { LoadingState, StaleStamp } from "~/components/kit/states";
import { QuietLine } from "~/features/markets/QuietLine";
import { useNowSec } from "~/features/markets/useNowSec";
import { useRecentSearches } from "~/features/search/useRecentSearches";
import { SPACE, TYPE, useTheme } from "~/theme";
import { PredictionRow } from "./PredictionRow";
import { matchesPrediction } from "./references";
import { useFocused } from "./useFocused";

const BASE: PredictionListQuery = { provider: "polymarket", asset: "all", window: "15m", state: "open" };
const PAGE_SIZE = 12;

/** Public data stays separate from authenticated trader search, including partial upstream failures. */
export function PredictionSearchResults({ query }: { query: string }) {
  const { color } = useTheme();
  const focused = useFocused();
  const short = usePredictions(BASE, focused, false);
  const fast = usePredictions({ ...BASE, window: "5m" }, focused, false);
  const prices = usePredictions({ ...BASE, window: "price-events" }, focused, false);
  const contests = usePredictions({ ...BASE, provider: "castora" }, focused, false);
  const sources = [short, fast, prices, contests];
  const { remember } = useRecentSearches();
  const now = Number(useNowSec());
  const [limit, setLimit] = useState(PAGE_SIZE);
  useEffect(() => setLimit(PAGE_SIZE), [query]);
  const unique = new Map<string, Prediction>();
  for (const { reading } of sources) {
    if (reading.status === "fresh" || reading.status === "stale") {
      for (const market of reading.value.markets) {
        if ((market.provider === "castora" || market.closesAt > now) && matchesPrediction(market, query)) {
          unique.set(`${market.provider}:${market.id}`, market);
        }
      }
    }
  }
  const matches = [...unique.values()];
  const pending = sources.some(({ reading }) => reading.status === "unknown");
  const failed = sources.filter(
    ({ reading }) => reading.status === "failed" || (reading.status === "stale" && reading.error),
  );
  const known = sources.some(({ reading }) => reading.status === "fresh" || reading.status === "stale");
  const stale = sources.flatMap(({ reading }) => (reading.status === "stale" ? [reading] : []));
  return (
    <View style={{ gap: SPACE.sm }}>
      <SectionLabel>Predictions</SectionLabel>
      {stale.length > 0 ? (
        <StaleStamp
          at={Math.min(...stale.map((reading) => reading.at))}
          refreshing={stale.some((reading) => reading.refreshing)}
          failed={stale.some((reading) => reading.error !== undefined)}
        />
      ) : null}
      {matches.slice(0, limit).map((market) => (
        <PredictionRow
          key={`${market.provider}:${market.id}`}
          market={market}
          onOpen={() => remember({ kind: "prediction", provider: market.provider, id: market.id })}
        />
      ))}
      {matches.length > limit ? (
        <Button label="More predictions" variant="ghost" onPress={() => setLimit((value) => value + PAGE_SIZE)} />
      ) : null}
      {pending ? <LoadingState shape="row" label="Searching prediction markets" /> : null}
      {known && !pending && matches.length === 0 ? (
        <QuietLine>No matching predictions in this selection</QuietLine>
      ) : null}
      {failed.length > 0 ? (
        <View style={{ gap: SPACE.sm }}>
          <Text accessibilityRole="alert" style={[TYPE.meta, { color: color.warn }]}>
            Some prediction data is unavailable
          </Text>
          <Button
            label="Retry predictions"
            variant="outline"
            size="sm"
            onPress={() => {
              for (const source of failed) void source.retry();
            }}
          />
        </View>
      ) : null}
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        Live BTC/ETH markets and Monad contests · Limited selection
      </Text>
    </View>
  );
}
