/**
 * Duel on the phone as a two-seat arena (P4, D-322 … D-323; Codex's arena, Owarine's duel feel): the stage puts you
 * across from an empty opponent seat with the pot between; the tiers page by below it with how many wait in each and
 * the commitment spelled out; one pinned action finds an opponent (one Face ID: the entry and its permit). Queued, the
 * empty seat breathes as a search with the time waited and the tier's queue — after half a minute the busier tiers are
 * offered, never switched to. Matched, the opponent takes the seat and the match plays on three market lanes
 * (`DuelMatch`). The ladder and your duels follow. Queue, pricing, signing and the match are `@senryo/calls`
 * `useDuelFlow`, the web's own.
 */
import { DUEL_QUIET_SEC, duelTiers, potLine, ratingText, tierTitle, waitingText } from "@senryo/calls";
import { type DuelFeel, useDuelFlow, useDuelMoments } from "@senryo/calls/react";
import { duelEntryCost } from "@senryo/config";
import { clockText, usdTidy } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useDuelWaiting } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { celebrate } from "~/feedback/celebrate";
import { fire, music } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { DuelHistory, DuelLadder } from "./DuelBoard";
import { DuelMatch } from "./DuelMatch";
import { DuelStage } from "./DuelStage";
import { TierCarousel } from "./TierCarousel";

const DEFAULT_TIER = 1;
const MS_PER_SECOND = 1000;
const ACTION_SPACE = SIZE.buttonHeight + SPACE.xl;
/** The phone's feel for a duel's moments (D-317; the web's own hook). */
const FEEL: DuelFeel = { fire, music, celebrate };

export function DuelScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const now = useServerSeconds();
  const [tier, setTier] = useState(DEFAULT_TIER);
  const [seen, setSeen] = useState<string | null>(null);
  const flow = useDuelFlow(account, {
    cue: (c) =>
      c === "filled" ? fire("filled", { cue: "open" }) : c === "fail" ? fire("fail", { cue: "error" }) : fire(c),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () => router.push(accountRequiredRoute("duel")),
  });
  useDuelMoments(flow, FEEL);
  const waitingQuery = useDuelWaiting();
  const waiting = "value" in waitingQuery ? waitingQuery.value : undefined;
  const tiers = duelTiers(flow.chainId);
  const chosen = tiers.find((t) => t.id === tier) ?? tiers[0];
  const cost = chosen ? duelEntryCost(chosen) : 0n;
  const rating = ratingText(flow.rating);
  const dismissed = flow.phase === "done" && flow.match?.matchId === seen;
  const inMatch = flow.match !== null && flow.phase !== "idle" && flow.phase !== "queued" && !dismissed;
  const queued = flow.phase === "queued" && flow.entry !== null;
  const short = flow.balance !== undefined && flow.balance < cost;
  const why = !flow.live ? "Duels aren't open yet" : short ? "Not enough dollars for this duel" : null;
  const waited = queued && flow.entry ? Math.max(0, now - Math.floor(Date.parse(flow.entry.since) / MS_PER_SECOND)) : 0;
  const queuedTier = queued ? tiers.find((t) => t.id === flow.entry?.tier) : undefined;
  const stageTier = queuedTier ?? chosen;
  const count = (id: number) => (waiting ? (waiting.get(id) ?? 0) : undefined);
  // Half a minute in, the tiers with someone waiting are offered (never switched to on their own).
  const busier =
    queued && waited >= DUEL_QUIET_SEC ? tiers.filter((t) => t.id !== queuedTier?.id && (count(t.id) ?? 0) > 0) : [];
  const switchTo = async (id: number) => {
    fire("tick");
    await flow.cancel();
    setTier(id);
    await flow.enter(id);
  };

  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (inMatch ? SPACE.xl : ACTION_SPACE) }]}
      >
        {inMatch ? (
          <DuelMatch
            flow={flow}
            rating={rating}
            onRematch={(t) => {
              setTier(t);
              void flow.enter(t);
            }}
            onDone={() => setSeen(flow.match?.matchId ?? null)}
          />
        ) : (
          <View style={styles.section}>
            <DuelStage
              me={flow.owner}
              rating={rating}
              opponent={
                queued
                  ? {
                      kind: "searching",
                      line: `Searching · ${clockText(waited)}`,
                      detail: waitingText(queuedTier ? count(queuedTier.id) : undefined),
                    }
                  : { kind: "empty" }
              }
              pot={stageTier ? potLine(stageTier) : "—"}
            >
              <Text style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>
                {queued
                  ? `${queuedTier ? tierTitle(queuedTier) : "Duel"} · the same three cards for both of you`
                  : "Three calls each on the same cards · the better total takes the pot"}
              </Text>
            </DuelStage>
            {queued ? (
              busier.length > 0 ? (
                <View style={styles.offers} accessibilityLabel="Busier tiers">
                  <Text style={[TYPE.caption, { color: color.inkMuted }]}>Quiet here. Others are waiting in:</Text>
                  {busier.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => void switchTo(t.id)}
                      accessibilityRole="button"
                      style={[styles.offer, { backgroundColor: color.card }]}
                    >
                      <Text style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>{tierTitle(t)}</Text>
                      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{waitingText(count(t.id))}</Text>
                      <Text style={[TYPE.rowTitle, { color: color.link }]}>Switch</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null
            ) : (
              <TierCarousel tiers={tiers} value={chosen?.id ?? tier} onChange={setTier} waiting={waiting} />
            )}
            {flow.entry?.state === "failed" || flow.entry?.state === "lapsed" ? (
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>
                {flow.entry.state === "lapsed"
                  ? "Nobody joined in time · nothing was taken"
                  : `Couldn't start · ${flow.entry.reason ?? "nothing was taken"}`}
              </Text>
            ) : null}
          </View>
        )}
        <DuelLadder me={flow.owner} rating={flow.rating} />
        <DuelHistory me={flow.owner} duels={flow.history} />
      </ScrollView>
      {inMatch ? null : (
        <View style={[styles.action, { backgroundColor: color.ground, paddingBottom: insets.bottom + SPACE.sm }]}>
          {queued ? (
            <Button label="Leave the queue" variant="secondary" onPress={() => void flow.cancel()} />
          ) : (
            <>
              {(flow.busy ?? why) ? (
                <Text accessibilityLiveRegion="polite" style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>
                  {flow.busy ?? why}
                </Text>
              ) : null}
              <Button
                label={`Find opponent · ${usdTidy(cost)}`}
                disabled={why !== null || flow.busy !== null}
                loading={flow.busy !== null}
                onPress={() => void flow.enter(chosen?.id ?? tier)}
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.xl },
  section: { gap: SPACE.lg },
  center: { textAlign: "center" },
  offers: { gap: SPACE.sm },
  offer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch + SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: SPACE.md,
  },
  action: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: SPACE.xs,
    paddingHorizontal: SIZE.gutter,
    paddingTop: SPACE.sm,
  },
});
