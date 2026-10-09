/**
 * One call's receipt (S5.11; pivot "Call: see receipt", "the receipt shows entry → exit"): the market and side, the
 * result in dollars, the facts that made it (stake, what it paid if right, what came back, entry → exit), every step
 * with its transaction, and the window's proof. A live call says what it is waiting for and opens the terminal.
 */
import {
  callLink,
  callTitle,
  callWhere,
  proofCloseE8,
  receiptFacts,
  receiptHero,
  receiptSteps,
  shareOf,
} from "@senryo/calls";
import { stateWord, whenText } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useCallTimeline, useQueryEnv, useWindowProof } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { EntityMark } from "~/components/identity/EntityMark";
import { AmountHero } from "~/components/kit/AmountHero";
import { Button } from "~/components/kit/Button";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { useDockInset } from "~/components/shell/dock-context";
import { fire } from "~/feedback/fire";
import { useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { CallTimeline } from "./CallTimeline";
import { ShareCallButton } from "./ShareCallButton";
import { WindowProof } from "./WindowProof";

const MARK = 44;

function Facts({ rows }: { rows: [string, string][] }) {
  const { color } = useTheme();
  return (
    <View>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.fact} accessible accessibilityLabel={`${label} ${value}`}>
          <Text style={[TYPE.body, styles.flex, { color: color.inkMuted }]}>{label}</Text>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function CallReceipt({ ticketId }: { ticketId: bigint }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const bottom = useDockInset();
  const client = useQueryClient();
  const [, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  const timeline = useCallTimeline(ticketId);
  const network = useNetwork();
  const windowId = "value" in timeline ? timeline.value.call.windowId : undefined;
  const proof = useWindowProof(windowId);
  const proofClose = proofCloseE8("value" in proof ? (proof.value ?? undefined) : undefined);

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
  const { text: hero, tone: heroTone, live } = receiptHero(t);
  const tone = heroTone === "up" ? color.up : heroTone === "down" ? color.down : color.ink;

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + SPACE.xl }]}>
      <View style={styles.hero}>
        <View style={styles.title}>
          <EntityMark id={marketId(c.symbol)} size={MARK} decorative />
          <Text style={[TYPE.title, { color: color.ink }]}>{callTitle(c)}</Text>
        </View>
        <AmountHero text={hero} color={tone} dimDecimals={live} accessibilityLabel={`${stateWord(c)}, ${hero}`} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {stateWord(c)} · {whenText(c.committedAt)}
        </Text>
        {!live ? (
          <ShareCallButton card={shareOf(t, network.modeLabel, proofClose, callLink(c.ticketId, network.chainId))} />
        ) : null}
        {live ? (
          <Button
            label="Watch it live"
            onPress={() => {
              fire("tick");
              setSymbol(c.symbol);
              router.navigate("/trade");
            }}
          />
        ) : null}
      </View>
      <Facts rows={receiptFacts(t, callWhere(t.call, "value" in proof ? proof.value?.open?.priceE8 : undefined))} />
      <CallTimeline steps={receiptSteps(t)} chainId={env.chainId} />
      <WindowProof windowId={c.windowId} chainId={env.chainId} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.xl },
  hero: { gap: SPACE.sm },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  fact: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch },
  flex: { flex: 1 },
});
