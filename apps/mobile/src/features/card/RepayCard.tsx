/**
 * Repay card debt (E4 step 7; E-D9): the card service quotes the repayment from the trading account's dollars
 * (`POST /v1/card/repay-quote`, full by default, half on request); the app builds the same `repayCardDebt` call itself
 * and refuses to sign if the two differ (the service never moves user funds). Review → Slide to repay → the account
 * signs (session scope: it only lowers a liability) → the shared outcome surface, which never resends. Short of
 * dollars, the one action is Add funds.
 */
import { ApiError, type CardRepayQuote, cardRepayQuoteRoute } from "@senryo/api-client";
import { positionCount } from "@senryo/config";
import { operationKey, repayCardDebtRequest, useAccountRisk, useQueryEnv, useSendTrace } from "@senryo/query";
import { useMutation } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChipRow } from "~/components/kit/ChipRow";
import { Screen } from "~/components/kit/Screen";
import { LoadingState } from "~/components/kit/states";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { TradeTrace } from "~/features/trade/TradeTrace";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { useReviewGuard } from "~/lib/review-guard";
import { HERO_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { REPAY_WORDS } from "./words";

type Share = "full" | "half";
const SHARES = [
  { value: "full", label: "All" },
  { value: "half", label: "Half" },
] as const;
const HALF = 2n;

export function RepayCard() {
  const { color } = useTheme();
  const env = useQueryEnv();
  const session = useSessionRunner();
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "latest");
  const debt = risk.status === "fresh" || risk.status === "stale" ? risk.value.cardDebt : undefined;
  const trace = useSendTrace(operationKey(env.chainId, address, "card-repay"));
  const outcome = useSettledOutcome(trace.events);
  const [share, setShare] = useState<Share>("full");
  /** The quote as it was reviewed and signed: the receipt says this, whatever the debt reads afterwards. */
  const [reviewed, setReviewed] = useState<CardRepayQuote>();
  const quote = useMutation({
    mutationFn: (amountUsd6: bigint | undefined): Promise<CardRepayQuote> => {
      if (!session) return Promise.reject(new Error("Sign in to repay"));
      return session(() => env.api.call(cardRepayQuoteRoute, { body: amountUsd6 === undefined ? {} : { amountUsd6 } }));
    },
  });
  /** The amount to quote: undefined = the whole debt; null = Half, waiting for the debt to be read. */
  const wanted = share === "half" ? (debt === undefined ? null : debt / HALF) : undefined;
  /** A repayment is out: the receipt shows until it is done with (a run that recorded nothing doesn't count). */
  const sending = reviewed !== undefined && (trace.running || trace.events.length > 0);
  // A new quote whenever the share (or the debt it halves) changes — never while a repayment is out.
  useEffect(() => {
    if (!sending && wanted !== null) quote.mutate(wanted);
  }, [wanted, sending, quote.mutate]);
  if (reviewed && sending) {
    return (
      <Screen contentStyle={styles.page}>
        <Stack.Screen options={{ title: "Repay card debt" }} />
        <TradeTrace
          events={trace.events}
          record={trace.record}
          running={trace.running}
          outcome={outcome}
          words={REPAY_WORDS}
          onDone={() => {
            if (outcome === "finalized") return router.back();
            // Only a settled failure goes back to review; an unknown outcome offers nothing new.
            if (outcome === "unknown") return;
            trace.reset();
            setReviewed(undefined);
          }}
          onLeave={() => router.back()}
        >
          <Text style={[TYPE.rowDetail, styles.text, { color: color.text2 }]}>
            {usd(reviewed.repayUsd6)} · {usd(reviewed.remainingDebtUsd6)} left
          </Text>
        </TradeTrace>
      </Screen>
    );
  }
  return (
    <Screen contentStyle={styles.page}>
      <Stack.Screen options={{ title: "Repay card debt" }} />
      {quote.data && wanted !== null ? (
        <Review
          quote={quote.data}
          share={share}
          onShare={setShare}
          trace={trace}
          unresolved={outcome === "unknown"}
          onSend={setReviewed}
        />
      ) : quote.isError ? (
        <QuoteProblem error={quote.error} retry={() => (wanted === null ? undefined : quote.mutate(wanted))} />
      ) : (
        <LoadingState shape="plate" label="Quoting the repayment" />
      )}
    </Screen>
  );
}

function QuoteProblem({ error, retry }: { error: unknown; retry: () => void }) {
  const { color } = useTheme();
  const code = error instanceof ApiError ? error.code : undefined;
  const line =
    code === "NOT_NEEDED" ? "No card debt" : code === "NOT_ELIGIBLE" ? "No dollars to repay from" : "Quote unavailable";
  return (
    <View style={styles.center}>
      <Text style={[TYPE.sectionTitle, styles.text, { color: color.ink }]}>{line}</Text>
      {code === "NOT_NEEDED" ? (
        <Button label="Done" onPress={() => router.back()} />
      ) : code === "NOT_ELIGIBLE" ? (
        <Button label="Add funds" onPress={() => router.push(ROUTES.addMoney)} />
      ) : (
        <Button label="Retry" variant="secondary" onPress={retry} />
      )}
    </View>
  );
}

function Review({
  quote,
  share,
  onShare,
  trace,
  unresolved,
  onSend,
}: {
  quote: CardRepayQuote;
  share: Share;
  onShare: (s: Share) => void;
  trace: ReturnType<typeof useSendTrace>;
  unresolved: boolean;
  /** Freezes the reviewed quote just before signing. */
  onSend: (reviewed: CardRepayQuote) => void;
}) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const risk = useAccountRisk(address, "latest");
  const positions = risk.status === "fresh" || risk.status === "stale" ? positionCount(risk.value.positionBitmap) : 0;
  const gas = useEnsureGas();
  const request = { ...repayCardDebtRequest(env.chainId, quote.repayUsd6, positions), gasCap: quote.tx.gasCap };
  // The service's call and ours must be the same call, to the same contract, for the same amount.
  const matches =
    request.to.toLowerCase() === quote.tx.to.toLowerCase() &&
    request.data === quote.tx.data &&
    quote.chainId === env.chainId &&
    quote.account.toLowerCase() === address?.toLowerCase();
  const intent = [env.chainId, address, quote.repayUsd6, quote.quotedAt].join(":");
  const guard = useReviewGuard(intent);
  const send = async () => {
    const client = account.client;
    if (!client || !address || !matches) return;
    onSend(quote);
    await trace.run(userSender(client, address, account.settings.faceId), request, {
      preflight: gas.preflight(request),
      revalidate: guard,
      reviewedIntent: { repayUsd6: quote.repayUsd6.toString(), debtUsd6: quote.debtUsd6.toString() },
    });
  };
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["Card debt", usd(quote.debtUsd6)],
    ["From trading account", usd(quote.balanceUsd6)],
    ["Debt after", usd(quote.remainingDebtUsd6)],
  ];
  return (
    <View style={styles.review}>
      <View style={styles.amount}>
        <Text maxFontSizeMultiplier={HERO_FONT_SCALE} style={[TYPE.displayBalance, { color: color.ink }]}>
          {usd(quote.repayUsd6)}
        </Text>
        <ChipRow options={SHARES} value={share} onChange={onShare} label="How much to repay" />
      </View>
      <View style={styles.rows}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={[TYPE.row, { color: color.text2 }]}>{label}</Text>
            <Text style={[TYPE.rowAmount, { color: color.ink }]}>{value}</Text>
          </View>
        ))}
      </View>
      {matches ? null : (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.text, { color: color.down }]}>
          Quote doesn’t match · Retry
        </Text>
      )}
      <SlideToConfirm
        label={matches ? "Slide to repay" : "Quote doesn’t match"}
        tone="primary"
        resetKey={intent}
        busy={trace.running || unresolved}
        disabled={!matches || account.client === undefined}
        onConfirm={() => void send()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.xl },
  center: { alignItems: "stretch", gap: SPACE.lg, paddingTop: SPACE.xl },
  text: { textAlign: "center" },
  review: { gap: SPACE.xl },
  amount: { alignItems: "center", gap: SPACE.md },
  rows: { gap: SPACE.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACE.md },
});
