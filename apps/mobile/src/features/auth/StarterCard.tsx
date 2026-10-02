/**
 * Practice starter funds (F05, D-030): one tap; the label follows the stage (Checking → Signing → Sending → Adding
 * practice dollars → Ready); `filled` haptic + deposit sound on credit; labelled "No real value". Every refusal says
 * why and what next. The TTFT stop fires when the claim is finalized. A practice-wash card (violet is the paper-money
 * mode, direction §6; amber stays for warnings): filled, 20 pt corners, no border, with its one action sized to its
 * label under the text (Fomo F16's promotion card).
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
import { useNetwork } from "~/lib/network";
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { MainnetStartCard } from "./MainnetStartCard";

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
};

function message(phase: StarterPhase): string {
  if (phase.kind === "done")
    return `On the house · $${formatUnits(phase.creditUsd6, USD_DECIMALS, CENTS)} practice dollars and gas are in.`;
  if (phase.kind === "claimed") return "Practice funds claimed ✓ · add more from Fund.";
  if (phase.kind === "unchecked") return "Couldn't check your practice funds right now · retry.";
  if (phase.kind === "pending") return "Your request is pending. Check its status before making another request.";
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

/** Practice: the free starter claim. Mainnet: the real-money way in (deposit, no MON needed). */
export function StarterCard({ hideWhenClaimed = false }: { hideWhenClaimed?: boolean }) {
  const network = useNetwork();
  return network.modeLabel === "Mainnet" ? (
    <MainnetStartCard hideWhenFunded={hideWhenClaimed} />
  ) : (
    <PracticeStarterCard hideWhenClaimed={hideWhenClaimed} />
  );
}

function PracticeStarterCard({ hideWhenClaimed }: { hideWhenClaimed: boolean }) {
  const { color } = useTheme();
  const { phase, claim, recheck, ready } = useStarter();
  useEffect(() => {
    if (phase.kind === "failed" && phase.code !== "AUTH") fire("fail");
  }, [phase]);
  // On Portfolio the card only appears once we know there is something to do (no "Checking…" flash, S8.16e).
  if (hideWhenClaimed && (phase.kind === "claimed" || phase.kind === "checking")) return null;
  const busy = LABEL[phase.kind] !== undefined;
  return (
    <View style={[styles.card, { backgroundColor: color.practiceWash }]}>
      <View style={styles.text}>
        <View style={styles.head}>
          <View style={styles.title}>
            <Icon name="coins" size={SIZE.iconSm} tint={color.practice} />
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>Practice funds</Text>
          </View>
          <Text style={[TYPE.label, { color: color.practice }]}>No real value</Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.text2 }]}>
          {message(phase)}
        </Text>
      </View>
      {phase.kind === "done" || phase.kind === "claimed" ? (
        <Button
          label={phase.kind === "done" ? "Trade gold" : "Open Fund"}
          variant="outline"
          size="sm"
          block={false}
          onPress={() => router.navigate(phase.kind === "done" ? ROUTES.markets : ROUTES.addMoney)}
        />
      ) : phase.kind === "unchecked" || phase.kind === "pending" ? (
        <Button
          label={phase.kind === "pending" ? "Check status" : "Retry"}
          variant="outline"
          size="sm"
          block={false}
          onPress={recheck}
        />
      ) : (
        <Button
          label={
            phase.kind === "failed"
              ? "Try again"
              : phase.kind === "settling"
                ? `Adding practice dollars · ${phase.relay.stage}…`
                : (LABEL[phase.kind] ?? "Claim practice funds")
          }
          size="sm"
          block={false}
          loading={busy}
          disabled={!ready}
          onPress={() => void claim()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHEET_SHAPE.rowRadius, padding: SPACE.lg, gap: SPACE.md },
  text: { gap: SPACE.xs },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, flexShrink: 1 },
});
