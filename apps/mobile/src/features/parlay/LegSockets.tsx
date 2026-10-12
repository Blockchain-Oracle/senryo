/**
 * The chain (P3, D-326; Codex's "Parlay builds a chain"): four leg sockets joined by a line — empty ones wait, a picked
 * one holds the market's mark with its direction and lane. A link lights once both its ends are filled. A leg arriving
 * settles into its socket on a spring after the mark's flight (`FlyLayer`); tapping a filled socket opens the slip.
 * The sockets register their views so the flight knows where to land.
 */
import type { ParlayPick } from "@senryo/calls";
import { PARLAY } from "@senryo/config";
import { lane, sideName } from "@senryo/core";
import { marketId } from "@senryo/identity";
import type { RefObject } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { ArrowDown, ArrowUp } from "~/components/kit/symbols";
import { SPACE, TYPE, useTheme } from "~/theme";
import { SLOT_CENTRE_PERCENT } from "./constants";

export const SOCKET = 56;
export const SOCKET_MARK = 40;
const BADGE = 20;
const BADGE_ICON = 12;
const LINK = 2;
/** The mark's flight into its socket (`FlyLayer`); the socket's spring starts as it lands. */
export const FLY_MS = 320;

export function LegSockets({
  picks,
  socketRefs,
  onOpen,
}: {
  picks: readonly ParlayPick[];
  socketRefs: RefObject<(View | null)[]>;
  onOpen: () => void;
}) {
  const { color } = useTheme();
  const slots = Array.from({ length: PARLAY.maxLegs }, (_, i) => picks[i]);
  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="summary" accessibilityLabel={chainLabel(picks)}>
        {/* The links, behind the sockets: from each socket's centre to the next's. */}
        <View pointerEvents="none" style={styles.links}>
          {slots.slice(1).map((p, i) => (
            <View key={i} style={[styles.link, { backgroundColor: p && slots[i] ? color.ink : color.raised2 }]} />
          ))}
        </View>
        {slots.map((p, i) => (
          <View key={i} style={styles.slot}>
            <Pressable
              ref={(v) => {
                if (socketRefs.current) socketRefs.current[i] = v;
              }}
              disabled={!p}
              onPress={onOpen}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.socket, { backgroundColor: p ? color.card : color.raised2 }]}
            >
              {p ? (
                <Animated.View key={`${p.symbol}:${p.band}`} entering={ZoomIn.delay(FLY_MS).springify()}>
                  <EntityMark id={marketId(p.symbol)} size={SOCKET_MARK} decorative />
                  <View style={[styles.badge, { backgroundColor: p.band === 0 ? color.up : color.down }]}>
                    {p.band === 0 ? (
                      <ArrowUp size={BADGE_ICON} color={color.ground} strokeWidth={2.5} />
                    ) : (
                      <ArrowDown size={BADGE_ICON} color={color.ground} strokeWidth={2.5} />
                    )}
                  </View>
                </Animated.View>
              ) : (
                <Text style={[TYPE.chipLabel, { color: color.inkMuted }]}>{i + 1}</Text>
              )}
            </Pressable>
            <Text style={[TYPE.micro, styles.caption, { color: p ? color.ink : color.inkMuted }]}>
              {p ? `${p.symbol} · ${lane(p.cadenceSec)}` : i < PARLAY.minLegs ? "Leg" : "Optional"}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>
        Pick {PARLAY.minLegs}–{PARLAY.maxLegs} calls. Every leg must come true.
      </Text>
    </View>
  );
}

function chainLabel(picks: readonly ParlayPick[]): string {
  if (picks.length === 0) return `No legs yet. Pick ${PARLAY.minLegs} to ${PARLAY.maxLegs} calls.`;
  const legs = picks.map((p) => `${p.symbol} ${sideName(p.band)} ${lane(p.cadenceSec)}`).join(", ");
  return `${picks.length} of ${PARLAY.maxLegs} legs: ${legs}`;
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  row: { flexDirection: "row", justifyContent: "space-between" },
  slot: { flex: 1, alignItems: "center", gap: SPACE.xs },
  links: {
    position: "absolute",
    top: SOCKET / 2 - LINK / 2,
    left: `${SLOT_CENTRE_PERCENT / PARLAY.maxLegs}%`,
    right: `${SLOT_CENTRE_PERCENT / PARLAY.maxLegs}%`,
    flexDirection: "row",
  },
  link: { flex: 1, height: LINK },
  socket: {
    width: SOCKET,
    height: SOCKET,
    borderRadius: SOCKET / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -SPACE.xs,
    bottom: -SPACE.xs,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: { textAlign: "center" },
  center: { textAlign: "center" },
});
