/**
 * One card payment (E6 step 4): the merchant, the amount, its lifecycle word, and the steps it went through —
 * authorised, held, then paid / released / refunded, or declined with its reason. A sandbox card (Practice, or the
 * Mainnet test card) can drive the issuer's next step from here: Settle or Void a pending payment, Refund a paid one —
 * real Lithic sandbox events, whose webhooks move the row. Any id resolves (`GET /v1/card/auth/:id`), not only the
 * last 20; an unknown one says so in four words.
 */

import { networkOf } from "@senryo/config";
import { useAccountRisk } from "@senryo/query";
import { router, Stack } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { LoadingState } from "~/components/kit/states";
import { ReceiptSaveButton } from "~/features/activity/ReceiptSaveButton";
import { saveReceiptDocument } from "~/features/activity/receipt-export";
import { dayLabel } from "~/features/markets/periods";
import { QuietLine } from "~/features/markets/QuietLine";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { clockTime } from "~/lib/format";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { PaymentGlyph, paymentAmount, paymentDetail } from "./CardPayments";
import { type PaymentView, paymentView } from "./payment";
import { allowanceNow } from "./SpendableHero";
import { type SimulateStep, useSimulateStep } from "./useCardService";
import { useCardPayment, useCardSummary } from "./useCardSummary";

const STEP_LABEL: Record<SimulateStep, string> = { clear: "Settle", void: "Void", return: "Refund" };

/** The steps a payment went through, in order (E6: "Authorized → Hold $6.00 → Paid $5.00"). */
function steps(view: PaymentView, holdUsd6: bigint | null, at: number): ReadonlyArray<readonly [string, string]> {
  const when = `${dayLabel(at)} ${clockTime(at)}`;
  if (view.stage === "declined") return [["Declined", when]];
  if (view.stage === "refund") return [["Refunded", `${usd(view.amountUsd6)} · ${when}`]];
  const out: Array<readonly [string, string]> = [["Authorised", when]];
  if (holdUsd6 !== null) out.push(["Hold", usd(holdUsd6)]);
  if (view.stage === "paid") out.push(["Paid", usd(view.amountUsd6)]);
  if (view.stage === "released") out.push(["Released", "No charge"]);
  if (view.stage === "settling") out.push(["Settling", "—"]);
  return out;
}

export function PaymentDetail({ id, sheet = false }: { id: string; sheet?: boolean }) {
  const { color } = useTheme();
  const { payment, loading } = useCardPayment(id);
  const summary = useCardSummary();
  const card = summary.data?.cards.find((c) => c.state !== "CLOSED");
  const account = useAccount();
  const address = account.hint?.address;
  const network = useNetwork();
  const risk = useAccountRisk(address, "latest");
  const allowance = risk.status === "fresh" || risk.status === "stale" ? allowanceNow(risk.value) : undefined;
  const step = useSimulateStep();
  if (account.snapshot.status !== "unlocked")
    return (
      <PaymentFrame sheet={sheet}>
        <QuietLine>Unlock to see this payment</QuietLine>
        <Button label="Unlock" onPress={() => void account.unlock().catch(() => undefined)} />
      </PaymentFrame>
    );
  if (!payment) {
    return (
      <PaymentFrame sheet={sheet}>
        {!sheet ? <Stack.Screen options={{ title: "Payment" }} /> : null}
        {loading ? (
          <LoadingState shape="list" label="Reading this payment" />
        ) : (
          <View style={styles.missing}>
            <QuietLine>Payment not found</QuietLine>
            <Button label="Open Card" variant="secondary" onPress={() => router.navigate(ROUTES.card)} />
          </View>
        )}
      </PaymentFrame>
    );
  }
  const view = paymentView(payment, allowance);
  const actions: SimulateStep[] =
    view.stage === "pending" ? ["clear", "void"] : view.stage === "paid" ? ["return"] : [];
  const sandbox = card?.sandbox === true && payment.transactionToken !== undefined;
  return (
    <PaymentFrame sheet={sheet}>
      {!sheet ? <Stack.Screen options={{ title: view.merchant }} /> : null}
      <View style={styles.head}>
        <PaymentGlyph view={view} size={SIZE.markDetail} />
        {sheet ? <Text style={[TYPE.rowTitle, { color: color.ink }]}>{view.merchant}</Text> : null}
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          style={[TYPE.displayBalance, { color: view.stage === "declined" ? color.text3 : color.ink }]}
        >
          {paymentAmount(view)}
        </Text>
        <Text style={[TYPE.rowDetail, { color: view.stage === "declined" ? color.down : color.text2 }]}>
          {paymentDetail(view)}
        </Text>
      </View>
      <View style={styles.rows}>
        {steps(view, payment.holdUsd6, Date.parse(payment.receivedAt)).map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={[TYPE.row, { color: color.text2 }]}>{label}</Text>
            <Text style={[TYPE.rowAmount, { color: color.ink }]}>{value}</Text>
          </View>
        ))}
      </View>
      <ReceiptSaveButton
        save={() =>
          saveReceiptDocument(view.merchant, [
            { label: "Status", value: view.status },
            {
              label: "Mode",
              value: `${network.key === "testnet" ? "Practice" : "Mainnet"}${card?.sandbox ? " · simulated card payment" : ""}`,
            },
            { label: "Network", value: `${networkOf(network.chainId).name} · ${network.chainId}` },
            { label: "Amount", value: paymentAmount(view) },
            ...(address ? [{ label: "Account", value: address }] : []),
            ...(card?.last4 ? [{ label: "Card", value: `Kinpaku · •••• ${card.last4}` }] : []),
            { label: "Time (UTC)", value: new Date(payment.receivedAt).toISOString() },
            { label: "Receipt ID", value: payment.id },
            ...(payment.transactionToken ? [{ label: "Issuer transaction", value: payment.transactionToken }] : []),
            ...(payment.holdUsd6 !== null
              ? [{ label: view.stage === "declined" ? "Requested hold" : "Hold", value: usd(payment.holdUsd6) }]
              : []),
          ])
        }
      />
      {sandbox && card && actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((s) => (
            <Button
              key={s}
              label={STEP_LABEL[s]}
              variant={s === "clear" ? "primary" : "secondary"}
              style={styles.grow}
              loading={step.isPending && step.variables?.step === s}
              disabled={step.isPending}
              onPress={() =>
                step.mutate({ cardToken: card.cardToken, transactionToken: payment.transactionToken ?? "", step: s })
              }
            />
          ))}
        </View>
      ) : null}
      {step.isSuccess ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>
          Sent to the issuer · updating
        </Text>
      ) : step.isError ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
          Issuer didn’t answer · Retry
        </Text>
      ) : null}
    </PaymentFrame>
  );
}

function PaymentFrame({ sheet, children }: { sheet: boolean; children: ReactNode }) {
  return sheet ? <View style={styles.page}>{children}</View> : <Screen contentStyle={styles.page}>{children}</Screen>;
}

const styles = StyleSheet.create({
  page: { gap: SPACE.xl },
  missing: { gap: SPACE.md },
  head: { alignItems: "center", gap: SPACE.sm, paddingTop: SPACE.md },
  rows: { gap: SPACE.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACE.md },
  actions: { flexDirection: "row", gap: SPACE.sm },
  grow: { flex: 1 },
  center: { textAlign: "center" },
});
