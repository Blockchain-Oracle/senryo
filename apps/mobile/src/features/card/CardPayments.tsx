/**
 * The card's own payments (E6): one row per purchase — a glyph disc, the merchant, its lifecycle word (Pending · Paid ·
 * Released · Refunded, or Declined with its reason in ≤ 4 words) and the amount, coloured only by direction. Rows are
 * bare on the page, fade in 30 ms apart once per mount, shrink 0.97 under the finger and open the payment.
 */
import type { CardAuthSummary } from "@senryo/api-client";
import type { AllowanceState } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  ArrowDownUp,
  Ban,
  Books,
  CreditCard,
  Electronics,
  Food,
  Groceries,
  Shopping,
  type SymbolIcon,
  Transport,
} from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { cardAuthRoute } from "~/lib/constants/routes";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { signedUsd, usd } from "~/lib/money";
import { RADIUS, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { ROW_STAGGER_MS } from "./constants";
import { type PaymentView, paymentView } from "./payment";

const GLYPH = 20;

export function CardPayments({ rows, allowance }: { rows: readonly CardAuthSummary[]; allowance?: AllowanceState }) {
  return (
    <View>
      {rows.map((row, index) => (
        <Animated.View
          key={row.id}
          entering={FadeInDown.duration(TIMING.staggerItem)
            .delay(index * ROW_STAGGER_MS)
            .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
        >
          <PaymentRow id={row.id} view={paymentView(row, allowance)} />
        </Animated.View>
      ))}
    </View>
  );
}

/** The amount as the row shows it: a purchase leaves (−), a refund arrives (+), a decline moved nothing. */
export function paymentAmount(view: PaymentView): string {
  if (view.stage === "declined") return usd(view.amountUsd6);
  return signedUsd(view.stage === "refund" ? view.amountUsd6 : -view.amountUsd6);
}

/** The status line: the word, then the hold when it is above the amount (tip / FX buffers settle lower). */
export function paymentDetail(view: PaymentView): string {
  return view.stage === "pending" && view.holdUsd6 ? `${view.status} · Hold ${usd(view.holdUsd6)}` : view.status;
}

/** ISO 18245 merchant category ranges → the row's glyph (card payments read like a bank statement, not a ledger). */
const CATEGORY_GLYPHS: readonly { from: number; to: number; glyph: SymbolIcon }[] = [
  { from: 5811, to: 5814, glyph: Food },
  { from: 5411, to: 5499, glyph: Groceries },
  { from: 4111, to: 4131, glyph: Transport },
  { from: 5942, to: 5942, glyph: Books },
  { from: 5732, to: 5734, glyph: Electronics },
  { from: 5300, to: 5399, glyph: Shopping },
];

function categoryGlyph(mcc: string | null | undefined): SymbolIcon {
  const code = mcc ? Number(mcc) : Number.NaN;
  return CATEGORY_GLYPHS.find((c) => code >= c.from && code <= c.to)?.glyph ?? CreditCard;
}

export function PaymentGlyph({ view, size = SIZE.markRow }: { view: PaymentView; size?: number }) {
  const { color } = useTheme();
  const Glyph = view.stage === "declined" ? Ban : view.stage === "refund" ? ArrowDownUp : categoryGlyph(view.mcc);
  return (
    <View style={[styles.disc, { width: size, height: size, backgroundColor: color.raised2 }]}>
      <Glyph size={GLYPH} color={view.stage === "declined" ? color.text3 : color.ink} />
    </View>
  );
}

function PaymentRow({ id, view }: { id: string; view: PaymentView }) {
  const { color } = useTheme();
  const press = usePressScale();
  const [hidden] = useHideBalances();
  const amount = masked(paymentAmount(view), hidden);
  const detail = hidden ? view.status : paymentDetail(view);
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          router.push(cardAuthRoute(id));
        }}
        accessibilityRole="button"
        accessibilityLabel={`${view.merchant}, ${detail}, ${amount}`}
        style={styles.row}
      >
        <PaymentGlyph view={view} />
        <View style={styles.text}>
          <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
            {view.merchant}
          </Text>
          <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
            {detail}
          </Text>
        </View>
        <Text
          style={[
            TYPE.rowAmount,
            { color: view.stage === "declined" ? color.text3 : view.stage === "refund" ? color.up : color.ink },
          ]}
        >
          {amount}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.rowMinHeight },
  disc: { borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: SPACE.xxs },
});
