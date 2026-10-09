/**
 * A call's share card (pivot S5.13 / S8 "share card"; Owarine `terminal/share-png.ts` charm card, re-laid out for a
 * 4 : 5 phone post; 21st.dev "share card" searches returned access-sharing widgets — none fit). The welcome sky, a
 * tilted paper card with the market and side, the result huge in its colour, entry → exit, 千両 in the corner, then
 * the seal, the line and the link with its QR. Fixed paper colours in either theme: it is an image, not a screen.
 * Rendered off-screen at 360 × 450 and captured at 3× (1080 × 1350).
 */
import type { ShareCall } from "@senryo/calls";
import { ids, marketId } from "@senryo/identity";
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { QrCode } from "~/components/kit/QrCode";
import { TYPE, useTheme } from "~/theme";

export const CARD_W = 360;
export const CARD_H = 450;
const MARK = 40;
const SEAL = 44;
const QR = 76;
const TILT = "-3deg";
const RADIUS = 28;
const PAD = 22;
const GAP = 6;
const RESULT_SIZE = 64;
const RESULT_LINE = 70;
const CALL_SIZE = 26;
const KANJI_SIZE = 40;
const BRAND_SIZE = 22;
const KANJI_ALPHA = 0.12;
const DETAIL_ALPHA = 0.65;

export type { ShareCall } from "@senryo/calls";

export const ShareCard = forwardRef<View, { card: ShareCall }>(function ShareCard({ card }, ref) {
  const { color } = useTheme();
  return (
    <View ref={ref} collapsable={false} style={[styles.canvas, { backgroundColor: color.welcomeSky }]}>
      <View style={[styles.charm, { backgroundColor: color.paper }]}>
        <View style={styles.head}>
          <EntityMark id={marketId(card.symbol)} size={MARK} decorative />
          <Text style={[TYPE.title, styles.call, { color: color.paperInk }]} numberOfLines={1} adjustsFontSizeToFit>
            {card.call.toUpperCase()}
          </Text>
        </View>
        <Text
          style={[TYPE.displayBalance, styles.result, { color: card.won ? color.chartUp : color.chartDown }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {card.result}
        </Text>
        <View style={styles.details}>
          {card.entry ? (
            <Text style={[TYPE.body, { color: color.paperInk, opacity: DETAIL_ALPHA }]}>Entry {card.entry}</Text>
          ) : null}
          {card.exit ? (
            <Text style={[TYPE.body, { color: color.paperInk, opacity: DETAIL_ALPHA }]}>
              {card.exitLabel} {card.exit}
            </Text>
          ) : null}
          <Text style={[TYPE.caption, { color: color.paperInk, opacity: DETAIL_ALPHA }]}>{card.mode}</Text>
        </View>
        <Text style={[styles.kanji, { color: color.paperInk, opacity: KANJI_ALPHA }]}>千両</Text>
      </View>
      <View style={styles.foot}>
        <View style={[styles.seal, { backgroundColor: color.action }]}>
          <EntityMark id={ids.brand("senryo")} size={SEAL} variant="symbol" decorative ground={color.action} />
        </View>
        <View style={styles.brand}>
          <Text style={[TYPE.title, styles.brandName, { color: color.welcomeInk }]}>SENRYO</Text>
          <Text style={[TYPE.caption, { color: color.welcomeInk }]}>Call the next move.</Text>
          <Text style={[TYPE.caption, { color: color.welcomeInk }]} numberOfLines={1}>
            {card.url.replace(/^https?:\/\//, "")}
          </Text>
        </View>
        <View style={[styles.qr, { backgroundColor: color.paper }]}>
          <QrCode value={card.url} label="Open this call" size={QR} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: { width: CARD_W, height: CARD_H, padding: PAD, justifyContent: "space-between" },
  charm: { borderRadius: RADIUS, padding: PAD, gap: GAP * 2, transform: [{ rotate: TILT }] },
  head: { flexDirection: "row", alignItems: "center", gap: GAP * 2 },
  call: { flex: 1, fontSize: CALL_SIZE, fontWeight: "900" },
  result: { fontSize: RESULT_SIZE, lineHeight: RESULT_LINE },
  details: { gap: GAP / 2 },
  kanji: { position: "absolute", right: PAD, bottom: PAD / 2, fontSize: KANJI_SIZE, fontWeight: "900" },
  foot: { flexDirection: "row", alignItems: "center", gap: GAP * 2 },
  seal: {
    width: SEAL + GAP * 2,
    height: SEAL + GAP * 2,
    borderRadius: GAP * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { flex: 1, gap: 1 },
  brandName: { fontSize: BRAND_SIZE, fontWeight: "900" },
  qr: { padding: GAP, borderRadius: GAP * 2 },
});
