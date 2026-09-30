/**
 * Practice starter funds (F05, D-030): one tap; the label follows the stage (Checking → Signing → Sending → Adding
 * practice dollars → Ready); `filled` haptic + deposit sound on credit; labelled NO REAL VALUE. Every refusal says
 * why and what next. The TTFT stop fires when the claim is finalized.
 */
import { type AuthFailure, authFailureCopy } from "@senryo/account";
import { formatUnits } from "@senryo/core";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Icon } from "~/components/kit/Icon";
import { fire } from "~/feedback/fire";
import { type StarterPhase, useStarter } from "~/lib/account/use-starter";
import { ROUTES } from "~/lib/constants/routes";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const USD_DECIMALS = 6;
const CENTS = 2;
const SECONDS_PER_HOUR = 3_600;

const REASON: Record<string, string> = {
  RATE_LIMITED: "One claim per device per day",
  BUDGET_EXHAUSTED: "Today's practice budget is used up · try tomorrow",
  GEO_BLOCKED: "Not available in your region",
  RELAYER_BUSY: "The relay is busy · try again in a moment",
  NOT_DEPLOYED: "Starter funds aren't live on this network yet",
  UNREACHABLE: "The starter relay is offline right now · try again soon",
  SIGNATURE_INVALID: "The signature didn't verify · try again",
  SIGNATURE_EXPIRED: "The signature expired · try again",
  RELAY_REVERTED: "The claim didn't settle · nothing changed",
  UNKNOWN: "Something went wrong · try again",
};

const LABEL: Partial<Record<StarterPhase["kind"], string>> = {
  checking: "Checking…",
  signing: "Signing…",
  sending: "Sending…",
  settling: "Adding practice dollars…",
};

function message(phase: StarterPhase): string {
  if (phase.kind === "done")
    return `On the house · $${formatUnits(phase.creditUsd6, USD_DECIMALS, CENTS)} practice dollars and gas are in.`;
  if (phase.kind === "claimed") return "Already claimed on this account · deposit more from Fund.";
  if (phase.kind !== "failed")
    return "Test dollars on Monad testnet plus gas, sent by our sponsor. You sign once — no fee.";
  if (phase.code === "AUTH") {
    const c = authFailureCopy((phase.authKind ?? "unknown") as AuthFailure, Platform.OS === "ios" ? "ios" : "android");
    return `${c.title}. ${c.body}`;
  }
  const hours = phase.retryAfterSec ? Math.ceil(phase.retryAfterSec / SECONDS_PER_HOUR) : undefined;
  const base = REASON[phase.code] ?? REASON.UNKNOWN ?? "";
  return hours ? `${base} · next in ${hours}h` : base;
}

export function StarterCard({ hideWhenClaimed = false }: { hideWhenClaimed?: boolean }) {
  const { color } = useTheme();
  const { phase, claim, ready } = useStarter();
  useEffect(() => {
    if (phase.kind === "done") fire("filled", { sound: "deposit" });
    if (phase.kind === "failed" && phase.code !== "AUTH") fire("fail");
  }, [phase]);
  if (hideWhenClaimed && phase.kind === "claimed") return null;
  const busy = LABEL[phase.kind] !== undefined;
  return (
    <View style={[styles.card, { borderColor: color.warn, backgroundColor: color.warnWash }]}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Icon name="coins" size={SIZE.iconSm} tint={color.warn} />
          <Text style={[TYPE.label, { color: color.ink }]}>PRACTICE FUNDS</Text>
        </View>
        <Text style={[TYPE.micro, styles.pill, { color: color.warn, borderColor: color.warn }]}>NO REAL VALUE</Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={[TYPE.caption, { color: color.inkMuted }]}>
        {message(phase)}
      </Text>
      {phase.kind === "done" || phase.kind === "claimed" ? (
        <Button
          label={phase.kind === "done" ? "Trade gold" : "Open Fund"}
          variant="outline"
          onPress={() => router.push(phase.kind === "done" ? ROUTES.markets : ROUTES.fund)}
        />
      ) : (
        <Button
          label={phase.kind === "failed" ? "Try again" : (LABEL[phase.kind] ?? "Claim practice funds")}
          loading={busy}
          disabled={!ready}
          onPress={() => void claim()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, padding: SPACE.md, gap: SPACE.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  pill: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.xs, paddingVertical: SPACE.xxs },
});
