/**
 * One call's receipt (S5.11 → R5.11; pivot "Call: see receipt"): the trade slip (D-331 — folio, the result and its
 * stamp, the facts, the proof; with its row of actions, D-352), then every step with its transaction and the
 * window's proof. A live call opens the terminal.
 */
import { callFigure, callFilm, callKey, callLink, callSlip, callSpan, receiptSteps } from "@senryo/calls";
import { sideName } from "@senryo/core";
import { useCallTimeline, useQueryEnv, useWindowProof } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { ActionCircle } from "~/components/kit/ActionCircle";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { ChartLine } from "~/components/kit/symbols";
import { useDockInset } from "~/components/shell/dock-context";
import { LiveShareSlip, ShareSlip } from "~/features/receipts/ShareSlip";
import { ReplayAction } from "~/features/replay/ReplayAction";
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
  const practice = network.modeLabel === "Practice";
  const kE8 = "value" in proof ? proof.value?.open?.priceE8 : undefined;
  const slip = callSlip(t, { chainId: network.chainId, practice, kE8, url: callLink(c.ticketId, network.chainId) });

  const live = (
    <ActionCircle
      icon={ChartLine}
      label="Live"
      primary
      onPress={() => {
        fire("tick");
        setSymbol(c.symbol);
        router.navigate("/trade");
      }}
    />
  );
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + SPACE.xl }]}>
      <View style={styles.hero}>
        {slip.live ? (
          <LiveShareSlip slip={slip} entryKey={callKey(c.ticketId)} side={sideName(c.band)} lead={live} />
        ) : (
          <ShareSlip
            slip={slip}
            figure={callFigure(t)}
            side={sideName(c.band)}
            lead={
              <ReplayAction
                chainId={network.chainId}
                bookKey={callKey(c.ticketId)}
                url={slip.url}
                span={callSpan(t)}
                build={(episode, candles) => callFilm(t, episode, { practice, kE8, candles })}
              />
            }
          />
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
