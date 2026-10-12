/**
 * One call's receipt (S5.11 → R5.11; pivot "Call: see receipt"): the trade slip (D-331 — folio, the result and its
 * stamp, the facts, the proof; shared or saved as one image), then every step with its transaction and the window's
 * proof. A live call opens the terminal.
 */
import { callLink, callSlip, receiptSteps } from "@senryo/calls";
import { useCallTimeline, useQueryEnv, useWindowProof } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { Button } from "~/components/kit/Button";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { useDockInset } from "~/components/shell/dock-context";
import { SlipShare } from "~/features/receipts/SlipShare";
import { TradeSlip } from "~/features/receipts/TradeSlip";
import { fire } from "~/feedback/fire";
import { useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE } from "~/theme";
import { CallTimeline } from "./CallTimeline";
import { WindowProof } from "./WindowProof";

export function CallReceipt({ ticketId }: { ticketId: bigint }) {
  const env = useQueryEnv();
  const bottom = useDockInset();
  const client = useQueryClient();
  const [, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  const timeline = useCallTimeline(ticketId);
  const network = useNetwork();
  const windowId = "value" in timeline ? timeline.value.call.windowId : undefined;
  const proof = useWindowProof(windowId);

  if (!("value" in timeline)) {
    if (timeline.status !== "failed") return <LoadingState />;
    return (
      <EmptyState
        why="This call isn’t in the history yet"
        detail="It appears a few seconds after it opens."
        action={{
          label: "Try again",
          onPress: () => void client.invalidateQueries({ queryKey: ["history", env.chainId, "call"] }),
        }}
      />
    );
  }
  const t = timeline.value;
  const c = t.call;
  const slip = callSlip(t, {
    chainId: network.chainId,
    practice: network.modeLabel === "Practice",
    kE8: "value" in proof ? proof.value?.open?.priceE8 : undefined,
    url: callLink(c.ticketId, network.chainId),
  });

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + SPACE.xl }]}>
      <View style={styles.hero}>
        <TradeSlip slip={slip} />
        {slip.live ? (
          <Button
            label="Watch it live"
            onPress={() => {
              fire("tick");
              setSymbol(c.symbol);
              router.navigate("/trade");
            }}
          />
        ) : (
          <SlipShare slip={slip} />
        )}
      </View>
      <CallTimeline steps={receiptSteps(t)} chainId={env.chainId} />
      <WindowProof windowId={c.windowId} chainId={env.chainId} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.xl },
  hero: { gap: SPACE.md },
});
