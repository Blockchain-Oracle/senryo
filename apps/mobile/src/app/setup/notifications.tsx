import { NATIVE_ART } from "@senryo/identity/native";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
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

const BellArt = NATIVE_ART["primer-notifications"]?.symbol;
type Outcome = "on" | "on-unsent" | "declined";

const SAID: Record<Outcome, { text: string; tone: PrimerTone }> = {
  on: { text: "Notifications are on", tone: "up" },
  "on-unsent": { text: "On · connects at your next unlock", tone: "up" },
  declined: { text: "Off · turn on any time in Settings", tone: "muted" },
};

/**
 * Setup — the notification primer (A2: art, one title, one line, Turn on / Not now) (FT008, C07; Solflare S14 adapted): what Senryo will tell you — fills, stop
 * losses, liquidation warnings, deposits and your own price alerts — before iOS asks. "Turn on" raises the OS prompt
 * and, when allowed, registers this phone for every kind (each can be switched off in You → Notifications). A phone
 * that already answered is told what it chose, with Settings one tap away; a build without the module says so.
 */
export default function NotificationsStep() {
  const address = useAccount().hint?.address;
  return <AccountNotifications key={address ?? "guest"} />;
}

function AccountNotifications() {
  const { next, back, address } = useSetupNav("notifications");
  const account = useAccount();
  const [permission, setPermission] = useState<PushPermission>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [busy, setBusy] = useState(false);

  const [readFailed, setReadFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const alive = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !running.current) {
        setOutcome(undefined);
        setRefresh((value) => value + 1);
      }
    });
    return () => {
      alive.current = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setReadFailed(false);
    void readPushPermission().then(
      (value) => {
        if (!cancelled) setPermission(value);
      },
      () => {
        if (!cancelled) setReadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const turnOn = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const answer = await askPushPermission();
      if (!alive.current) return;
      setPermission(answer);
      if (answer !== "granted") {
        fire("tick");
        setOutcome("declined");
        return;
      }
      let sent = false;
      if (account.client && address) {
        sent = await registerPush(account.client, address, account.settings.faceId, DEFAULT_CHANNELS)
          .then(() => true)
          .catch(() => false);
      }
      if (!alive.current) return;
      fire("confirm");
      setOutcome(sent ? "on" : "on-unsent");
    } catch {
      if (alive.current) setReadFailed(true);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const art = BellArt ? <BellArt width={PRIMER_ART} height={PRIMER_ART} /> : null;
  const title = "Don’t miss a move";
  const body = "Fills, warnings and money arriving";

  if (readFailed) {
    return (
      <PrimerScreen
        step="notifications"
        art={art}
        motion="sway"
        title={title}
        body={body}
        granted={false}
        status={{ text: "Couldn’t check notifications. Try again or continue.", tone: "warn" }}
        primary={{ label: "Try again", onPress: () => setRefresh((value) => value + 1) }}
        secondary={{ label: "Not now", onPress: next }}
        onBack={back}
        onSkip={next}
      />
    );
  }
  if (permission === "unavailable") {
    return (
      <PrimerScreen
        step="notifications"
        onSkip={next}
        art={art}
        motion="sway"
        title={title}
        body="Needs a newer build of Senryo"
        granted={false}
        primary={{ label: "Continue", onPress: next }}
        onBack={back}
      />
    );
  }
  // Already answered before this page (another account on this phone, or Settings): say so, don't ask again.
  const answered = !busy && outcome === undefined && (permission === "granted" || permission === "denied");
  if (answered) {
    const on = permission === "granted";
    return (
      <PrimerScreen
        step="notifications"
        onSkip={next}
        art={art}
        motion="sway"
        title={title}
        body={body}
        status={
          on ? { text: "Already on for Senryo", tone: "up" } : { text: "Off for Senryo in Settings", tone: "warn" }
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
      step="notifications"
      onSkip={busy ? undefined : next}
      art={art}
      motion="sway"
      title={title}
      body={body}
      status={outcome ? SAID[outcome] : undefined}
      granted={outcome === "on" || outcome === "on-unsent"}
      primary={
        outcome
          ? { label: "Continue", onPress: next }
          : { label: "Turn on", onPress: () => void turnOn(), loading: busy, disabled: !permission }
      }
      secondary={outcome ? undefined : { label: "Not now", onPress: next, disabled: busy }}
      onBack={busy ? undefined : back}
    />
  );
}
