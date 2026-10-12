/**
 * The focused trade in the View-position pill's place on the phone (R5.11; the web's `CompactTrade`): a trade on its
 * way ("Waiting for the fill") or the one that just ended (its realised figure and its stamp's words) as a small
 * paper; a tap opens the positions with it.
 */
import type { FinishedTrade, PendingTrade } from "@senryo/calls/react";
import { useFinishedSlip } from "@senryo/calls/react";
import { marketId } from "@senryo/identity";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { fire } from "~/feedback/fire";
import { HIDDEN_AMOUNT, useHideBalances } from "~/lib/hide-balances";
import { ELEVATION, FONT, KINPAKU, NUMERIC_VARIANT, RECEIPT, SLIP, SPACE } from "~/theme";

const MARK = 28;
const CHIP_PAD = 6;
const PENDING_WORD: Record<PendingTrade["stage"], string> = {
  signing: "Signing…",
  pending: "Waiting for the fill",
  booked: "Booked",
};

export function CompactTrade({
  pending,
  finished,
  onOpen,
}: {
  pending: PendingTrade | undefined;
  finished: FinishedTrade | undefined;
  onOpen: () => void;
}) {
  const slip = useFinishedSlip(pending ? undefined : finished);
  const [hidden] = useHideBalances();
  const symbol = pending?.symbol ?? slip?.symbol;
  if (!symbol) return null;
  const title = pending?.title ?? slip?.title ?? "";
  const line = pending
    ? PENDING_WORD[pending.stage]
    : slip
      ? `${slip.figure.label} ${hidden ? HIDDEN_AMOUNT : slip.figure.text}`
      : "";
  const tone = pending
    ? RECEIPT.ink
    : slip?.figure.tone === "up"
      ? RECEIPT.up
      : slip?.figure.tone === "down"
        ? RECEIPT.down
        : RECEIPT.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${line}. Open positions`}
      onPress={() => {
        fire("tick");
        onOpen();
      }}
      style={[styles.paper, ELEVATION.receipt]}
    >
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.line}>
          {pending && pending.stage !== "booked" ? <ActivityIndicator size="small" color={RECEIPT.ink} /> : null}
          <Text style={[styles.lineText, { color: tone }]}>{line}</Text>
        </View>
      </View>
      {!pending && slip?.stamp ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{slip.stamp.lines.join(" ").toUpperCase()}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  paper: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    width: "100%",
    maxWidth: SLIP.maxWidth,
    alignSelf: "center",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: SLIP.radius,
    backgroundColor: RECEIPT.paper,
  },
  text: { flex: 1, gap: SPACE.xs / 2 },
  title: { fontFamily: FONT.sansStrong, fontSize: SLIP.fact, lineHeight: SLIP.factLine, color: RECEIPT.ink },
  line: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  lineText: { fontFamily: FONT.sansBold, fontSize: SLIP.fact, lineHeight: SLIP.factLine, fontVariant: NUMERIC_VARIANT },
  chip: {
    paddingHorizontal: CHIP_PAD + 2,
    paddingVertical: CHIP_PAD,
    borderRadius: SLIP.stampRadius,
    backgroundColor: KINPAKU.lacquer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: KINPAKU.foilShade,
    transform: [{ rotate: SLIP.stampTilt }],
  },
  chipText: {
    fontFamily: FONT.display,
    fontSize: SLIP.label + 1,
    lineHeight: SLIP.labelLine,
    color: KINPAKU.foilHighlight,
  },
});
