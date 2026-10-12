/**
 * The trade slip on the phone (R5.11, D-331; the web's `TradeSlip`): Senryo and its folio, the market and side, the
 * realised figure with when it ended (what it pays, or its margin, while open), the stamp, the facts, the perforation
 * and the stub — the mode and the proof on screen; the link and its QR when it is drawn for sharing (`exporting`).
 * White paper in either theme; amounts masked while balances are hidden.
 */
import { maskedSlip, type TradeSlip as Slip } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { forwardRef } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { EntityMark } from "~/components/identity/EntityMark";
import { QrCode } from "~/components/kit/QrCode";
import { fire } from "~/feedback/fire";
import { HIDDEN_AMOUNT, useHideBalances } from "~/lib/hide-balances";
import { ELEVATION, FONT, NUMERIC_VARIANT, RECEIPT, SLIP, SPACE, TYPE, useTheme } from "~/theme";
import { ReceiptStamp } from "./ReceiptStamp";

const DASH = "4 4";
const LABEL_TRACKING = 0.8;

function Perforation({ notch }: { notch: string | null }) {
  return (
    <View style={styles.perf} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={SLIP.perf}>
        <Line
          x1={SLIP.perf}
          x2="100%"
          y1={SLIP.perf / 2}
          y2={SLIP.perf / 2}
          stroke={RECEIPT.rule}
          strokeWidth={1}
          strokeDasharray={DASH}
        />
      </Svg>
      {notch ? (
        <>
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: notch }]} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: notch }]} />
        </>
      ) : null}
    </View>
  );
}

export const TradeSlip = forwardRef<View, { slip: Slip; press?: boolean; exporting?: boolean }>(function TradeSlip(
  { slip: raw, press = false, exporting = false },
  ref,
) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const slip = hidden ? maskedSlip(raw, HIDDEN_AMOUNT) : raw;
  const tone = slip.figure.tone === "up" ? RECEIPT.up : slip.figure.tone === "down" ? RECEIPT.down : RECEIPT.ink;
  const proof = slip.proof;
  return (
    <View ref={ref} collapsable={false} style={[styles.paper, exporting ? null : ELEVATION.receipt]}>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.brand}>SENRYO</Text>
          <Text style={styles.folio}>{slip.folio}</Text>
        </View>
        <View style={styles.title}>
          <EntityMark id={marketId(slip.symbol)} size={SLIP.mark} decorative />
          <Text style={[TYPE.rowTitle, { color: RECEIPT.ink }]}>{slip.title}</Text>
        </View>
        <View style={styles.result}>
          <View style={styles.flex}>
            <Text style={styles.label}>{slip.figure.label.toUpperCase()}</Text>
            <Text style={[styles.figure, { color: tone }]} adjustsFontSizeToFit numberOfLines={1}>
              {slip.figure.text}
            </Text>
            <Text style={styles.muted}>{slip.when ?? "Open"}</Text>
          </View>
          {slip.stamp ? (
            <ReceiptStamp stamp={slip.stamp} press={press && !exporting} />
          ) : (
            <Text style={[styles.open, { borderColor: RECEIPT.rule }]}>Open</Text>
          )}
        </View>
        <View style={styles.facts}>
          {slip.facts.map((f) => (
            <View key={f.k} style={styles.fact} accessible accessibilityLabel={`${f.k} ${f.v}`}>
              <Text style={styles.muted}>{f.k}</Text>
              <Text style={styles.value}>{f.v}</Text>
            </View>
          ))}
        </View>
      </View>
      <Perforation notch={exporting ? null : color.ground} />
      <View style={styles.stub}>
        <View style={[styles.flex, styles.stubWords]}>
          <Text style={styles.muted}>{slip.mode}</Text>
          {exporting ? (
            <Text style={styles.muted} numberOfLines={1}>
              {slip.url.replace(/^https?:\/\//, "")}
            </Text>
          ) : proof ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                fire("tick");
                void Linking.openURL(proof.href);
              }}
            >
              <Text style={styles.link}>{proof.label}</Text>
            </Pressable>
          ) : null}
        </View>
        {exporting ? <QrCode value={slip.url} label={`Link to ${slip.folio}`} size={SLIP.qr} /> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  paper: {
    width: "100%",
    maxWidth: SLIP.maxWidth,
    alignSelf: "center",
    borderRadius: SLIP.radius,
    backgroundColor: RECEIPT.paper,
  },
  body: { padding: SLIP.pad, gap: SLIP.gap },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.md },
  brand: { fontFamily: FONT.display, fontSize: SLIP.label, lineHeight: SLIP.labelLine, color: RECEIPT.ink },
  folio: {
    fontFamily: FONT.sansMedium,
    fontSize: SLIP.label,
    lineHeight: SLIP.labelLine,
    letterSpacing: LABEL_TRACKING / 2,
    color: RECEIPT.muted,
    fontVariant: NUMERIC_VARIANT,
  },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  result: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md },
  flex: { flex: 1 },
  label: {
    fontFamily: FONT.sansMedium,
    fontSize: SLIP.label,
    lineHeight: SLIP.labelLine,
    letterSpacing: LABEL_TRACKING,
    color: RECEIPT.muted,
  },
  figure: {
    fontFamily: FONT.display,
    fontSize: SLIP.figure,
    lineHeight: SLIP.figureLine,
    fontVariant: NUMERIC_VARIANT,
  },
  muted: { fontFamily: FONT.sans, fontSize: SLIP.fact, lineHeight: SLIP.factLine, color: RECEIPT.muted },
  open: {
    alignSelf: "center",
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: SLIP.radius,
    fontFamily: FONT.sansStrong,
    fontSize: SLIP.fact,
    lineHeight: SLIP.factLine,
    color: RECEIPT.ink,
  },
  facts: { gap: SPACE.sm },
  fact: { flexDirection: "row", justifyContent: "space-between", gap: SPACE.md },
  value: {
    fontFamily: FONT.sansStrong,
    fontSize: SLIP.fact,
    lineHeight: SLIP.factLine,
    color: RECEIPT.ink,
    fontVariant: NUMERIC_VARIANT,
    textAlign: "right",
  },
  perf: { height: SLIP.perf, justifyContent: "center" },
  notch: { position: "absolute", width: SLIP.notch, height: SLIP.notch, borderRadius: SLIP.notch / 2 },
  notchLeft: { left: -SLIP.notch / 2 },
  notchRight: { right: -SLIP.notch / 2 },
  stub: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SLIP.pad,
    paddingTop: SPACE.sm,
    paddingBottom: SLIP.pad,
  },
  stubWords: { gap: SPACE.xs },
  link: {
    fontFamily: FONT.sansStrong,
    fontSize: SLIP.fact,
    lineHeight: SLIP.factLine,
    color: RECEIPT.ink,
    textDecorationLine: "underline",
  },
});
