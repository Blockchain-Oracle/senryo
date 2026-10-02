/**
 * Practice "Simulate a payment" (E4 step 1; D-042): a real Lithic sandbox authorisation at one of five merchants — the
 * service's presets, so the amounts and MCCs are the ones it tests (Coffee and Taxi carry the tip buffer; the laptop is
 * above the per-payment maximum). The decision comes back in the sheet in ≤ 4 words and the row lands on the Card tab;
 * nothing here is a fake row.
 */
import { CARD_SIMULATE_PRESETS, type CardSimulatePreset, type CardSimulateResult } from "@senryo/api-client";
import type { AllowanceState } from "@senryo/query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SheetRow } from "~/components/sheet/SheetRow";
import { fire } from "~/feedback/fire";
import { usd } from "~/lib/money";
import { SHEET_SHAPE, SPACE, TYPE, useTheme } from "~/theme";
import { PaymentGlyph } from "./CardPayments";
import { declineWords, merchantName, USD6_PER_CENT } from "./payment";
import { useSimulatePayment } from "./useCardService";

const PRESETS = Object.entries(CARD_SIMULATE_PRESETS) as ReadonlyArray<
  [CardSimulatePreset, (typeof CARD_SIMULATE_PRESETS)[CardSimulatePreset]]
>;

function resultWords(result: CardSimulateResult, allowance?: AllowanceState): string {
  const at = merchantName(result.descriptor);
  if (result.status === "APPROVED") return `Approved at ${at}`;
  if (result.status === "PENDING") return `Pending at ${at}`;
  return `Declined · ${declineWords(result.declineReason, allowance)}`;
}

export function SimulateSheet({ cardToken, allowance }: { cardToken: string; allowance?: AllowanceState }) {
  const { color } = useTheme();
  const simulate = useSimulatePayment();
  const busy = simulate.isPending ? simulate.variables?.preset : undefined;
  const result = simulate.data;
  const tone = result?.status === "APPROVED" ? color.up : result?.status === "DECLINED" ? color.down : color.text2;
  return (
    <>
      <SheetHeading title="Simulate a payment" />
      <View style={styles.result} accessibilityLiveRegion="polite">
        {result && !simulate.isPending ? (
          <Text style={[TYPE.rowTitle, { color: tone }]}>{resultWords(result, allowance)}</Text>
        ) : simulate.isError ? (
          <Text style={[TYPE.rowTitle, { color: color.down }]}>Couldn’t reach the card · Retry</Text>
        ) : (
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Practice money · test merchants</Text>
        )}
      </View>
      <View style={styles.rows}>
        {PRESETS.map(([preset, p], index) => (
          <SheetRow
            key={preset}
            index={index}
            title={merchantName(p.descriptor)}
            detail={usd(BigInt(p.amountCents) * USD6_PER_CENT)}
            leading={
              <PaymentGlyph
                view={{
                  merchant: p.descriptor,
                  mcc: p.mcc,
                  stage: "pending",
                  status: "",
                  amountUsd6: 0n,
                  holdUsd6: null,
                }}
              />
            }
            trailing={busy === preset ? <ActivityIndicator color={color.ink} /> : undefined}
            disabled={simulate.isPending}
            onPress={() =>
              simulate.mutate(
                { cardToken, preset },
                {
                  onSuccess: (r) =>
                    fire(r.status === "APPROVED" ? "confirm" : r.status === "DECLINED" ? "fail" : "tick"),
                  onError: () => fire("fail"),
                },
              )
            }
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  result: { alignItems: "center", minHeight: SPACE.xl, justifyContent: "center" },
  rows: { gap: SHEET_SHAPE.rowGap },
});
