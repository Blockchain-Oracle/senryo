import {
  defaultFaceIdMode,
  FACE_ID_TRADE_THRESHOLD_USD6,
  type FaceIdMode,
  isLoosening,
  SESSION_IDLE_CHOICES_MS,
  SESSION_TTL_CHOICES_MS,
  type SessionSettings,
} from "@senryo/account";
import { formatUnits } from "@senryo/core";
import { Stack } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { Panel, Rule, SectionLabel } from "~/components/kit/Surface";
import { EmptyState } from "~/components/kit/states";
import { useAccount } from "~/lib/account/provider";
import { requestStepUp } from "~/lib/account/step-up";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_MINUTE = 60_000;
const USD_DECIMALS = 6;
const minutes = (ms: number) => `${ms / MS_PER_MINUTE} MIN`;
const threshold = `$${formatUnits(FACE_ID_TRADE_THRESHOLD_USD6, USD_DECIMALS, 0)}`;
const GATE = Platform.OS === "ios" ? "FACE ID" : "FINGERPRINT";
const FACE_ID_OPTIONS = [
  { value: "off", label: "OFF" },
  { value: "above-threshold", label: `≥ ${threshold}` },
  { value: "every-trade", label: "EVERY" },
] as const;

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[TYPE.label, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{hint}</Text>
      {children}
    </View>
  );
}

/** F60 / F04 security (D-037): tighten instantly; loosening asks for a fresh passkey first (session-policy §2). */
export default function SecurityScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const [note, setNote] = useState<string>();
  const s = account.settings;
  const faceId: FaceIdMode = s.faceId ?? defaultFaceIdMode(ACTIVE_NETWORK.key);

  const apply = async (next: SessionSettings) => {
    setNote(undefined);
    if (!isLoosening(s, next, defaultFaceIdMode(ACTIVE_NETWORK.key))) {
      await account.applySettings(next);
      return setNote("Saved.");
    }
    const done = await requestStepUp(
      {
        title: "Loosen session security",
        detail: "Longer sessions or fewer checks need a fresh passkey confirmation.",
      },
      async () => {
        await account.applySettings(next);
        return true;
      },
    );
    setNote(done ? "Saved." : "Unchanged.");
  };

  if (!account.hint) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Security" }} />
        <EmptyState
          why="No account on this phone"
          detail="Security settings apply once you create or open an account."
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Security" }} />
      <SectionLabel>TRADING SESSION</SectionLabel>
      <Panel style={styles.panel}>
        <Row title="SESSION LENGTH" hint="Trading locks after this long, however active you are.">
          <Segmented
            label="Session length"
            value={String(s.ttlMs)}
            options={SESSION_TTL_CHOICES_MS.map((ms) => ({ value: String(ms), label: minutes(ms) }))}
            onChange={(v) => void apply({ ...s, ttlMs: Number(v) })}
          />
        </Row>
        <Rule />
        <Row title="IDLE LOCK" hint="…or after this long without a signature. Leaving the app always locks.">
          <Segmented
            label="Idle lock"
            value={String(s.idleMs)}
            options={SESSION_IDLE_CHOICES_MS.map((ms) => ({ value: String(ms), label: minutes(ms) }))}
            onChange={(v) => void apply({ ...s, idleMs: Number(v) })}
          />
        </Row>
        <Rule />
        <Row
          title={`${GATE} PER TRADE`}
          hint={`Practice default: off (the prompt-free session). Mainnet default: trades of ${threshold} or more.`}
        >
          <Segmented
            label={`${GATE} per trade`}
            value={faceId}
            options={FACE_ID_OPTIONS}
            onChange={(v) => void apply({ ...s, faceId: v })}
          />
        </Row>
      </Panel>
      <Text accessibilityLiveRegion="polite" style={[TYPE.caption, { color: color.inkMuted }]}>
        {note ?? "Withdrawals, sends, card limits and your recovery phrase always ask for a fresh passkey."}
      </Text>
      <Button
        label="Lock now"
        variant="outline"
        disabled={account.snapshot.status !== "unlocked"}
        onPress={() => account.lock()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: SPACE.md },
  row: { gap: SPACE.sm, paddingVertical: SPACE.md },
});
