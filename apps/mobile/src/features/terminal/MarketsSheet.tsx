/**
 * The market sheet (P2, D-321; Tradash's asset chip → Markets, research `review-2026-10-12`): above the dock and the
 * ticket, opening at 62 % and dragging to 88 % and full. A title with ✕, the search (focusing it raises the sheet to
 * full first), the filter chips — Favourites · Hot · All · Crypto · Stocks · Metals · FX · Baskets — then the rows:
 * your recent markets on an empty search, then the kinds. Each row is the Markets tab's row (24 h line, live price,
 * change; a closed market says when it opens) with a star; the current market is highlighted. Every open starts at
 * All with an empty search; picking ticks, closes, then moves the terminal.
 */
import { PICKER_FILTERS, type PickerFilter, readSymbols, toggleFavourite } from "@senryo/calls";
import { useMarketPicker } from "@senryo/calls/react";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { FilterChips } from "~/components/kit/FilterChips";
import { SearchField } from "~/components/kit/SearchField";
import { X } from "~/components/kit/symbols";
import { LIST_DETENTS } from "~/components/sheet/constants";
import { Sheet, useSheetClose, useSheetExpand } from "~/components/sheet/Sheet";
import { fire } from "~/feedback/fire";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { MarketRow } from "../markets/MarketRow";
import { RoundClock } from "../markets/RoundClock";

interface PickerMarket {
  symbol: string;
  name: string;
  kind: string;
}

function emptyLine(filter: PickerFilter): string {
  if (filter === "favourites") return "No favourites yet. Tap a star to add one.";
  if (filter === "hot") return "The day's moves arrive with the next price update.";
  return "No markets match that search.";
}

function Picker({
  markets,
  selected,
  onPick,
}: {
  markets: readonly PickerMarket[];
  selected: string;
  onPick: (symbol: string) => void;
}) {
  const { color } = useTheme();
  const close = useSheetClose();
  const expand = useSheetExpand();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PickerFilter>("all");
  const [favRaw, setFavRaw] = useMMKVString(STORAGE_KEYS.favouriteMarkets, storage);
  const favourites = useMemo(() => readSymbols(favRaw), [favRaw]);
  const sections = useMarketPicker(markets, { query, filter, favourites });
  const pick = (symbol: string) => {
    fire("tick");
    close(() => onPick(symbol));
  };
  const star = (symbol: string) => {
    fire("tick");
    setFavRaw(JSON.stringify(toggleFavourite(favourites, symbol)));
  };
  return (
    <>
      <View style={styles.title}>
        <Text accessibilityRole="header" style={[TYPE.sheetHeading, { color: color.ink }]}>
          Markets
        </Text>
        <Pressable
          onPress={() => close()}
          hitSlop={SPACE.sm}
          accessibilityRole="button"
          accessibilityLabel="Close markets"
          style={[styles.close, { backgroundColor: color.raised2 }]}
        >
          <X size={SIZE.iconSm} color={color.ink} />
        </Pressable>
      </View>
      <SearchField value={query} onChange={setQuery} onFocus={expand} />
      <FilterChips
        options={PICKER_FILTERS}
        value={filter}
        onChange={setFilter}
        label="Show markets"
        bleed={SHEET_SHAPE.padding}
      />
      <RoundClock />
      {sections.length === 0 ? (
        <Text style={[TYPE.body, styles.empty, { color: color.inkMuted }]}>{emptyLine(filter)}</Text>
      ) : (
        sections.map((s) => (
          <View key={s.label} accessibilityRole="list" accessibilityLabel={s.label}>
            <Text style={[TYPE.sectionTitle, styles.heading, { color: color.inkMuted }]}>{s.label}</Text>
            {s.markets.map((m) => (
              <MarketRow
                key={m.symbol}
                symbol={m.symbol}
                name={m.name}
                selected={m.symbol === selected}
                onOpen={() => pick(m.symbol)}
                star={{ on: favourites.includes(m.symbol), onToggle: () => star(m.symbol) }}
              />
            ))}
          </View>
        ))
      )}
    </>
  );
}

export function MarketsSheet({
  markets,
  selected,
  onPick,
  onClose,
}: {
  markets: readonly PickerMarket[];
  selected: string;
  onPick: (symbol: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} closeLabel="Close markets" detents={LIST_DETENTS}>
      <Picker markets={markets} selected={selected} onPick={onPick} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: {
    width: SIZE.touch - SPACE.sm,
    height: SIZE.touch - SPACE.sm,
    borderRadius: (SIZE.touch - SPACE.sm) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { paddingTop: SPACE.sm, paddingBottom: SPACE.xs },
  empty: { textAlign: "center", paddingVertical: SPACE.xl },
});
