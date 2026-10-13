/**
 * Your open positions on the phone, live (D-343, Codex direction 15 §3, §7): one grounded group — a quiet Unrealized
 * header (the total rolling, its ROI, "N unpriced" when some can't be valued; "Close all (3)" or "Close available (2)"
 * as plain text when two or more can close, opening a review) over a live row per call and ride. Around it: a trade on
 * its way as its pending paper (R5.11), the parlays in play as a count, this session's ended trades under "Just
 * finished". The positions sheet, Home and Calls all show this one list.
 */
import { type BookTotals, closeReview, pnlText, roiText } from "@senryo/calls";
import { useLiveBook, useTradeRuns } from "@senryo/calls/react";
import { useFont } from "@shopify/react-native-skia";
import { type Href, router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { RollingFigure } from "~/components/kit/RollingFigure";
import { ChartCandlestick } from "~/components/kit/symbols";
import { FinishedSlip } from "~/features/receipts/FinishedSlip";
import { PendingTradeCard } from "~/features/receipts/PendingTradeCard";
import { fire } from "~/feedback/fire";
import { HIDDEN_AMOUNT, useHideBalances } from "~/lib/hide-balances";
import { useClockOffset } from "~/lib/use-clock-offset";
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { CloseAllSheet } from "./CloseAllSheet";
import { PositionRow } from "./PositionRow";
import { usePositionClose } from "./usePositionClose";

const ROW_FONT = 24;
const TOTAL_FONT = 32;
const TOTAL_H = 36;
const PARLAY_ROUTE = "/parlay" as Href;
const DISPLAY_FONT = require("../../../assets/fonts/RobotoCondensed-Black.ttf");

function Unrealized({ totals, action, onReview }: { totals: BookTotals; action: string | null; onReview: () => void }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const font = useFont(DISPLAY_FONT, TOTAL_FONT);
  const allUnpriced = totals.count > 0 && totals.unpriced === totals.count;
  const tone = totals.pnl >= 0n ? color.up : color.down;
  const roi = totals.roiBps === null ? null : roiText(totals.roiBps);
  const unpriced = totals.unpriced > 0 ? `${totals.unpriced} unpriced` : null;
  return (
    <View style={styles.header}>
      <View style={styles.headLine}>
        <Text style={[TYPE.rowDetail, styles.grow, { color: color.inkMuted }]}>Unrealized PnL</Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={SPACE.sm}
            onPress={() => {
              fire("tick", { cue: "sheetOpen" });
              onReview();
            }}
          >
            <Text style={[TYPE.rowStrong, { color: color.ink }]}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {allUnpriced ? (
        <>
          <Text style={[TYPE.displayPrice, { color: color.inkMuted }]}>—</Text>
          <Text style={[TYPE.meta, { color: color.inkMuted }]}>No live value right now</Text>
        </>
      ) : (
        <>
          {hidden ? (
            <Text style={[TYPE.displayPrice, { color: color.inkMuted }]}>{HIDDEN_AMOUNT}</Text>
          ) : (
            <View style={styles.total}>
              <RollingFigure
                text={pnlText(totals.pnl)}
                value={totals.pnl}
                font={font}
                color={tone}
                height={TOTAL_H}
                align="left"
                accessibilityLabel={`Unrealized ${pnlText(totals.pnl)}`}
              />
            </View>
          )}
          {roi || unpriced ? (
            <Text style={[TYPE.moneyMeta, { color: hidden ? color.inkMuted : tone }]}>
              {hidden ? HIDDEN_AMOUNT : roi}
              {unpriced ? <Text style={{ color: color.inkMuted }}>{roi ? ` · ${unpriced}` : unpriced}</Text> : null}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

/**
 * `ground`: the surface the list sits on (a sheet's popover), for the slips' perforations. `onPick`: a row opened its
 * trade (the terminal's sheet closes itself).
 */
export function PositionsList({
  empty = "card",
  ground,
  onPick,
}: {
  empty?: "card" | "none";
  ground?: string;
  onPick?: () => void;
}) {
  const { color } = useTheme();
  const book = useLiveBook();
  const actions = usePositionClose();
  const font = useFont(DISPLAY_FONT, ROW_FONT);
  const offsetMs = useClockOffset();
  const openSwipe = useRef<SwipeableMethods | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const review = closeReview(book.entries);
  // The review keeps what it showed while its run empties the list under it.
  const shown = useRef(review);
  if (review) shown.current = review;
  const runs = useTradeRuns((instrument, id) => book.entries.some((e) => e.kind === instrument && e.id === id));
  const quiet = runs.pending.length === 0 && runs.finished.length === 0;
  if (book.entries.length === 0 && book.parlays === 0 && quiet) {
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
      {runs.pending.map((run) => (
        <PendingTradeCard key={run.key} run={run} />
      ))}
      {book.entries.length > 0 ? (
        <View style={[styles.group, { backgroundColor: color.raised2 }]}>
          <Unrealized totals={book.totals} action={review?.action ?? null} onReview={() => setReviewing(true)} />
          {book.entries.map((e) => (
            <PositionRow
              key={e.key}
              entry={e}
              font={font}
              offsetMs={offsetMs}
              openSwipe={openSwipe}
              closing={actions.closing.has(e.key)}
              onClose={(x) => void actions.close(x)}
              {...(onPick ? { onPick } : {})}
            />
          ))}
        </View>
      ) : null}
      {book.parlays > 0 ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            fire("tick");
            router.push(PARLAY_ROUTE);
          }}
          style={[styles.parlays, { backgroundColor: color.raised2 }]}
        >
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>
            {book.parlays === 1 ? "1 parlay in play" : `${book.parlays} parlays in play`}
          </Text>
        </Pressable>
      ) : null}
      {runs.finished.length > 0 ? (
        <>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Just finished</Text>
          {runs.finished.map((run) => (
            <FinishedSlip key={`${run.instrument}-${run.id}`} run={run} ground={ground} />
          ))}
        </>
      ) : null}
      {reviewing && shown.current ? (
        <CloseAllSheet
          review={review ?? shown.current}
          batch={actions.batch}
          onRun={() => actions.closeAll((review ?? shown.current)?.entries ?? [])}
          onClose={() => setReviewing(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.sm },
  group: { borderRadius: SHEET_SHAPE.rowRadius, overflow: "hidden", paddingBottom: SPACE.xs },
  header: { gap: SPACE.xxs, paddingHorizontal: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.xs },
  headLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  grow: { flex: 1 },
  total: { height: TOTAL_H, alignSelf: "stretch" },
  parlays: { padding: SPACE.md, borderRadius: SHEET_SHAPE.rowRadius },
  empty: {
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.xl,
    borderRadius: SHEET_SHAPE.rowRadius,
  },
});
