/**
 * The duel's stage (P4, D-322; Codex's two-seat arena): your seat and the opponent's face each other across a VS, the
 * pot on the line between them, through every phase. Your seat is solid — your portrait, handle and rating ("Your
 * seat" and "Unranked" for a guest). The other is an empty silhouette ("Opponent seat") until you queue, a breathing
 * search while you wait (how long, how many in the tier), then the person you drew. Under each seat, its running
 * total once cards settle — marked provisional until every card is in. The last ten seconds of picking beat.
 */
import { signedUsd } from "@senryo/core";
import { useProfile } from "@senryo/query";
import { type ReactNode, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { Avatar } from "~/components/identity/Avatar";
import { User } from "~/components/kit/symbols";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const STAGE_H = 220;
export const PORTRAIT = 72;
const SILHOUETTE = 32;
const VS_SIZE = 40;
const VS_SPRING = { damping: 9, stiffness: 180 } as const;
const RINGS = 3;
/** One breath of the search (research 10 §4); the rings share it evenly. */
const BREATH_MS = 2400;
const RING_ALPHA = 0.6;
const RING_GROW = 1.4;
const RING_STROKE = 2;
const BEAT_SCALE = 1.04;
const BEAT_IN_MS = 90;
const BEAT_OUT_MS = 180;
const LINE = 2;
/** The opponent's portrait arrives in the empty seat this fast. */
const ARRIVE_MS = 240;

export type OpponentSeat =
  | { kind: "empty" }
  | { kind: "searching"; line: string; detail: string }
  | { kind: "person"; address: string };

export interface SeatTotal {
  total: bigint | null;
  provisional: boolean;
}

/** A seat's person: the handle (or "Your seat" / the short address) and the chosen portrait (R2.8). */
function usePerson(address: string | undefined, fallback: string) {
  const profile = useProfile(address);
  const p = address && "value" in profile ? profile.value : undefined;
  return { name: p?.handle ? `@${p.handle}` : fallback, avatar: p?.avatar ?? null };
}

export function DuelStage(p: {
  me: string | undefined;
  rating: string;
  opponent: OpponentSeat;
  opponentName?: string;
  pot: string;
  totals?: readonly [SeatTotal, SeatTotal] | undefined;
  /** Seconds left while picks close in the last ten (the stage beats each second), else null. */
  beat?: number | null;
  /** A key that replays the VS slam (a new match). */
  matchKey?: string | undefined;
  children?: ReactNode;
}) {
  const { color } = useTheme();
  const me = usePerson(p.me, "Your seat");
  const them = usePerson(p.opponent.kind === "person" ? p.opponent.address : undefined, p.opponentName ?? "Opponent");
  return (
    <Heartbeat beat={p.beat ?? null}>
      <View style={[styles.stage, { backgroundColor: color.arena }]}>
        <View style={styles.seats}>
          <Seat name={me.name} detail={p.rating} total={p.totals?.[0]}>
            {p.me ? (
              <Avatar avatar={me.avatar} address={p.me} size={PORTRAIT} />
            ) : (
              <View style={[styles.empty, { backgroundColor: color.raised2 }]}>
                <User size={SILHOUETTE} color={color.ink} />
              </View>
            )}
          </Seat>
          <View style={styles.middle}>
            <Animated.Text
              key={p.matchKey ?? "stage"}
              entering={ZoomIn.springify().damping(VS_SPRING.damping).stiffness(VS_SPRING.stiffness)}
              style={[styles.vs, { color: color.accent }]}
            >
              VS
            </Animated.Text>
          </View>
          {p.opponent.kind === "person" ? (
            <Seat name={them.name} detail="Opponent" total={p.totals?.[1]}>
              <Animated.View entering={ZoomIn.duration(ARRIVE_MS)}>
                <Avatar avatar={them.avatar} address={p.opponent.address} size={PORTRAIT} />
              </Animated.View>
            </Seat>
          ) : (
            <Seat
              name={p.opponent.kind === "searching" ? p.opponent.line : "Opponent seat"}
              detail={p.opponent.kind === "searching" ? p.opponent.detail : "Waiting for you"}
            >
              <View style={styles.portrait}>
                {p.opponent.kind === "searching"
                  ? Array.from({ length: RINGS }, (_, i) => <Ring key={i} index={i} />)
                  : null}
                <View style={[styles.empty, { backgroundColor: color.raised2 }]}>
                  <User size={SILHOUETTE} color={color.inkMuted} />
                </View>
              </View>
            </Seat>
          )}
        </View>
        <View style={styles.potRow} accessibilityLabel={`On the line: ${p.pot}`}>
          <View style={[styles.line, { backgroundColor: color.accent }]} />
          <Text style={[TYPE.chipLabel, { color: color.ink }]}>{p.pot}</Text>
          <View style={[styles.line, { backgroundColor: color.accent }]} />
        </View>
        {p.children}
      </View>
    </Heartbeat>
  );
}

function Seat(p: { name: string; detail: string; total?: SeatTotal | undefined; children: ReactNode }) {
  const { color } = useTheme();
  const t = p.total;
  const tone =
    !t || t.total === null ? color.inkMuted : t.total > 0n ? color.up : t.total < 0n ? color.down : color.ink;
  return (
    <View style={styles.seat}>
      {p.children}
      <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
        {p.name}
      </Text>
      <Text numberOfLines={1} style={[TYPE.caption, { color: color.inkMuted }]}>
        {p.detail}
      </Text>
      {t ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.numMd, { color: tone }]}>
          {t.total === null ? "—" : `${signedUsd(t.total)}${t.provisional ? " so far" : ""}`}
        </Text>
      ) : null}
    </View>
  );
}

/** One ring of the search: out from the empty seat and gone over a breath, staggered by its place. */
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

/** The stage beats once a second through the last ten before picks close (`beat` is the seconds left, or null). */
function Heartbeat({ beat, children }: { beat: number | null; children: ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (beat === null) return;
    scale.value = withSequence(
      withTiming(BEAT_SCALE, { duration: BEAT_IN_MS }),
      withTiming(1, { duration: BEAT_OUT_MS }),
    );
  }, [beat, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  stage: { minHeight: STAGE_H, borderRadius: RADIUS.lg, padding: SPACE.md, gap: SPACE.sm, overflow: "hidden" },
  seats: { flexDirection: "row", alignItems: "flex-start" },
  seat: { flex: 1, alignItems: "center", gap: SPACE.xxs },
  middle: { justifyContent: "center", height: PORTRAIT, paddingHorizontal: SPACE.sm },
  vs: { fontFamily: FONT.display, fontSize: VS_SIZE, lineHeight: VS_SIZE },
  portrait: { width: PORTRAIT, height: PORTRAIT, alignItems: "center", justifyContent: "center" },
  empty: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: PORTRAIT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: PORTRAIT / 2,
    borderWidth: RING_STROKE,
  },
  potRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  line: { flex: 1, height: LINE, opacity: 0.5 },
});
