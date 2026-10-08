import { useFocusEffect, usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, StyleSheet, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { Button } from "~/components/kit/Button";
import { FaceId } from "~/components/kit/symbols";
import { Sheet } from "~/components/sheet/Sheet";
import { useDock } from "~/components/shell/dock-context";
import { fire } from "~/feedback/fire";
import { waitForAuthForeground } from "~/lib/account/foreground";
import { useAccount } from "~/lib/account/provider";
import { type BiometricOutcome, type Biometrics, readBiometrics, turnOnBiometrics } from "~/lib/biometrics";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";
import { completeSetupStep, pendingSetupStep } from "./progress";

/** U14-S17: genuine local biometric primer over Home, separate from account passkey sign-in. */
export function ContextualFaceId() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const pathname = usePathname();
  useMMKVString(STORAGE_KEYS.setup, storage);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const owed = pendingSetupStep(address) === "face-id";
  const visible = focused && pathname === "/home" && owed;
  const { hide, show } = useDock();
  useEffect(() => {
    if (!visible) return;
    hide("contextual-face-id");
    return () => show("contextual-face-id");
  }, [visible, hide, show]);
  const [phone, setPhone] = useState<Biometrics>();
  const [readFailed, setReadFailed] = useState(false);
  const [outcome, setOutcome] = useState<BiometricOutcome>();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const current = useRef(address);
  current.current = address;
  const [refresh, setRefresh] = useState(0);
  const interruptions = useRef(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") interruptions.current += 1;
      if (state === "active") {
        if (!running.current) setOutcome(undefined);
        setRefresh((value) => value + 1);
      }
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    setOutcome(undefined);
    setBusy(false);
  }, [address]);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setPhone(undefined);
    setReadFailed(false);
    void readBiometrics().then(
      (value) => {
        if (!cancelled) setPhone(value);
      },
      () => {
        if (!cancelled) setReadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [visible, address, refresh]);
  const next = () => {
    if (!alive.current || !address || running.current || pendingSetupStep(address) !== "face-id") return;
    completeSetupStep(address, "face-id");
  };
  const enable = async () => {
    if (running.current || phone?.state !== "ready" || !address) return;
    const owner = address;
    running.current = true;
    setBusy(true);
    const review = interruptions.current;
    let result = await turnOnBiometrics(`Enable ${phone.word} for Senryo`);
    if (result === "on") {
      try {
        await waitForAuthForeground({
          current: () => AppState.currentState,
          subscribe: (listener) => {
            const sub = AppState.addEventListener("change", listener);
            return () => sub.remove();
          },
        });
      } catch {
        result = "cancelled";
      }
      if (review !== interruptions.current) result = "cancelled";
    }
    running.current = false;
    if (!alive.current || current.current !== owner) return;
    setBusy(false);
    setOutcome(result);
    fire(result === "on" ? "confirm" : result === "cancelled" ? "tick" : "warn");
    // Return to the same Home after the genuine scan. Notifications remain a separate user-initiated step.
    if (result === "on" && pendingSetupStep(owner) === "face-id") completeSetupStep(owner, "face-id");
  };
  if (!visible) return null;
  const word = phone?.word ?? "Face ID";
  const supported = phone?.state === "ready";
  const text =
    outcome === "on"
      ? `${word} is enabled on this phone.`
      : outcome === "denied"
        ? `Allow ${word} for Senryo in Settings, then return to try again.`
        : outcome === "locked-out"
          ? "Unlock your phone before trying again."
          : outcome === "cancelled"
            ? "Nothing changed. You can try again or continue."
            : outcome === "failed" || readFailed
              ? "Couldn’t check biometrics. You can continue with your passkey."
              : !phone
                ? "Checking this phone…"
                : phone.state === "not-enrolled"
                  ? `Set up ${word} in your phone’s Settings. Your passkey remains available.`
                  : phone.state === "old-build"
                    ? "This app build cannot check biometrics. Your passkey remains available."
                    : phone.state === "unavailable"
                      ? "Biometrics aren’t available on this phone. Use your passkey to unlock."
                      : `Use ${word} to unlock trading on this phone. Sends and withdrawals ask for it again.`;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Sheet closeLabel="Not now" onClose={next} dismissible={!busy}>
        <View style={styles.content}>
          <FaceId size={64} color={color.action} />
          <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
            {outcome === "on" ? `${word} enabled` : `Enable ${word}`}
          </Text>
          <Text accessibilityLiveRegion="polite" style={[TYPE.body, styles.center, { color: color.text2 }]}>
            {text}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            label={
              outcome === "on" || (phone && !supported) || readFailed
                ? "Continue"
                : outcome
                  ? "Try again"
                  : `Enable ${word}`
            }
            loading={busy}
            disabled={!phone && !readFailed}
            onPress={outcome === "on" || (phone && !supported) || readFailed ? next : () => void enable()}
          />
          {outcome === "denied" ? (
            <Button label="Open Settings" variant="outline" onPress={() => void Linking.openSettings()} />
          ) : null}
          {outcome !== "on" ? <Button label="Not now" variant="outline" disabled={busy} onPress={next} /> : null}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.lg },
  center: { textAlign: "center" },
  actions: { gap: SPACE.sm },
});
