import { NATIVE_ART } from "@senryo/identity/native";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { PRIMER_ART, PrimerScreen, type PrimerTone } from "~/features/setup/PrimerScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import {
  askPushPermission,
  DEFAULT_CHANNELS,
  type PushPermission,
  readPushPermission,
  registerPush,
} from "~/lib/notifications/push";
import { TIMING } from "~/theme";

const BellArt = NATIVE_ART["primer-notifications"]?.symbol;
/** After "on", the page holds this long so the answer is seen, then moves on by itself. */
const GRANTED_BEAT_MS = TIMING.onboardingScene;

type Outcome = "on" | "on-unsent" | "declined";

const SAID: Record<Outcome, { text: string; tone: PrimerTone }> = {
  on: { text: "Notifications are on.", tone: "up" },
  "on-unsent": { text: "On. Senryo finishes connecting this phone the next time you unlock.", tone: "up" },
  declined: { text: "No notifications. You can turn them on any time in Settings.", tone: "muted" },
};

/**
 * Setup step 6 — the notification primer (FT008, C07; Solflare S14 adapted): what Senryo will tell you — fills, stop
 * losses, liquidation warnings, deposits and your own price alerts — before iOS asks. "Turn on" raises the OS prompt
 * and, when allowed, registers this phone for every kind (each can be switched off in You → Notifications). A phone
 * that already answered is told what it chose, with Settings one tap away; a build without the module says so.
 */
export default function NotificationsStep() {
  const { next, back, address } = useSetupNav("notifications");
  const account = useAccount();
  const [permission, setPermission] = useState<PushPermission>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readPushPermission().then(setPermission);
  }, []);
  useEffect(() => {
    if (outcome !== "on" && outcome !== "on-unsent") return;
    const timer = setTimeout(next, GRANTED_BEAT_MS);
    return () => clearTimeout(timer);
  }, [outcome, next]);

  const turnOn = async () => {
    setBusy(true);
    const answer = await askPushPermission();
    setPermission(answer);
    if (answer !== "granted") {
      setBusy(false);
      fire("tick");
      return setOutcome("declined");
    }
    let sent = false;
    if (account.client && address) {
      sent = await registerPush(account.client, address, account.settings.faceId, DEFAULT_CHANNELS)
        .then(() => true)
        .catch(() => false);
    }
    setBusy(false);
    fire("confirm");
    setOutcome(sent ? "on" : "on-unsent");
  };

  const art = BellArt ? <BellArt width={PRIMER_ART} height={PRIMER_ART} /> : null;
  const title = "Don’t miss a move";
  const body =
    "Fills, stop losses, liquidation warnings, deposits and the price alerts you set. Only news about your money, never marketing.";

  if (permission === "unavailable") {
    return (
      <PrimerScreen
        art={art}
        motion="sway"
        title={title}
        body="This build of Senryo can’t receive notifications yet. Update the app, then turn them on in You → Notifications."
        granted={false}
        primary={{ label: "Continue", onPress: next }}
        onBack={back}
      />
    );
  }
  // Already answered before this page (another account on this phone, or Settings): say so, don't ask again.
  const answered = outcome === undefined && (permission === "granted" || permission === "denied");
  if (answered) {
    const on = permission === "granted";
    return (
      <PrimerScreen
        art={art}
        motion="sway"
        title={title}
        body={body}
        status={
          on
            ? { text: "Notifications are already on for Senryo.", tone: "up" }
            : { text: "Notifications are off for Senryo in Settings.", tone: "warn" }
        }
        granted={on}
        primary={{ label: "Continue", onPress: next }}
        secondary={on ? undefined : { label: "Open Settings", onPress: () => void Linking.openSettings() }}
        onBack={back}
      />
    );
  }
  return (
    <PrimerScreen
      art={art}
      motion="sway"
      title={title}
      body={body}
      status={outcome ? SAID[outcome] : undefined}
      granted={outcome === "on" || outcome === "on-unsent"}
      primary={
        outcome
          ? { label: "Continue", onPress: next }
          : { label: "Turn on notifications", onPress: () => void turnOn(), loading: busy, disabled: !permission }
      }
      secondary={outcome ? undefined : { label: "Not now", onPress: next, disabled: busy }}
      onBack={back}
    />
  );
}
