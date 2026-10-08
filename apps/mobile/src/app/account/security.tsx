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
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { Panel } from "~/components/kit/Surface";
import { AuthFlowSheet } from "~/features/auth/AuthFlowSheet";
import { SessionPanel } from "~/features/auth/SessionPanel";
import { SwitchConfirm } from "~/features/auth/SwitchConfirm";
import { useAuthFlow } from "~/features/auth/useAuthFlow";
import { QuietState } from "~/features/profile/QuietState";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { InfoTip } from "~/features/setup/InfoTip";
import { useAccount } from "~/lib/account/provider";
import { requestStepUp } from "~/lib/account/step-up";
import { UNLOCK_WORD } from "~/lib/constants/auth";
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

const INFO = {
  ttl: "Trading locks after this long, however active you are. Leaving the app always locks.",
  idle: "Trading also locks after this long without a signature.",
  gate: `Off by default in Practice. On Mainnet, trades of ${threshold} or more always ask, whatever is chosen here.`,
  rule: `Tightening applies at once. Loosening asks for ${UNLOCK_WORD} first. Withdrawals, one-tap calls and your recovery phrase always ask for ${UNLOCK_WORD} again.`,
} as const;

function Row({ title, info, children }: { title: string; info: string; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.title}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{title}</Text>
        <InfoTip title={title} body={info} />
      </View>
      {children}
    </View>
  );
}

/**
 * Security (A4, A10; F60 / D-037): the trading session first — who, unlocked until when or locked, Unlock / Lock now,
 * Use another account (A5, asked first) — then the three session settings. Tightening applies at once; loosening asks
 * for a fresh passkey first. What each setting means sits behind its ⓘ.
 */
export default function SecurityScreen() {
  const network = useNetwork();
  const { color } = useTheme();
  const account = useAccount();
  const [note, setNote] = useState<string>();
  const [switching, setSwitching] = useState(false);
  const flow = useAuthFlow({ switching: true, onDone: () => router.replace(ROUTES.home) });
  const s = account.settings;
  const faceId: FaceIdMode = s.faceId ?? defaultFaceIdMode(network.key);

  const apply = async (next: SessionSettings) => {
    setNote(undefined);
    if (!isLoosening(s, next, defaultFaceIdMode(network.key))) {
      await account.applySettings(next);
      return setNote("Saved");
    }
    const done = await requestStepUp(
      { title: "Loosen session security", detail: `Confirm with ${UNLOCK_WORD}` },
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
          line="No account on this phone"
          action={{
            label: "Create account",
            variant: "primary",
            onPress: () => router.push(ROUTES.accountRequired),
          }}
        />
      </Screen>
    );
  }
  return (
    <View style={styles.fill}>
      <Screen>
        <Stack.Screen options={{ title: "Security" }} />
        <SessionPanel onSwitch={() => setSwitching(true)} />
        <View style={styles.section}>
          <View style={styles.title}>
            <SectionHeading>Unlocked session</SectionHeading>
            <InfoTip title="Unlocked session" body={INFO.rule} />
          </View>
          <Panel style={styles.panel}>
            <Row title="Session length" info={INFO.ttl}>
              <Segmented
                label="Session length"
                value={String(s.ttlMs)}
                options={SESSION_TTL_CHOICES_MS.map((ms) => ({ value: String(ms), label: minutes(ms) }))}
                onChange={(v) => void apply({ ...s, ttlMs: Number(v) })}
              />
            </Row>
            <Row title="Idle lock" info={INFO.idle}>
              <Segmented
                label="Idle lock"
                value={String(s.idleMs)}
                options={SESSION_IDLE_CHOICES_MS.map((ms) => ({ value: String(ms), label: minutes(ms) }))}
                onChange={(v) => void apply({ ...s, idleMs: Number(v) })}
              />
            </Row>
            <Row title={`${GATE} per trade`} info={INFO.gate}>
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
      </Screen>
      {switching ? <SwitchConfirm onChoose={flow.signIn} onClose={() => setSwitching(false)} /> : null}
      <AuthFlowSheet flow={flow} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  section: { gap: SPACE.md },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  panel: { padding: SPACE.lg, gap: SPACE.xl },
  row: { gap: SPACE.md },
});
