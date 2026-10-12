/**
 * Your open positions on the phone, live (Tradash's "Open positions", R5.3): the Unrealized PnL card — the total
 * rolling, its % of what went in, "N unpriced" when some can't be valued now, Close all (N) when more than one can
 * close — then a row per call and ride, and the parlays in play as a count (they have no live price). The positions
 * sheet, Home and Calls all show this one list.
 */
import { type BookTotals, dollars } from "@senryo/calls";
import { useLiveBook } from "@senryo/calls/react";
import { useFont } from "@shopify/react-native-skia";
import { type Href, router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { RollingFigure } from "~/components/kit/RollingFigure";
import { ChartCandlestick } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { PositionRow } from "./PositionRow";
import { usePositionClose } from "./usePositionClose";

const ROW_FONT = 14;
const TOTAL_FONT = 28;
const TOTAL_H = 34;
const BPS_PER_PERCENT = 100;
const PCT_DECIMALS = 2;
const PARLAY_ROUTE = "/parlay" as Href;

const signed = (v: bigint) => `${v < 0n ? "−" : "+"}${dollars(v)}`;

function Unrealized({
  totals,
  onCloseAll,
  closingAll,
}: {
  totals: BookTotals;
  onCloseAll: () => void;
  closingAll: boolean;
}) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const font = useFont(require("../../../assets/fonts/Inter-SemiBold.ttf"), TOTAL_FONT);
  const allUnpriced = totals.count > 0 && totals.unpriced === totals.count;
  const tone = totals.pnl >= 0n ? color.up : color.down;
  return (
    <View style={[styles.card, { backgroundColor: color.raised2 }]}>
      <View style={styles.cardHead}>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Unrealized PnL</Text>
        {totals.closable > 1 ? (
          <Pressable
            accessibilityRole="button"
            disabled={closingAll}
            onPress={onCloseAll}
            style={[styles.closeAll, { backgroundColor: color.downWash }]}
          >
            {closingAll ? <ActivityIndicator size="small" color={color.down} /> : null}
            <Text style={[TYPE.chipLabel, { color: color.down }]}>
              {closingAll ? "Closing…" : `Close all (${totals.closable})`}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {allUnpriced ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>No live value right now</Text>
      ) : hidden ? (
        <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{masked("", true)}</Text>
      ) : (
        <View style={styles.total}>
          <RollingFigure
            text={signed(totals.pnl)}
            value={totals.pnl}
            font={font}
            color={tone}
            height={TOTAL_H}
            align="left"
            accessibilityLabel={`Unrealized ${signed(totals.pnl)}`}
          />
        </View>
      )}
      {totals.count > 0 && !allUnpriced ? (
        <Text style={[TYPE.rowChange, { color: tone }]}>
          {totals.roiBps === null
            ? ""
            : `${totals.roiBps < 0 ? "−" : "+"}${Math.abs(totals.roiBps / BPS_PER_PERCENT).toFixed(PCT_DECIMALS)}%`}
          {totals.unpriced > 0 ? <Text style={{ color: color.text3 }}>{` · ${totals.unpriced} unpriced`}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

export function PositionsList({ empty = "card" }: { empty?: "card" | "none" }) {
  const { color } = useTheme();
  const book = useLiveBook();
  const actions = usePositionClose();
  const font = useFont(require("../../../assets/fonts/Inter-SemiBold.ttf"), ROW_FONT);
  if (book.entries.length === 0 && book.parlays === 0) {
    if (empty === "none") return null;
    return (
      <View style={[styles.empty, { backgroundColor: color.raised2 }]}>
        <ChartCandlestick size={SIZE.icon} color={color.text3} />
        <Text style={[TYPE.row, { color: color.inkMuted }]}>
          {book.ready ? "No open positions" : "Loading positions…"}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      <Unrealized
        totals={book.totals}
        onCloseAll={() => void actions.closeAll(book.entries)}
        closingAll={actions.closing.size > 1}
      />
      {book.entries.map((e) => (
        <PositionRow
          key={e.key}
          entry={e}
          font={font}
          closing={actions.closing.has(e.key)}
          onClose={(x) => void actions.close(x)}
        />
      ))}
      {book.parlays > 0 ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            fire("tick");
            router.push(PARLAY_ROUTE);
          }}
          style={[styles.card, { backgroundColor: color.raised2 }]}
        >
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>
            {book.parlays === 1 ? "1 parlay in play" : `${book.parlays} parlays in play`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.sm },
  card: { gap: SPACE.xs, padding: SPACE.md, borderRadius: SHEET_SHAPE.rowRadius },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  closeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    minHeight: SIZE.chipHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: SIZE.chipHeight / 2,
  },
  total: { height: TOTAL_H, alignSelf: "stretch" },
  empty: {
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.xl,
    borderRadius: SHEET_SHAPE.rowRadius,
  },
});
