/**
 * A market as a row (F7, research 10 §2; Markets, Home and the market sheet): the real mark, symbol and its name with
 * the market's own note ("Closes 17:00 ET", "Opens 09:30 ET") — the shared 1-minute countdown is said once above the
 * list (`RoundClock`, D-348),
 * the day's sparkline against the price 24 hours ago (D-319), the live price — the last print, muted, when closed —
 * with its 24 h change, then a chevron, or a star in the market sheet (P2). The current market is highlighted.
 */
import { unitOf } from "@senryo/calls";
import { useDayLine, useMarketLine } from "@senryo/calls/react";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ChangeChip } from "~/components/kit/ChangeChip";
import { Sparkline } from "~/components/kit/Sparkline";
import { ChevronRight, Star } from "~/components/kit/symbols";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { formatValue, priceDecimals } from "../terminal/chart/engine";

const MARK = 40;
const E8 = 1e8;
/** The price column's least width, so the graphs line up row to row (a five-figure price fits). */
const FIGURES_MIN = 100;

export function MarketRow({
  symbol,
  name,
  onOpen,
  selected = false,
  star,
}: {
  symbol: string;
  name: string;
  onOpen: () => void;
  selected?: boolean;
  /** A favourite toggle in place of the chevron (the market sheet). */
  star?: { on: boolean; onToggle: () => void };
}) {
  const { color } = useTheme();
  const price = useLivePrice(symbol);
  const line = useMarketLine(symbol);
  const day = useDayLine(symbol);
  const points = unitOf(symbol) === "points";
  const text = price ? formatValue(price / E8, priceDecimals(price / E8), points) : undefined;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}${text ? `, ${text}` : ""}. ${line.trading ? "" : `${line.text}. `}${star ? "Pick" : "Open the terminal"}`}
      style={({ pressed }) => [
        styles.row,
        selected && { backgroundColor: color.selectedRow },
        pressed && { backgroundColor: color.rowPressed },
      ]}
    >
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <View style={styles.text}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={1}>
          {symbol}
        </Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={1}>
          {line.note ? `${name} · ${line.note}` : name}
        </Text>
      </View>
      {day ? <Sparkline symbol={symbol} day={day} /> : null}
      <View style={styles.figures}>
        <Text style={[TYPE.rowTitle, { color: line.trading ? color.ink : color.inkMuted }]}>{text ?? "—"}</Text>
        {day ? <ChangeChip symbol={symbol} day={day} /> : null}
      </View>
      {star ? (
        <Pressable
          onPress={star.onToggle}
          hitSlop={SPACE.sm}
          accessibilityRole="button"
          accessibilityState={{ selected: star.on }}
          accessibilityLabel={star.on ? `Remove ${symbol} from favourites` : `Add ${symbol} to favourites`}
          style={styles.star}
        >
          <Star
            size={SIZE.iconSm}
            color={star.on ? color.gold : color.inkMuted}
            {...(star.on ? { fill: color.gold } : {})}
          />
        </Pressable>
      ) : (
        <ChevronRight size={SIZE.iconSm} color={color.inkMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The row reaches past the gutter by its own inset, so a highlight has room around the mark.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch + SPACE.xl + SPACE.xs,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.sm,
  },
  text: { flex: 1 },
  figures: { alignItems: "flex-end", gap: SPACE.xxs, minWidth: FIGURES_MIN },
  star: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
});
