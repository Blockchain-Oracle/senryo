/**
 * Get card (E1 steps 4–6; E-D2 "limit first, then issue"): the daily limit is signed first — a card without one can't
 * spend — then `POST /v1/card/issue` creates the sandbox virtual card and the art turns to show •••• last4. Reopened
 * after a kill between the two, the live limit skips straight to issuing; issuing is idempotent (one live card per
 * account per network). A failure names its cause with the action that fixes it (Switch to Practice, Sign in again,
 * Retry — only a real outage blames the issuer); any other issue failure is "Card not created" with Try again, the
 * limit kept. The limit's outcome surface never resends.
 */
import { ONE_USD6 } from "@senryo/core";
import { useAccountRisk } from "@senryo/query";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FlipInEasyY } from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { LoadingState } from "~/components/kit/states";
import { CircleCheck } from "~/components/kit/symbols";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { TradeTrace } from "~/features/trade/TradeTrace";
import { fire } from "~/feedback/fire";
import { clearApiSession } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { setActiveNetwork, useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { SPACE, TYPE, useTheme } from "~/theme";
import { CardFace } from "./CardFace";
import { CardHero } from "./CardHero";
import { CARD_NETWORKS, CARD_PROBLEM_COPY, type CardProblem, cardProblem } from "./card-problem";
import { initialLimit, LimitPicker } from "./LimitPicker";
import { allowanceNow } from "./SpendableHero";
import { useCardAllowance } from "./useCardAllowance";
import { useIssueCard } from "./useCardService";
import { useCardSummary } from "./useCardSummary";
import { LIMIT_WORDS } from "./words";

const READY_GLYPH = 28;

export function GetCard() {
  const { color } = useTheme();
  const account = useAccount();
  const address = account.hint?.address;
  useHideDockWhileFocused("card-get");
  const summary = useCardSummary();
  const network = useNetwork();
  const risk = useAccountRisk(address, "latest");
  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const card = summary.data?.cards.find((c) => c.state !== "CLOSED");
  const title = card ? "Card ready" : "Get card";
  if (!address || account.snapshot.status !== "unlocked") {
    return (
      <Screen contentStyle={styles.page}>
        <Stack.Screen options={{ title }} />
        <Art />
        <Text style={[TYPE.sectionTitle, styles.center, { color: color.ink }]}>
          {address ? "Unlock to get your card" : "Cards need an account"}
        </Text>
        {address ? (
          <Button label="Unlock" onPress={() => void account.unlock().catch(() => undefined)} />
        ) : (
          <Button label="Create account" onPress={() => router.push(ROUTES.accountRequired)} />
        )}
      </Screen>
    );
  }
  return (
    <Screen contentStyle={styles.page}>
      <Stack.Screen options={{ title }} />
      {card ? (
        <Ready last4={card.last4 ?? undefined} />
      ) : !CARD_NETWORKS.has(network.key) ? (
        <Problem problem="practice-only" act={() => setActiveNetwork("testnet")} acting={false} />
      ) : cardProblem(summary.error, summary.data) ? (
        <Problem
          problem={cardProblem(summary.error, summary.data) ?? "unknown"}
          act={() => retryAfter(cardProblem(summary.error, summary.data), () => void summary.refetch())}
          acting={summary.isFetching}
        />
      ) : summary.isPending || !snapshot ? (
        <>
          <Art />
          <LoadingState shape="line" label="Reading your account" />
        </>
      ) : (
        <Flow snapshot={snapshot} address={address} />
      )}
    </Screen>
  );
}

function Art({ last4 }: { last4?: string | undefined }) {
  return (
    <View style={styles.art}>
      <CardHero floating={!last4}>
        <CardFace last4={last4} />
      </CardHero>
    </View>
  );
}

function Flow({ snapshot, address }: { snapshot: Parameters<typeof allowanceNow>[0]; address: string }) {
  const { color } = useTheme();
  const network = useNetwork();
  const allowance = useCardAllowance(snapshot);
  const issue = useIssueCard();
  const [pick, setPick] = useState(() => initialLimit(snapshot.allowanceDailyLimit || undefined));
  const [started, setStarted] = useState(false);
  const [problem, setProblem] = useState<string>();
  /** Bumped when the passkey sheet is dismissed, so the slide springs back for another try. */
  const [attempt, setAttempt] = useState(0);
  const outcome = useSettledOutcome(allowance.trace.events);
  const intent = [network.chainId, address, pick, "get-card"].join(":");
  const guard = useReviewGuard(intent);
  // The limit is live: read so (set before a kill), or just finalized here (before the snapshot re-reads it).
  const live = allowanceNow(snapshot).kind === "live" || (started && outcome === "finalized");
  const asked = useRef(false);

  // A live limit goes straight to issuing — once per visit.
  useEffect(() => {
    if (!live || asked.current) return;
    asked.current = true;
    issue.mutate(undefined, { onSuccess: (r) => (r.created ? fire("filled", { sound: "fill" }) : undefined) });
  }, [live, issue.mutate]);

  if (issue.isPending || (live && !issue.isError)) {
    return (
      <>
        <Art />
        <Animated.Text
          entering={FadeIn}
          accessibilityLiveRegion="polite"
          style={[TYPE.sectionTitle, styles.center, { color: color.ink }]}
        >
          Creating card…
        </Animated.Text>
      </>
    );
  }
  if (issue.isError) {
    const problem = cardProblem(issue.error);
    return problem && problem !== "unknown" ? (
      <Problem problem={problem} act={() => retryAfter(problem, () => issue.mutate())} acting={false} />
    ) : (
      <>
        <Art />
        <Text accessibilityRole="alert" style={[TYPE.sectionTitle, styles.center, { color: color.ink }]}>
          Card not created
        </Text>
        <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>Your limit is kept</Text>
        <Button label="Try again" onPress={() => issue.mutate()} />
      </>
    );
  }
  if (started && (allowance.trace.running || allowance.trace.events.length > 0)) {
    return (
      <TradeTrace
        events={allowance.trace.events}
        record={allowance.trace.record}
        running={allowance.trace.running}
        outcome={outcome}
        words={LIMIT_WORDS}
        onDone={() => {
          allowance.trace.reset();
          setStarted(false);
        }}
        onLeave={() => router.back()}
      >
        <Text style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>
          {usd(pick * ONE_USD6, 0)} a day · {network.modeLabel}
        </Text>
      </TradeTrace>
    );
  }
  const unresolved = outcome === "unknown";
  return (
    <>
      <Art />
      <LimitPicker
        value={pick}
        onChange={setPick}
        slideLabel="Slide to set limit"
        resetKey={`${intent}:${attempt}`}
        busy={allowance.authorizing || allowance.trace.running || unresolved}
        disabled={!allowance.ready}
        onConfirm={() => {
          setStarted(true);
          setProblem(undefined);
          void allowance
            .setLimit(pick * ONE_USD6, guard)
            .then((result) => {
              if (result === undefined) setAttempt((n) => n + 1);
            })
            .catch(() => {
              setStarted(false);
              setProblem("Couldn’t confirm the limit. Try again.");
              setAttempt((n) => n + 1);
            });
        }}
      />
      {problem ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
          {problem}
        </Text>
      ) : null}
    </>
  );
}

/** E1 step 6: the card turns to show its number; Practice can pay straight away. */
function Ready({ last4 }: { last4: string | undefined }) {
  const { color } = useTheme();
  const practice = useNetwork().key === "testnet";
  return (
    <>
      <Animated.View entering={FlipInEasyY.springify()} style={styles.art}>
        <CardHero>
          <CardFace last4={last4} />
        </CardHero>
      </Animated.View>
      <View style={styles.ready} accessibilityLiveRegion="polite">
        <CircleCheck size={READY_GLYPH} color={color.up} />
        <Text accessibilityRole="header" style={[TYPE.stepTitle, { color: color.ink }]}>
          Card ready
        </Text>
      </View>
      {practice ? (
        <Button label="Simulate a payment" onPress={() => router.navigate(`${ROUTES.card}?simulate=1`)} />
      ) : null}
      <Button label="Done" variant={practice ? "secondary" : "primary"} onPress={() => router.navigate(ROUTES.card)} />
    </>
  );
}

/** A refused or expired sign-in starts over before the retry: the next call signs in again (one unlock prompt). */
function retryAfter(problem: CardProblem | undefined, retry: () => void) {
  if (problem === "sign-in") clearApiSession();
  retry();
}

function Problem({ problem, act, acting }: { problem: CardProblem; act: () => void; acting: boolean }) {
  const { color } = useTheme();
  const copy = CARD_PROBLEM_COPY[problem];
  return (
    <>
      <Art />
      <Text style={[TYPE.sectionTitle, styles.center, { color: color.ink }]}>{copy.title}</Text>
      <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>{copy.line}</Text>
      <Button label={copy.action} variant="secondary" loading={acting} onPress={act} />
    </>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.xl },
  art: { paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md },
  center: { textAlign: "center" },
  ready: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm },
});
