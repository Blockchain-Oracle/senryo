/**
 * Close all, reviewed first (D-343, Codex direction 15 §3): how many close, what they return together at today's
 * quotes (live while it's open), how many can't, that they close one at a time — and the one control, "Close 2 ·
 * $10.08", which then counts through them ("Closing 1 of 2…"). Rows that don't close stay in the list.
 */
import { type CloseReview, dollars } from "@senryo/calls";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SPACE, TYPE, useTheme } from "~/theme";

const ROW = 44;

function Body({
  review,
  batch,
  onRun,
}: {
  review: CloseReview;
  batch: { at: number; of: number } | null;
  onRun: () => Promise<void>;
}) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const close = useSheetClose();
  const n = review.entries.length;
  const estimate = masked(dollars(review.estimate), hidden);
  return (
    <View style={styles.body}>
      <View style={styles.fact}>
        <Text style={[TYPE.row, styles.grow, { color: color.inkMuted }]}>Estimated return</Text>
        <Text style={[TYPE.rowAmount, { color: color.ink }]}>{estimate}</Text>
      </View>
      {review.unavailable > 0 ? (
        <Text style={[TYPE.rowDetail, { color: color.inkMuted }]}>
          {review.unavailable === 1
            ? "1 position can't close right now."
            : `${review.unavailable} positions can't close right now.`}
        </Text>
      ) : null}
      <Text style={[TYPE.rowDetail, { color: color.inkMuted }]}>Closes one at a time.</Text>
      <Button
        label={batch ? `Closing ${batch.at} of ${batch.of}…` : `Close ${n} · ${estimate}`}
        loading={batch !== null}
        onPress={() => void onRun().then(() => close())}
      />
    </View>
  );
}

export function CloseAllSheet({
  review,
  batch,
  onRun,
  onClose,
}: {
  review: CloseReview;
  batch: { at: number; of: number } | null;
  onRun: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} closeLabel="Close the review">
      <SheetHeading title={`Close ${review.entries.length} positions`} />
      <Body review={review} batch={batch} onRun={onRun} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md, paddingBottom: SPACE.lg },
  fact: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: ROW },
  grow: { flex: 1 },
});
