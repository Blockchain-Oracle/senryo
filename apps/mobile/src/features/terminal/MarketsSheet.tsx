/**
 * The markets sheet (Tradash's asset chip → Markets): every catalogue market on this network with its real mark, name
 * and live price; picking one moves the terminal there. Prices render at most once a frame, and only while it's open.
 */
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { formatUsd } from "./chart/engine";

const MARK = 36;
const E8 = 1e8;

interface MarketRow {
  symbol: string;
  name: string;
}

function Row({ market, selected, onPick }: { market: MarketRow; selected: boolean; onPick: () => void }) {
  const { color } = useTheme();
  const price = useLivePrice(market.symbol);
  const close = useSheetClose();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        close(onPick);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${market.name}${price ? `, ${formatUsd(price / E8)}` : ""}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.rowPressed }]}
    >
      <EntityMark id={marketId(market.symbol)} size={MARK} decorative />
      <View style={styles.text}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{market.symbol}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{market.name}</Text>
      </View>
      <Text style={[TYPE.rowTitle, { color: color.ink }]}>{price ? formatUsd(price / E8) : "—"}</Text>
    </Pressable>
  );
}

export function MarketsSheet({
  markets,
  selected,
  onPick,
  onClose,
}: {
  markets: readonly MarketRow[];
  selected: string;
  onPick: (symbol: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} closeLabel="Close markets">
      <SheetHeading title="Markets" />
      <View>
        {markets.map((m) => (
          <Row key={m.symbol} market={m} selected={m.symbol === selected} onPick={() => onPick(m.symbol)} />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.touch + SPACE.lg,
    paddingHorizontal: SIZE.gutter,
  },
  text: { flex: 1 },
});
