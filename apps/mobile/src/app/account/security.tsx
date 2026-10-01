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
import { router, Stack } from "expo-router";
import { type ReactNode, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { Panel } from "~/components/kit/Surface";
import { QuietState } from "~/features/profile/QuietState";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { useAccount } from "~/lib/account/provider";
import { requestStepUp } from "~/lib/account/step-up";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_MINUTE = 60_000;
const USD_DECIMALS = 6;
const minutes = (ms: number) => `${ms / MS_PER_MINUTE} min`;
const threshold = `$${formatUnits(FACE_ID_TRADE_THRESHOLD_USD6, USD_DECIMALS, 0)}`;
const GATE = Platform.OS === "ios" ? "Face ID" : "Fingerprint";
const FACE_ID_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "above-threshold", label: `≥ ${threshold}` },
  { value: "every-trade", label: "Every" },
] as const;

function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{title}</Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{hint}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * F60 / F04 security (D-037): tighten instantly; loosening asks for a fresh passkey first (session-policy §2). The three
 * settings share one filled group and are separated by their own spacing, not by lines; what a change did ("Saved",
 * "Unchanged") is said in a reserved line under the group, and the standing passkey note stays where it is. One
 * action on the page: Lock now.
 */
export default function SecurityScreen() {
  const network = useNetwork();
  const { color } = useTheme();
  const account = useAccount();
  const [note, setNote] = useState<string>();
  const s = account.settings;
  const faceId: FaceIdMode = s.faceId ?? defaultFaceIdMode(network.key);

  const apply = async (next: SessionSettings) => {
    setNote(undefined);
    if (!isLoosening(s, next, defaultFaceIdMode(network.key))) {
      await account.applySettings(next);
      return setNote("Saved");
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
    setNote(done ? "Saved" : "Unchanged");
  };

  if (!account.hint) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Security" }} />
        <QuietState
          line="Security settings apply once you have an account"
          action={{ label: "Create account", variant: "primary", onPress: () => router.push(ROUTES.accountRequired) }}
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Security" }} />
      <View style={styles.section}>
        <SectionHeading detail="Tightening applies at once. Loosening asks for your passkey first.">
          Trading session
        </SectionHeading>
        <Panel style={styles.panel}>
          <Row title="Session length" hint="Trading locks after this long, however active you are.">
            <Segmented
              label="Session length"
              value={String(s.ttlMs)}
              options={SESSION_TTL_CHOICES_MS.map((ms) => ({ value: String(ms), label: minutes(ms) }))}
              onChange={(v) => void apply({ ...s, ttlMs: Number(v) })}
            />
          </Row>
          <Row
            title="Idle lock"
            hint="It also locks after this long without a signature. Leaving the app always locks."
          >
            <Segmented
              label="Idle lock"
              value={String(s.idleMs)}
              options={SESSION_IDLE_CHOICES_MS.map((ms) => ({ value: String(ms), label: minutes(ms) }))}
              onChange={(v) => void apply({ ...s, idleMs: Number(v) })}
            />
          </Row>
          <Row
            title={`${GATE} per trade`}
            hint={`Off by default in Practice. On Mainnet, trades of ${threshold} or more always ask, whatever is chosen here.`}
          >
            <Segmented
              label={`${GATE} per trade`}
              value={faceId}
              options={FACE_ID_OPTIONS}
              onChange={(v) => void apply({ ...s, faceId: v })}
            />
          </Row>
        </Panel>
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.text2 }]}>
          {note ?? " "}
        </Text>
      </View>
      <View style={styles.passkey}>
        <PasskeyGlyph color={color.text3} />
        <Text style={[TYPE.rowDetail, styles.note, { color: color.text3 }]}>
          Withdrawals, sends, card limits and your recovery phrase always ask for a fresh passkey.
        </Text>
      </View>
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
  section: { gap: SPACE.md },
  panel: { padding: SPACE.lg, gap: SPACE.xl },
  row: { gap: SPACE.md },
  text: { gap: SPACE.xxs },
  passkey: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  note: { flex: 1 },
});
