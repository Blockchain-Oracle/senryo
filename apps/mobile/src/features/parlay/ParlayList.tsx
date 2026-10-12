/**
 * Your parlays as settlement tracks (P3, D-326; Codex's "the chain becomes a settlement track", Mitoshi's tickets): the
 * big line (what it pays while live, the result once done) and where it stands, then the legs as a chain of marks —
 * each with its verdict, or live "Ahead" / "Behind" and its countdown while pending; a link lights once both its ends
 * came true. Verdicts already in replay 420 ms apart when the track first shows; a verdict that arrives while you watch
 * lands with a tick. One miss marks the parlay lost while the other legs keep reporting. Open ones first.
 */
import { parlayHero, parlayStatus } from "@senryo/calls";
import { type LegTone, useLegStanding } from "@senryo/calls/react";
import { lane, sideName, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useParlays } from "@senryo/query";
import { type Href, router } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { Check, Clock, X } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { SLOT_CENTRE_PERCENT } from "./constants";

const MARK = 40;
const BADGE = 18;
const BADGE_ICON = 11;
const LINK = 2;
/** Verdicts already in replay this far apart when a track first shows. */
const REPLAY_MS = 420;

type Parlay = Extract<ReturnType<typeof useParlays>, { value: unknown }>["value"]["parlays"][number];
type Leg = Parlay["legs"][number];

export function ParlayList({ owner }: { owner: `0x${string}` | undefined }) {
  const { color } = useTheme();
  const parlays = useParlays(owner);
  if (!owner || !("value" in parlays)) return null;
  const list = [...parlays.value.parlays].sort((a, b) => Number(inPlay(b)) - Number(inPlay(a)));
  return (
    <View style={styles.wrap} accessibilityLabel="Your parlays">
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Your parlays
      </Text>
      {list.length === 0 ? (
        <Text style={[TYPE.body, { color: color.inkMuted }]}>Placed parlays settle here, leg by leg.</Text>
      ) : (
        list.map((p) => <Track key={String(p.parlayId)} parlay={p} />)
      )}
    </View>
  );
}

const inPlay = (p: Parlay) => p.state === "open" || p.state === "committed";

/** The parlays still in play, on Calls (P3): their tracks under "Parlays in play", with the way to Parlay. */
export function OpenParlays({ owner }: { owner: `0x${string}` | undefined }) {
  const { color } = useTheme();
  const parlays = useParlays(owner);
  if (!owner || !("value" in parlays)) return null;
  const open = parlays.value.parlays.filter(inPlay);
  if (open.length === 0) return null;
  return (
    <View style={styles.open} accessibilityLabel="Parlays in play">
      <View style={styles.openHead}>
        <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
          Parlays in play
        </Text>
        <Pressable onPress={() => router.push("/parlay" as Href)} accessibilityRole="link" hitSlop={SPACE.sm}>
          <Text style={[TYPE.rowTitle, { color: color.link }]}>See all</Text>
        </Pressable>
      </View>
      {open.map((p) => (
        <Track key={String(p.parlayId)} parlay={p} />
      ))}
    </View>
  );
}

function Track({ parlay }: { parlay: Parlay }) {
  const { color } = useTheme();
  const hero = parlayHero(parlay);
  const tone = { up: color.up, down: color.down, ink: color.ink } as const;
  return (
    <View style={[styles.track, { backgroundColor: color.card }]}>
      <View style={styles.head}>
        <Text style={[TYPE.numMd, { color: tone[hero.tone] }]}>{hero.text}</Text>
        <Text style={[TYPE.caption, styles.status, { color: color.inkMuted }]}>{parlayStatus(parlay)}</Text>
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {usd(parlay.stake)} · {parlay.legs.length} legs
      </Text>
      <View style={styles.chain}>
        {/* The links, behind the marks: one lights once both its ends came true. */}
        <View
          pointerEvents="none"
          style={[
            styles.links,
            {
              left: `${SLOT_CENTRE_PERCENT / parlay.legs.length}%`,
              right: `${SLOT_CENTRE_PERCENT / parlay.legs.length}%`,
            },
          ]}
        >
          {parlay.legs.slice(1).map((l, i) => (
            <View
              key={l.windowId}
              style={[
                styles.link,
                {
                  backgroundColor: l.outcome === "won" && parlay.legs[i]?.outcome === "won" ? color.up : color.raised2,
                },
              ]}
            />
          ))}
        </View>
        {parlay.legs.map((l, i) => (
          <TrackLeg key={l.windowId} leg={l} index={i} />
        ))}
      </View>
    </View>
  );
}

function TrackLeg({ leg, index }: { leg: Leg; index: number }) {
  const { color } = useTheme();
  const standing = useLegStanding(leg);
  const tones: Record<LegTone, string> = { up: color.up, down: color.down, muted: color.inkMuted };
  // Verdicts present on the first render replay in order; later ones land as they arrive.
  const firstOutcome = useRef(leg.outcome);
  const arrived = useRef(false);
  useEffect(() => {
    if (leg.outcome === firstOutcome.current && !arrived.current) return;
    arrived.current = true;
    if (leg.outcome !== "pending") fire("tick");
  }, [leg.outcome]);
  const delay = arrived.current ? 0 : index * REPLAY_MS;
  const badge =
    leg.outcome === "won"
      ? color.up
      : leg.outcome === "lost"
        ? color.down
        : leg.outcome === "pending"
          ? color.raised2
          : color.muted;
  const Icon = leg.outcome === "won" ? Check : leg.outcome === "lost" ? X : Clock;
  return (
    <View style={styles.node}>
      <View>
        <EntityMark id={marketId(leg.symbol)} size={MARK} decorative />
        <Animated.View
          key={leg.outcome}
          {...(leg.outcome === "pending" ? {} : { entering: ZoomIn.delay(delay).springify() })}
          style={[styles.badge, { backgroundColor: badge }]}
        >
          <Icon size={BADGE_ICON} color={leg.outcome === "pending" ? color.inkMuted : color.ground} strokeWidth={2.5} />
        </Animated.View>
      </View>
      <Text numberOfLines={1} style={[TYPE.micro, styles.center, { color: color.ink }]}>
        {leg.symbol} {sideName(leg.band)} · {lane(leg.cadenceSec)}
      </Text>
      <Text
        numberOfLines={1}
        accessibilityLiveRegion="polite"
        style={[TYPE.micro, styles.center, { color: tones[standing.tone] }]}
      >
        {standing.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm },
  open: { gap: SPACE.sm, paddingBottom: SPACE.sm },
  openHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  track: { borderRadius: RADIUS.lg, padding: SPACE.md, gap: SPACE.xs },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm },
  status: { flexShrink: 1, textAlign: "right" },
  chain: { flexDirection: "row", paddingTop: SPACE.sm },
  node: { flex: 1, alignItems: "center", gap: SPACE.xxs },
  links: { position: "absolute", top: SPACE.sm + MARK / 2 - LINK / 2, flexDirection: "row" },
  link: { flex: 1, height: LINK },
  badge: {
    position: "absolute",
    right: -SPACE.xxs,
    bottom: -SPACE.xxs,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
});
