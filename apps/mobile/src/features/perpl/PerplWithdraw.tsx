/**
 * Move funds back (flow book C4 "Withdraw ›", C5; D1): AUSD that's free on Perpl — after a close, or an IOC that
 * matched nobody — back to the wallet that owns the account (`withdrawCollateral` always pays `msg.sender`). The
 * amount pad with Max = what's free now (collateral held by open positions stays), Perpl's 0.01 AUSD minimum, one slide
 * in session (a withdrawal to oneself is in scope), and the one outcome surface. Never resent; unknown stays pending.
 */
import { PERPL_MIN_WITHDRAW_CNS } from "@senryo/config";
import { mainnetReadOf, perplWithdrawOperation, usePerplAccount, useQueryEnv } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { AmountPad } from "~/features/money/AmountPad";
import { useAmountInput } from "~/features/money/amount";
import { ReviewRow, ReviewRows } from "~/features/money/Review";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { TradeTrace } from "~/features/trade/TradeTrace";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { CONTROL_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { perplUsd } from "./format";
import { PERPL_CHAIN } from "./market";
import { usePerplRun } from "./usePerplRun";
import { WITHDRAW_WORDS } from "./words";

const AUSD = { symbol: "AUSD", decimals: 6 } as const;

export function PerplWithdraw() {
  const { color } = useTheme();
  const env = useQueryEnv();
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const snapshot = usePerplAccount(address);
  const known = snapshot.status === "fresh" || snapshot.status === "stale" ? snapshot.value : undefined;
  const free = known?.account?.availableCNS ?? 0n;
  const input = useAmountInput(AUSD.decimals, null, free);
  const runner = usePerplRun(`perpl-withdraw:${PERPL_CHAIN}:${address?.toLowerCase() ?? "guest"}`);
  const outcome = useSettledOutcome(runner.trace.events);
  const guard = useReviewGuard([PERPL_CHAIN, address, input.amount].join(":"));
  const [problem, setProblem] = useState<string>();
  const amount = input.amount;
  const mainnet = network.chainId === PERPL_CHAIN;

  if (runner.trace.events.length > 0 || runner.active) {
    const moved = BigInt(runner.trace.record?.reviewedIntent.withdraw ?? "0");
    return (
      <View style={styles.fill}>
        <TradeTrace
          events={runner.trace.events}
          record={runner.trace.record}
          running={runner.trace.running || runner.active}
          outcome={outcome}
          words={WITHDRAW_WORDS}
          onLeave={() => router.back()}
          onDone={() => {
            const done = runner.trace.record?.outcome === "completed";
            runner.reset();
            if (done) router.back();
          }}
        >
          <ReviewRows>
            <ReviewRow label="Amount" value={perplUsd(moved)} />
            <ReviewRow label="From" value="Perpl" />
            <ReviewRow label="To" value="Your wallet" />
          </ReviewRows>
        </TradeTrace>
      </View>
    );
  }
  if (!mainnet) return <QuietLine>Perpl runs on Mainnet</QuietLine>;
  if (known && !known.account) {
    return (
      <QuietLine action={{ label: "Explore markets", onPress: () => router.navigate(ROUTES.markets) }}>
        Nothing on Perpl yet
      </QuietLine>
    );
  }
  const below = amount > 0n && amount < PERPL_MIN_WITHDRAW_CNS;
  const label = !address
    ? "Sign in to move funds"
    : amount === 0n
      ? "Enter an amount"
      : input.over
        ? "More than is free"
        : below
          ? "Minimum 0.01 AUSD"
          : "Slide to move back";
  const holdable = Boolean(address) && amount > 0n && !input.over && !below;

  const confirm = async () => {
    if (!address) return;
    setProblem(undefined);
    const plan = await perplWithdrawOperation(mainnetReadOf(env), address, amount);
    if (plan.blocker) {
      setProblem(plan.blocker === "over-available" ? "Less is free on Perpl now · review" : "Review the amount");
      return;
    }
    await runner.run({
      plan,
      labels: ["Move back to wallet"],
      reviewedIntent: { ...plan.reviewedIntent, kind: "perpl", network: "mainnet", symbol: "AUSD" },
      confirmWith: "session",
      revalidate: async () => guard(),
    });
  };

  return (
    <View style={styles.fill}>
      <AmountPad
        asset={AUSD}
        input={input}
        available={free}
        minimum={{ raw: PERPL_MIN_WITHDRAW_CNS, text: "0.01 AUSD" }}
      />
      <View style={styles.zone}>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[TYPE.meta, { color: problem ? color.warn : color.text3 }]}
        >
          {problem ?? "Perpl → your wallet · Monad"}
        </Text>
        <SlideToConfirm
          label={label}
          disabled={!holdable}
          resetKey={[address ?? "", amount].join("|")}
          onConfirm={() => void confirm()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, gap: SPACE.md },
  zone: { gap: SPACE.sm },
});
