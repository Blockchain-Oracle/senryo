/**
 * Diagnostics (S6.10): what this phone measured — time to first transaction (D-037) as the one large figure, then the
 * last passkey steps with their prompt counts (D-029) and timings, in plain words. The user reads these off each
 * device/authenticator for the S6 report; nothing secret is recorded. Rows sit in one filled group, separated by
 * their own height.
 */
import { type Flow, type MeasureEvent, ttftMs } from "@senryo/account";
import { useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { measureStore } from "~/lib/account/measure";
import { MS_PER_SECOND } from "~/lib/constants/time";
import { HERO_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";

const SHOWN_FLOWS = 8;
const EMPTY: readonly MeasureEvent[] = [];
const seconds = (ms: number) => `${(ms / MS_PER_SECOND).toFixed(1)} s`;

const FLOW_NAME: Record<Flow, string> = {
  create: "Create account",
  "sign-in": "Sign in",
  unlock: "Unlock",
  gate: "Confirm a trade",
  "step-up": "Fresh passkey check",
  reveal: "Show recovery phrase",
  "vault-create": "Add backup passkey",
  "vault-recover": "Recover with backup",
};

export function DiagnosticsPanel() {
  const { color } = useTheme();
  const events = useSyncExternalStore(measureStore.subscribe, measureStore.get, () => EMPTY);
  const flows = events
    .filter((e): e is Extract<MeasureEvent, { type: "flow" }> => e.type === "flow")
    .slice(-SHOWN_FLOWS);
  const ttft = ttftMs(events);
  const stop = events.find(
    (e): e is Extract<MeasureEvent, { type: "ttft" }> => e.type === "ttft" && e.phase === "stop",
  );
  const taps = stop?.taps ?? 0;
  return (
    <>
      <View style={styles.figure} accessible>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>Time to first transaction</Text>
        <Text maxFontSizeMultiplier={HERO_FONT_SCALE} style={[TYPE.displayPrice, { color: color.ink }]}>
          {ttft === undefined ? "—" : seconds(ttft)}
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          {ttft === undefined
            ? "Measured from opening the app to your first confirmed claim."
            : `${taps} tap${taps === 1 ? "" : "s"}, from opening the app to the confirmed claim.`}
        </Text>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
          Passkey steps
        </Text>
        {flows.length === 0 ? (
          <Text style={[TYPE.body, styles.empty, { color: color.text3 }]}>No passkey steps recorded yet</Text>
        ) : (
          <Panel style={styles.panel}>
            {flows.map((f) => (
              <View key={`${f.flow}-${f.at}`} style={styles.row} accessible>
                <Text style={[TYPE.row, styles.name, { color: color.ink }]}>{FLOW_NAME[f.flow]}</Text>
                <Text style={[TYPE.rowChange, { color: f.outcome === "ok" ? color.up : color.down }]}>
                  {f.outcome === "ok" ? `${f.prompts} prompt${f.prompts === 1 ? "" : "s"}` : (f.failure ?? f.outcome)}
                  {" · "}
                  {seconds(f.ms)}
                </Text>
              </View>
            ))}
          </Panel>
        )}
      </View>
      <Button label="Clear log" variant="outline" disabled={events.length === 0} onPress={() => measureStore.clear()} />
    </>
  );
}

const styles = StyleSheet.create({
  figure: { gap: SPACE.xs },
  section: { gap: SPACE.md },
  panel: { padding: SPACE.lg, gap: SPACE.lg },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: SPACE.sm },
  name: { flex: 1 },
  empty: { textAlign: "center", paddingVertical: SPACE.xl },
});
