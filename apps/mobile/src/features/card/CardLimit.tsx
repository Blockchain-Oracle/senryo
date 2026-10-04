/**
 * Limit and Unfreeze (E3): one page, two modes. Limit: preset chips → Slide to set → passkey → `setSpendAllowance`
 * finalized → "Limit set". Unfreeze (`?unfreeze=1`): the same review with the last limit preselected → Slide to
 * unfreeze → passkey → the limit finalized → the issuer opens the card → "Card active". If the limit landed but the
 * issuer didn't answer, it says "Limit set · Unfreeze pending" with Retry (the limit is kept; nothing is signed again).
 * While a signed change is unresolved the slide stays locked (a second one could race it); the outcome surface never
 * resends — a failure hands back to the review.
 */
import { ONE_USD6 } from "@senryo/core";
import { useAccountRisk } from "@senryo/query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { TradeTrace } from "~/features/trade/TradeTrace";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { SPACE, TYPE, useTheme } from "~/theme";
import { initialLimit, LimitPicker } from "./LimitPicker";
import { allowanceNow } from "./SpendableHero";
import { useCardAllowance } from "./useCardAllowance";
import { useUnfreezeCard } from "./useCardService";
import { useCardSummary } from "./useCardSummary";
import { LIMIT_WORDS, UNFREEZE_WORDS } from "./words";

const SECONDS_PER_DAY = 86_400n;
const MS_PER_SECOND = 1000n;
/** "Expires in 3 days" shows from this close to the expiry (E3 states). */
const EXPIRY_WARN_DAYS = 7n;

export function CardLimit({ unfreeze }: { unfreeze: boolean }) {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "latest");
  if (!address) {
    return (
      <Screen contentStyle={styles.page}>
        <Stack.Screen options={{ title: unfreeze ? "Unfreeze" : "Daily limit" }} />
        <Text style={[TYPE.sectionTitle, styles.center, { color: color.ink }]}>Card limits need an account</Text>
        <Button label="Create account" onPress={() => router.push(ROUTES.accountRequired)} />
      </Screen>
    );
  }
  return (
    <Screen contentStyle={styles.page}>
      <Stack.Screen options={{ title: unfreeze ? "Unfreeze" : "Daily limit" }} />
      <ReadingView reading={risk} loading="plate" loadingLabel="Reading your limit">
        {(snapshot) => <LimitFlow snapshot={snapshot} unfreeze={unfreeze} address={address} />}
      </ReadingView>
    </Screen>
  );
}

/** "Limit $100 a day" · "Expires in 3 days" · "Limit expired" · "No limit set". */
function currentLine(snapshot: Parameters<typeof allowanceNow>[0]): string {
  const state = allowanceNow(snapshot);
  if (state.kind === "off") return "No limit set";
  if (state.kind === "expired") return "Limit expired";
  const daysLeft = (state.expiresAtSec - BigInt(Date.now()) / MS_PER_SECOND) / SECONDS_PER_DAY;
  const limit = `Limit ${usd(state.dailyLimitUsd6, 0)} a day`;
  return daysLeft < EXPIRY_WARN_DAYS ? `${limit} · expires in ${String(daysLeft)} days` : limit;
}

function LimitFlow({
  snapshot,
  unfreeze,
  address,
}: {
  snapshot: Parameters<typeof allowanceNow>[0];
  unfreeze: boolean;
  address: string;
}) {
  const { color } = useTheme();
  const network = useNetwork();
  const card = useCardSummary().data?.cards.find((c) => c.state !== "CLOSED");
  const allowance = useCardAllowance(snapshot);
  const open = useUnfreezeCard();
  const [pick, setPick] = useState(() => initialLimit(snapshot.allowanceDailyLimit || undefined));
  const [started, setStarted] = useState(false);
  const [problem, setProblem] = useState<string>();
  /** Bumped when the passkey sheet is dismissed, so the slide springs back for another try. */
  const [attempt, setAttempt] = useState(0);
  const outcome = useSettledOutcome(allowance.trace.events);
  const intent = [network.chainId, address, pick, unfreeze ? "unfreeze" : "limit"].join(":");
  const guard = useReviewGuard(intent);
  const unresolved = outcome === "unknown";
  const busy = allowance.authorizing || allowance.trace.running || unresolved;

  const confirm = async () => {
    setStarted(true);
    setProblem(undefined);
    try {
      const result = await allowance.setLimit(pick * ONE_USD6, guard);
      if (result === undefined) setAttempt((n) => n + 1);
      if (result?.final?.stage === "finalized" && unfreeze && card) open.mutate(card.cardToken);
    } catch {
      setStarted(false);
      setProblem("Couldn’t confirm the limit. Try again.");
      setAttempt((n) => n + 1);
    }
  };

  const showTrace = started && (allowance.trace.running || allowance.trace.events.length > 0);
  if (showTrace) {
    const finalized = outcome === "finalized";
    const pending = unfreeze && finalized && !open.isSuccess;
    return (
      <View style={styles.flow}>
        <TradeTrace
          events={allowance.trace.events}
          record={allowance.trace.record}
          running={allowance.trace.running}
          outcome={outcome}
          words={unfreeze ? UNFREEZE_WORDS : LIMIT_WORDS}
          {...(pending ? { title: open.isPending ? "Opening card" : "Limit set · Unfreeze pending" } : {})}
          onDone={() => {
            if (finalized) return router.back();
            allowance.trace.reset();
            setStarted(false);
          }}
          onLeave={() => router.back()}
        >
          <Text style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>
            {usd(pick * ONE_USD6, 0)} a day · {network.modeLabel}
          </Text>
        </TradeTrace>
        {pending && open.isError && card ? (
          <Button label="Retry unfreeze" variant="secondary" onPress={() => open.mutate(card.cardToken)} />
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.flow}>
      <Text style={[TYPE.rowDetail, styles.center, { color: unresolved ? color.warn : color.text3 }]}>
        {unresolved ? "Last change not confirmed yet" : currentLine(snapshot)}
      </Text>
      <LimitPicker
        value={pick}
        onChange={setPick}
        slideLabel={unfreeze ? "Slide to unfreeze" : "Slide to set"}
        resetKey={`${intent}:${attempt}`}
        busy={busy}
        disabled={!allowance.ready || (unfreeze && !card)}
        onConfirm={() => void confirm()}
      />
      {problem ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
          {problem}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.lg },
  flow: { gap: SPACE.xl },
  center: { textAlign: "center" },
});
