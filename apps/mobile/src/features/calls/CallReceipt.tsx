/**
 * One call's receipt (S5.11; pivot "Call: see receipt", "the receipt shows entry → exit"): the market and side, the
 * result in dollars, the facts that made it (stake, what it paid if right, what came back, entry → exit), every step
 * with its transaction, and the window's proof. A live call says what it is waiting for and opens the terminal.
 */
import type { CallTimeline as Timeline } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import {
  lane,
  OPEN_STATES,
  priceText,
  sideName,
  signedUsd,
  stateWord,
  stepTitle,
  toneOf,
  usd,
  whenText,
} from "@senryo/core";
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
import { callLink } from "~/lib/share-link";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { CallTimeline, type Step } from "./CallTimeline";
import { ShareCallButton } from "./ShareCallButton";
import type { ShareCall } from "./ShareCard";
import { WindowProof } from "./WindowProof";

const MARK = 44;
const FAILED_KINDS = new Set(["refused", "close refused", "settled: lose"]);

function stepsOf(t: Timeline): Step[] {
  const steps: Step[] = t.events.map((e, i) => ({
    key: `${e.txHash}-${i}`,
    title: stepTitle(e.kind, e.amount, e.priceE8),
    when: whenText(e.at),
    state: FAILED_KINDS.has(e.kind) ? "failed" : "done",
    ...(e.kind === "settled: win" ? { tone: "up" as const } : {}),
    ...(e.kind === "settled: lose" ? { tone: "down" as const } : {}),
    txHash: e.txHash,
  }));
  const c = t.call;
  const expiry = c.start + c.cadenceSec;
  if (c.status === "committed")
    steps.push({ key: "waiting", title: "Waiting for the fill", when: "About 2 s", state: "running" });
  else if (c.status === "closing")
    steps.push({ key: "waiting", title: "Cashing out", when: "At the next print", state: "running" });
  else if (c.status === "open")
    steps.push({ key: "waiting", title: "Waiting for the close", when: whenText(expiry), state: "running" });
  return steps;
}

/** The share card's words for a finished call: its result, entry and how it ended (cashed out or the close print). */
function shareOf(t: Timeline, chainId: ChainId, mode: string, closeE8: bigint | null): ShareCall {
  const c = t.call;
  const pnl = c.pnl === null ? 0n : BigInt(c.pnl);
  const cashed = t.events.findLast((e) => e.kind === "cashed out");
  const exit = cashed?.priceE8 ?? closeE8;
  return {
    symbol: c.symbol,
    call: `${c.symbol} ${sideName(c.band)} · ${lane(c.cadenceSec)}`,
    result: signedUsd(pnl),
    won: pnl > 0n,
    entry: c.entryE8 === null ? null : priceText(c.entryE8),
    exit: exit === null || exit === undefined ? null : priceText(exit),
    exitLabel: cashed ? "Cashed out at" : "Closed at",
    mode: mode === "Practice" ? "Practice · test dollars" : "Real · USDC",
    url: callLink(c.ticketId, chainId),
  };
}

function Facts({ t }: { t: Timeline }) {
  const { color } = useTheme();
  const c = t.call;
  const filled = t.events.find((e) => e.kind === "filled");
  const exit = t.events.findLast((e) => e.kind === "cashed out");
  const rows: [string, string][] = [
    ["Stake", usd(c.stake)],
    ["Pays if right", filled ? usd(filled.amount) : "—"],
    ...(OPEN_STATES.has(c.status) ? [] : ([["Came back", usd(c.returned)]] as [string, string][])),
    ["Entry", c.entryE8 === null ? "At the next print" : priceText(c.entryE8)],
    ...(exit?.priceE8 ? ([["Cashed out at", priceText(exit.priceE8)]] as [string, string][]) : []),
    ["Signed with", c.viaSession ? "One-tap" : "Your passkey"],
  ];
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
  const proofClose = "value" in proof && proof.value.close ? proof.value.close.priceE8 : null;

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
  const live = OPEN_STATES.has(c.status);
  const pnl = c.pnl === null ? null : BigInt(c.pnl);
  const filled = t.events.find((e) => e.kind === "filled");
  const hero = live ? (filled ? `Pays ${usd(filled.amount)}` : usd(c.stake)) : pnl === null ? "—" : signedUsd(pnl);
  const tone = live ? color.ink : toneOf(pnl) === "up" ? color.up : toneOf(pnl) === "down" ? color.down : color.ink;

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + SPACE.xl }]}>
      <View style={styles.hero}>
        <View style={styles.title}>
          <EntityMark id={marketId(c.symbol)} size={MARK} decorative />
          <Text style={[TYPE.title, { color: color.ink }]}>
            {c.symbol} {sideName(c.band)} · {lane(c.cadenceSec)}
          </Text>
        </View>
        <AmountHero text={hero} color={tone} dimDecimals={live} accessibilityLabel={`${stateWord(c)}, ${hero}`} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {stateWord(c)} · {whenText(c.committedAt)}
        </Text>
        {!live ? <ShareCallButton card={shareOf(t, network.chainId, network.modeLabel, proofClose)} /> : null}
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
      <Facts t={t} />
      <CallTimeline steps={stepsOf(t)} chainId={env.chainId} />
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
