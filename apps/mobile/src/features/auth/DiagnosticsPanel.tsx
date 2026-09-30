/**
 * Diagnostics (S6.10): what this phone measured — prompts per ceremony (D-029), flow timings and TTFT (D-037). The
 * user reads these off each device/authenticator for the S6 report; nothing secret is recorded.
 */
import { type MeasureEvent, ttftMs } from "@senryo/account";
import { useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Panel, Rule } from "~/components/kit/Surface";
import { measureStore } from "~/lib/account/measure";
import { MS_PER_SECOND } from "~/lib/constants/time";
import { SPACE, TYPE, useTheme } from "~/theme";

const SHOWN_FLOWS = 8;
const EMPTY: readonly MeasureEvent[] = [];
const seconds = (ms: number) => `${(ms / MS_PER_SECOND).toFixed(1)} s`;

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
  return (
    <Panel style={styles.panel}>
      <View style={styles.row}>
        <Text style={[TYPE.label, { color: color.ink }]}>TIME TO FIRST TX</Text>
        <Text style={[TYPE.numSm, { color: color.ink }]}>
          {ttft === undefined ? "—" : `${seconds(ttft)} · ${stop?.taps ?? 0} taps`}
        </Text>
      </View>
      <Rule />
      {flows.length === 0 ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>No passkey ceremonies recorded on this phone yet.</Text>
      ) : (
        flows.map((f) => (
          <View key={`${f.flow}-${f.at}`} style={styles.row} accessible>
            <Text style={[TYPE.numSm, { color: color.ink }]}>{f.flow.toUpperCase()}</Text>
            <Text style={[TYPE.numSm, { color: f.outcome === "ok" ? color.up : color.down }]}>
              {f.outcome === "ok" ? `${f.prompts} prompt${f.prompts === 1 ? "" : "s"}` : (f.failure ?? f.outcome)} ·{" "}
              {seconds(f.ms)}
            </Text>
          </View>
        ))
      )}
      <Button
        label="Clear log"
        variant="ghost"
        size="sm"
        block={false}
        disabled={events.length === 0}
        onPress={() => measureStore.clear()}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.md, gap: SPACE.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
});
