/**
 * Duel on the phone (S8.6, D-294; the web's `DuelScreen`): pick a tier and find an opponent (one Face ID: the entry
 * and its permit), wait in the queue, get dealt the same three cards, swipe each Up or Down before the clock runs
 * out — the seat's key signs, no prompt — and watch the cards settle into both totals; the better one takes the pot.
 * Your duels and rating below. Queue, pricing, signing and the match are `@senryo/calls` `useDuelFlow`, the web's own.
 */
import type { DuelRatingView, DuelView } from "@senryo/api-client";
import { DUEL_LIVE_STATES, duelTiers, entryText, opponentOf, outcomeText, tierLine, tierTitle } from "@senryo/calls";
import { type DuelFeel, useDuelFlow, useDuelMoments } from "@senryo/calls/react";
import { duelEntryCost } from "@senryo/config";
import { clockText, shortAddress, usd } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useProfile } from "@senryo/query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "~/components/identity/Avatar";
import { Button } from "~/components/kit/Button";
import { celebrate } from "~/feedback/celebrate";
import { fire, music } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { DuelMatch } from "./DuelMatch";

const DEFAULT_TIER = 1;
const MS_PER_SECOND = 1000;
const DOT = 10;
const PORTRAIT = 72;
const RINGS = 3;
/** One breath of the search (research 10 §4); the rings share it evenly. */
const BREATH_MS = 2400;
const RING_ALPHA = 0.6;
const RING_GROW = 1.4;
const RADAR_H = 200;
/** The phone's feel for a duel's moments (D-317; the web's own hook). */
const FEEL: DuelFeel = { fire, music, celebrate };

export function DuelScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const [tier, setTier] = useState(DEFAULT_TIER);
  const [seen, setSeen] = useState<string | null>(null);
  const flow = useDuelFlow(account, {
    cue: (c) =>
      c === "filled" ? fire("filled", { cue: "open" }) : c === "fail" ? fire("fail", { cue: "error" }) : fire(c),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () => router.push(accountRequiredRoute("duel")),
  });
  useDuelMoments(flow, FEEL);
  const tiers = duelTiers(flow.chainId);
  const chosen = tiers.find((t) => t.id === tier) ?? tiers[0];
  const cost = chosen ? duelEntryCost(chosen) : 0n;
  const dismissed = flow.phase === "done" && flow.match?.matchId === seen;
  const showMatch = flow.match && flow.phase !== "idle" && flow.phase !== "queued" && !dismissed;
  const short = flow.balance !== undefined && flow.balance < cost;
  const why = !flow.live ? "Duels aren't open yet" : short ? "Not enough dollars for this duel" : null;
  return (
    <ScrollView
      style={{ backgroundColor: color.ground }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
    >
      {flow.phase === "queued" && flow.entry ? (
        <Queue
          title={chosen && flow.entry.tier === chosen.id ? tierTitle(chosen) : "Duel"}
          since={flow.entry.since}
          owner={flow.owner}
          onCancel={() => void flow.cancel()}
        />
      ) : showMatch ? (
        <DuelMatch flow={flow} onAgain={() => setSeen(flow.match?.matchId ?? null)} />
      ) : (
        <View style={styles.section} accessibilityLabel="Start a duel">
          <Text style={[TYPE.body, { color: color.inkMuted }]}>
            Three cards each · Up or Down · the better total takes the pot
          </Text>
          <View accessibilityRole="radiogroup">
            {tiers.map((t) => {
              const on = t.id === chosen?.id;
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    fire("tick");
                    setTier(t.id);
                  }}
                  style={[styles.tier, { borderBottomColor: color.hairline }]}
                >
                  <View style={[styles.dot, { backgroundColor: on ? color.primary : color.raised2 }]} />
                  <View style={styles.flex}>
                    <Text style={[TYPE.rowTitle, { color: color.ink }]}>{tierTitle(t)}</Text>
                    <Text style={[TYPE.caption, { color: color.inkMuted }]}>{tierLine(t)}</Text>
                  </View>
                  <Text style={[TYPE.caption, { color: color.inkMuted }]}>{entryText(t)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text accessibilityLiveRegion="polite" style={[TYPE.caption, { color: color.inkMuted }]}>
            {flow.busy ?? why ?? "Every card is a real call · results pay as each window closes"}
          </Text>
          <Button
            label={`Find a duel · ${usd(cost)}`}
            disabled={why !== null || flow.busy !== null}
            loading={flow.busy !== null}
            onPress={() => void flow.enter(tier)}
          />
          {flow.entry?.state === "failed" || flow.entry?.state === "lapsed" ? (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {flow.entry.state === "lapsed"
                ? "Nobody joined in time · nothing was taken"
                : `Couldn't start · ${flow.entry.reason ?? "nothing was taken"}`}
            </Text>
          ) : null}
        </View>
      )}
      <History owner={flow.owner} duels={flow.history} rating={flow.rating} />
    </ScrollView>
  );
}

/** One ring of the search: out from the portrait and gone over a breath, staggered by its place. */
function Ring({ index }: { index: number }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withDelay(
      (index * BREATH_MS) / RINGS,
      withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.out(Easing.quad) }), -1),
    );
  }, [t, index, reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * RING_ALPHA,
    transform: [{ scale: 1 + t.value * RING_GROW }],
  }));
  return <Animated.View style={[styles.ring, { borderColor: color.accent }, style]} />;
}

/** Finding an opponent (R7.8, research 10 §4; the web's `DuelQueue`): your portrait in a breathing search. */
function Queue(p: { title: string; since: string; owner: string | undefined; onCancel: () => void }) {
  const { color } = useTheme();
  const now = useServerSeconds();
  const profile = useProfile(p.owner);
  const avatar = "value" in profile ? (profile.value?.avatar ?? null) : null;
  const waited = Math.max(0, now - Math.floor(Date.parse(p.since) / MS_PER_SECOND));
  return (
    <View style={styles.section} accessibilityLiveRegion="polite">
      <View style={[styles.radar, { backgroundColor: color.arena }]}>
        {Array.from({ length: RINGS }, (_, i) => (
          <Ring key={i} index={i} />
        ))}
        <Avatar avatar={avatar} {...(p.owner ? { address: p.owner } : {})} size={PORTRAIT} />
      </View>
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, styles.center, { color: color.ink }]}>
        Finding an opponent…
      </Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {p.title} · waiting {clockText(waited)}
      </Text>
      <Button label="Leave the queue" variant="secondary" onPress={p.onCancel} />
    </View>
  );
}

function History(p: { owner: string | undefined; duels: readonly DuelView[]; rating: DuelRatingView | null }) {
  const { color } = useTheme();
  const done = p.duels.filter((d) => !DUEL_LIVE_STATES.has(d.state));
  const r = p.rating;
  return (
    <View style={styles.section} accessibilityLabel="Your duels">
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
          Your duels
        </Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {r ? `Rating ${r.rating} · ${r.wins}–${r.losses}${r.ties ? `–${r.ties}` : ""}` : "Rating 1000"}
        </Text>
      </View>
      {done.length === 0 ? (
        <Text style={[TYPE.body, { color: color.inkMuted }]}>Finished duels show here.</Text>
      ) : (
        done.map((d) => {
          const o = outcomeText(d, p.owner);
          const them = opponentOf(d, p.owner);
          return (
            <View key={d.matchId} style={[styles.tier, { borderBottomColor: color.hairline }]}>
              <View style={styles.flex}>
                <Text style={[TYPE.rowTitle, { color: color.ink }]}>{o.title}</Text>
                <Text style={[TYPE.caption, { color: color.inkMuted }]}>vs {them ? shortAddress(them) : "—"}</Text>
              </View>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>{o.detail}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.xl },
  section: { gap: SPACE.md },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm },
  flex: { flex: 1 },
  tier: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.rowMinHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  radar: {
    height: RADAR_H,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ring: { position: "absolute", width: PORTRAIT, height: PORTRAIT, borderRadius: PORTRAIT / 2, borderWidth: 2 },
  center: { textAlign: "center" },
});
