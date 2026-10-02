/**
 * The swap ticket (B6; Phantom P20): the two plates with the flip, the rate · impact line with Details, then 25% · 50%
 * · Max and the keypad, and one action that names what stops it ("Not enough XAUt0", "No route for this pair",
 * "Swaps run on Mainnet") until it reads Review. The pickers and the review are child sheets over the ticket, so its
 * values and the review guard survive. Once signed, the ticket becomes the outcome until it settles — never a second
 * swap beside an unresolved one.
 */
import { RISK } from "@senryo/core";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { Keypad } from "~/components/trade/Keypad";
import { Preset } from "~/components/trade/Preset";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { AssetPicker } from "~/features/money/AssetPicker";
import { amountOf } from "~/features/money/format";
import { MoneyOutcome, ReviewRow } from "~/features/money/Review";
import { SWAP_WORDS } from "~/features/money/words";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE, TYPE, useTheme } from "~/theme";
import { QuoteLine, SwapPlates } from "./SwapCards";
import { SwapReview } from "./SwapReview";
import { maxUnderBlock } from "./swap-format";
import { type SwapState, useSwap } from "./useSwap";

const QUARTER_BPS = 2_500n;
const HALF_BPS = 5_000n;
const KEYPAD_HEIGHT = 232;

function actionLabel(s: SwapState): string {
  switch (s.block) {
    case "account":
      return "Create an account";
    case "empty":
      return "Enter an amount";
    case "short":
      return `Not enough ${s.pay.symbol}`;
    case "unsupported":
      return "Swaps run on Mainnet";
    case "unverified-receive":
      return "Can’t receive unverified tokens";
    case "quoting":
      return "Getting a quote";
    case "failed":
      return "Quote unavailable · retry";
    case "no-route":
      return "No route for this pair";
    case "impact":
      return "Too big · try a smaller amount";
    default:
      return "Review";
  }
}

export function SwapView({
  initialPay,
  initialReceive,
  onLeave,
}: {
  initialPay?: string | undefined;
  initialReceive?: string | undefined;
  onLeave: () => void;
}) {
  const { color } = useTheme();
  const client = useQueryClient();
  const s = useSwap(initialPay, initialReceive);
  const [picking, setPicking] = useState<"pay" | "receive">();
  const [busy, setBusy] = useState(false);
  const trace = s.runner.trace;

  if (trace.running || trace.events.length > 0) {
    const intent = trace.record?.reviewedIntent;
    return (
      <ScrollView contentContainerStyle={styles.outcome}>
        <MoneyOutcome
          runner={s.runner}
          words={SWAP_WORDS}
          facts={
            intent ? (
              <>
                {intent.paid ? <ReviewRow label="Paid" value={intent.paid} /> : null}
                {intent.atLeast ? <ReviewRow label="Received at least" value={intent.atLeast} /> : null}
                {intent.route ? <ReviewRow label="Route" value={intent.route} /> : null}
              </>
            ) : undefined
          }
          onDone={() => {
            const done = trace.record?.outcome === "completed";
            s.runner.reset();
            s.closeReview();
            if (done) s.input.reset();
          }}
          onLeave={onLeave}
        />
      </ScrollView>
    );
  }

  const max = s.block === "impact" && s.ok ? maxUnderBlock(s.ok) : undefined;
  const ready = s.block === undefined && !s.preparing;
  const onAction = () => {
    if (s.block === "account") return router.push(ROUTES.accountRequired);
    if (s.block === "failed") return void client.invalidateQueries({ queryKey: ["swap"] });
    void s.review();
  };
  return (
    <View style={styles.fill}>
      <ScrollView style={styles.top} contentContainerStyle={styles.topBody} keyboardShouldPersistTaps="handled">
        <SwapPlates s={s} onPickPay={() => setPicking("pay")} onPickReceive={() => setPicking("receive")} />
        <QuoteLine s={s} />
        {!s.pay.verified ? (
          <Text style={[TYPE.rowDetail, { color: color.warn }]}>Unverified token · sell only</Text>
        ) : null}
        {max !== undefined && max > 0n ? (
          <Pressable onPress={() => s.input.fillShare(max, s.available)} accessibilityRole="button" hitSlop={SPACE.sm}>
            <Text style={[TYPE.rowDetail, { color: color.link }]}>Try {amountOf(s.pay, max)} ›</Text>
          </Pressable>
        ) : null}
        {s.problem ? (
          <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.down }]}>
            {s.problem}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.bottom}>
        <View style={styles.presets}>
          <Preset
            label="25%"
            accessibilityLabel="25% of what you hold"
            disabled={s.available === 0n}
            onPress={() => s.input.fillShare(QUARTER_BPS, RISK.BPS)}
          />
          <Preset
            label="50%"
            accessibilityLabel="Half of what you hold"
            disabled={s.available === 0n}
            onPress={() => s.input.fillShare(HALF_BPS, RISK.BPS)}
          />
          <Preset
            label="Max"
            accessibilityLabel="All you can swap"
            disabled={s.available === 0n}
            onPress={s.input.fillMax}
          />
        </View>
        <View style={styles.keypad}>
          <Keypad onKey={s.input.key} />
        </View>
        {s.block === "unsupported" ? (
          <SlideToConfirm label="Swaps run on Mainnet" disabled onConfirm={() => undefined} />
        ) : (
          <Button
            label={s.preparing ? "Preparing" : actionLabel(s)}
            loading={s.preparing || s.block === "quoting"}
            disabled={!ready && s.block !== "account" && s.block !== "failed"}
            onPress={onAction}
          />
        )}
      </View>
      <ChildSheet open={picking === "pay"} onClose={() => setPicking(undefined)} title="You pay">
        <AssetPicker
          assets={s.money.assets.filter((a) => a.total > 0n)}
          other={s.money.other}
          selectedKey={s.pay.key}
          emptyLine="Nothing to swap yet"
          onPick={(a) => {
            s.setPay(a.key);
            setPicking(undefined);
          }}
        />
      </ChildSheet>
      <ChildSheet open={picking === "receive"} onClose={() => setPicking(undefined)} title="You receive">
        <AssetPicker
          assets={s.receivable.filter((a) => a.key !== s.pay.key)}
          selectedKey={s.receive?.key}
          emptyLine={s.tokenListFailed ? "Couldn’t load the token list" : "Loading tokens"}
          onPick={(a) => {
            s.setReceive(a.key);
            setPicking(undefined);
          }}
        />
      </ChildSheet>
      <ChildSheet open={s.reviewed !== undefined} onClose={s.closeReview} title="Review swap">
        <SwapReview
          s={s}
          busy={busy}
          onConfirm={() => {
            setBusy(true);
            void s.confirm().finally(() => setBusy(false));
          }}
        />
      </ChildSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexShrink: 1 },
  topBody: { gap: SPACE.sm, paddingBottom: SPACE.sm },
  bottom: { gap: SPACE.md, paddingTop: SPACE.sm },
  presets: { flexDirection: "row", gap: SPACE.sm },
  keypad: { height: KEYPAD_HEIGHT },
  outcome: { paddingBottom: SPACE.xl },
});
