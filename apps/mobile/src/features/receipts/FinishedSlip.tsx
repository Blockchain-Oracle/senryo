/**
 * A trade of this session that has ended, on the phone (R5.11; the web's `FinishedSlip`): its slip under "Just
 * finished" — the receipt itself, stamped (pressed once if it has just ended) — with its receipt and Dismiss.
 */
import { dismissFinished, type FinishedTrade, useFinishedSlip } from "@senryo/calls/react";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { SPACE } from "~/theme";
import { TradeSlip } from "./TradeSlip";

/** A result this fresh presses its stamp as it appears; older ones show it at rest. */
const FRESH_MS = 4_000;

export function FinishedSlip({ run }: { run: FinishedTrade }) {
  const slip = useFinishedSlip(run);
  const [fresh] = useState(() => Date.now() - run.at < FRESH_MS);
  if (!slip) return null;
  return (
    <View style={styles.wrap}>
      <TradeSlip slip={slip} press={fresh && !slip.live} />
      <View style={styles.actions}>
        <Button
          label="Receipt"
          variant="secondary"
          size="sm"
          block={false}
          onPress={() => {
            fire("tick");
            router.push((run.instrument === "call" ? `/calls/${run.id}` : `/calls/rides/${run.id}`) as Href);
          }}
        />
        <Button
          label="Dismiss"
          variant="ghost"
          size="sm"
          block={false}
          onPress={() => {
            fire("tick");
            dismissFinished(run);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  actions: { flexDirection: "row", gap: SPACE.sm, justifyContent: "center" },
});
