import { NATIVE_ART } from "@senryo/identity/native";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { PRIMER_ART, PrimerScreen, type PrimerTone } from "~/features/setup/PrimerScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { type BiometricOutcome, type Biometrics, readBiometrics, turnOnBiometrics } from "~/lib/biometrics";
import { TIMING } from "~/theme";

const LockArt = NATIVE_ART["primer-face-id"]?.symbol;
/** After "on", the page holds this long so the answer is seen, then moves on by itself. */
const GRANTED_BEAT_MS = TIMING.onboardingScene;

/** "a look" for Face ID, "a touch" for a finger. */
const gestureOf = (word: string) => (word === "Face ID" ? "a look" : "a touch");

function said(outcome: BiometricOutcome | undefined, word: string): { text: string; tone: PrimerTone } | undefined {
  switch (outcome) {
    case undefined:
      return undefined;
    case "on":
      return { text: `${word} is on. Trading unlocks with ${gestureOf(word)}.`, tone: "up" };
    case "cancelled":
      return { text: `Not turned on. Senryo asks again the first time you unlock.`, tone: "muted" };
    case "denied":
      return { text: `${word} is off for Senryo in Settings, so trading unlocks with your passkey.`, tone: "warn" };
    case "locked-out":
      return {
        text: `${word} is locked after too many tries. Unlock the phone with its passcode first.`,
        tone: "warn",
      };
    case "failed":
      return { text: `${word} didn’t respond. Try again, or continue with your passkey.`, tone: "warn" };
  }
}

/**
 * Setup step 5 — the Face ID primer (FT042, C06; Phantom P10 adapted). Unlocking trading reads a Face ID–gated key on
 * this phone; this page asks iOS for that permission in context and does one real scan, so the first unlock is not a
 * surprise. It is not the passkey and never says it is. A phone without Face ID (or with none enrolled) gets one
 * honest line and Continue. Not now moves on; iOS will ask at the first unlock instead.
 */
export default function FaceIdStep() {
  const { next, back } = useSetupNav("face-id");
  const [phone, setPhone] = useState<Biometrics>();
  const [outcome, setOutcome] = useState<BiometricOutcome>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readBiometrics().then(setPhone);
  }, []);
  useEffect(() => {
    if (outcome !== "on") return;
    const timer = setTimeout(next, GRANTED_BEAT_MS);
    return () => clearTimeout(timer);
  }, [outcome, next]);

  const word = phone?.word ?? "Face ID";
  const art = LockArt ? <LockArt width={PRIMER_ART} height={PRIMER_ART} /> : null;
  const turnOn = async () => {
    setBusy(true);
    const result = await turnOnBiometrics(`Turn on ${word} for Senryo`);
    setBusy(false);
    fire(result === "on" ? "confirm" : result === "cancelled" ? "tick" : "warn");
    setOutcome(result);
  };

  if (phone && phone.state !== "ready") {
    const enrolLater = phone.state === "not-enrolled";
    return (
      <PrimerScreen
        art={art}
        motion="lift"
        title={enrolLater ? `Set up ${word} later` : "Unlock with your passkey"}
        body={
          enrolLater
            ? `This phone has no ${word} set up yet. Add it in Settings and trading unlocks with ${gestureOf(word)}; until then your passkey unlocks it.`
            : "This phone can’t use Face ID for Senryo, so trading unlocks with your passkey. Nothing else changes."
        }
        granted={false}
        primary={{ label: "Continue", onPress: next }}
        onBack={back}
      />
    );
  }

  const denied = outcome === "denied";
  return (
    <PrimerScreen
      art={art}
      motion="lift"
      title={`Unlock with ${gestureOf(word)}`}
      body={`${word} opens trading on this phone in a moment, without your passkey each time. Senryo never sees your ${word === "Face ID" ? "face" : "fingerprint"}; the phone only answers yes or no.`}
      status={said(outcome, word)}
      granted={outcome === "on"}
      primary={
        outcome === "on" || denied
          ? { label: "Continue", onPress: next }
          : {
              label: outcome ? "Try again" : `Turn on ${word}`,
              onPress: () => void turnOn(),
              loading: busy,
              disabled: !phone,
            }
      }
      secondary={
        denied
          ? { label: "Open Settings", onPress: () => void Linking.openSettings() }
          : outcome === "on"
            ? undefined
            : { label: "Not now", onPress: next, disabled: busy }
      }
      onBack={back}
    />
  );
}
