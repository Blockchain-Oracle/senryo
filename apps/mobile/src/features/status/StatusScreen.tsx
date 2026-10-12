/**
 * Status as a live evidence board (P6, D-324; Owarine's pulse strip, Canton's status spec, Codex's board): one verdict —
 * Live, Delayed, Unavailable or Unverified — with a tally and when it was checked; then a tile per component, problems
 * first: its state, its numbers now, and a bar per hour (24 h) or day (90 d) whose height is the worst state seen —
 * grey where nothing was recorded, never a pass. Tap a bar to read it. A tile's dot pulses only when a new reading
 * arrives. Prices per source sit under the prices tile. Everything here is the api's own (`/v1/status`, refreshed every
 * 15 s, and `/v1/status/history` every minute).
 */
import type { StatusHistory, StatusRange, StatusResponse } from "@senryo/api-client";
import {
  barLabel,
  barOf,
  boardOrder,
  COMPONENT_NAMES,
  type HealthState,
  metricLine,
  STATE_WORDS,
  uptimeText,
  verdict,
} from "@senryo/calls";
import { FEED_STATES } from "@senryo/config";
import { useStatus, useStatusHistory } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { ReadingView } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const RANGES = [
  { value: "24h", label: "24 h" },
  { value: "90d", label: "90 d" },
] as const;
const STRIP_H = 32;
const BAR_GAP = 2;
const DOT = 8;
const PILL_H = 28;
const MS = 1000;
/** The other bars while one is being read. */
const DIMMED = 0.4;
const BAR_RADIUS = 1;
const SOURCE_NAMES: Readonly<Record<string, string>> = { pyth: "Pyth", redstone: "RedStone", basket: "Baskets" };

function useTone() {
  const { color } = useTheme();
  return (t: HealthState | "none") =>
    t === "down"
      ? color.down
      : t === "degraded"
        ? color.warn
        : t === "ok"
          ? color.up
          : t === "unknown"
            ? color.inkMuted
            : color.raised2;
}

function Board({
  s,
  history,
  range,
  onRange,
}: {
  s: StatusResponse;
  history: StatusHistory | undefined;
  range: StatusRange;
  onRange: (r: StatusRange) => void;
}) {
  const { color } = useTheme();
  const tone = useTone();
  const v = verdict(s.components);
  const ago = Math.max(0, Math.round((Date.now() - Date.parse(s.at)) / MS));
  return (
    <View style={styles.board}>
      <View style={styles.hero} accessibilityLiveRegion="polite">
        <Text
          accessibilityRole="header"
          style={[TYPE.pageTitle, { color: v.tone === "ok" ? color.ink : tone(v.tone) }]}
        >
          {v.word}
        </Text>
        <Text style={[TYPE.body, { color: color.inkMuted }]}>{v.line}</Text>
        <View style={styles.pills}>
          {(["ok", "degraded", "down", "unknown"] as const).map((k) =>
            v.tally[k] > 0 ? (
              <View key={k} style={[styles.pill, { backgroundColor: color.card }]}>
                <View style={[styles.dot, { backgroundColor: tone(k) }]} />
                <Text style={[TYPE.chipLabel, { color: color.ink }]}>
                  {v.tally[k]} {STATE_WORDS[k].toLowerCase()}
                </Text>
              </View>
            ) : null,
          )}
        </View>
        <Text style={[TYPE.meta, { color: color.text3 }]}>Checked {ago} s ago · refreshes every 15 s</Text>
      </View>
      <Segmented options={RANGES} value={range} onChange={(r) => onRange(r as StatusRange)} label="History range" />
      {boardOrder(s.components).map((c) => (
        <Tile key={c.id} c={c} at={s.at} history={history} s={s} />
      ))}
    </View>
  );
}

function Tile({
  c,
  at,
  history,
  s,
}: {
  c: StatusResponse["components"][number];
  at: string;
  history: StatusHistory | undefined;
  s: StatusResponse;
}) {
  const { color } = useTheme();
  const tone = useTone();
  const [picked, setPicked] = useState<number | null>(null);
  const buckets = history?.components.find((h) => h.id === c.id)?.buckets ?? [];
  const uptime = uptimeText(buckets);
  const name = COMPONENT_NAMES[c.id];
  const problem = c.state === "down" || c.state === "degraded";
  return (
    <View
      style={[styles.tile, { backgroundColor: color.card }]}
      accessibilityLabel={`${name.title}: ${STATE_WORDS[c.state]}`}
    >
      <View style={styles.head}>
        <Animated.View key={at} entering={ZoomIn} style={[styles.dot, { backgroundColor: tone(c.state) }]} />
        <Text style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>{name.title}</Text>
        <Text style={[TYPE.rowStrong, { color: c.state === "ok" ? color.ink : tone(c.state) }]}>
          {STATE_WORDS[c.state]}
        </Text>
      </View>
      <Text style={[TYPE.caption, { color: problem ? color.ink : color.inkMuted }]}>{metricLine(c) || name.what}</Text>
      {buckets.length > 0 && history ? (
        <>
          <View style={styles.strip} accessibilityRole="adjustable" accessibilityLabel={`${name.title} history`}>
            {buckets.map((b, i) => {
              const bar = barOf(b);
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    fire("tick");
                    setPicked((p) => (p === i ? null : i));
                  }}
                  style={styles.barSlot}
                  accessibilityLabel={barLabel(history, i, b)}
                >
                  <View
                    style={[
                      styles.bar,
                      {
                        height: STRIP_H * bar.height,
                        backgroundColor: tone(bar.tone),
                        opacity: picked === null || picked === i ? 1 : DIMMED,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
          <Text style={[TYPE.meta, { color: color.text3 }]}>
            {picked !== null
              ? barLabel(history, picked, buckets[picked] ?? null)
              : uptime
                ? `${uptime} working over the range`
                : "Nothing measured yet"}
          </Text>
        </>
      ) : null}
      {c.id === "prices"
        ? s.priceSources.map((p) => (
            <Text key={p.source} style={[TYPE.meta, { color: color.inkMuted }]}>
              {SOURCE_NAMES[p.source] ?? p.source} ·{" "}
              {FEED_STATES.flatMap((k) => (p.counts[k] ? [`${p.counts[k]} ${k}`] : [])).join(" · ") || "no markets"}
            </Text>
          ))
        : null}
    </View>
  );
}

export function StatusScreen() {
  const [range, setRange] = useState<StatusRange>("24h");
  const status = useStatus();
  const history = useStatusHistory(range);
  const queries = useQueryClient();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Status" }} />
      <ReadingView reading={status} retry={() => void queries.invalidateQueries({ queryKey: ["status"] })}>
        {(s) => (
          <Board s={s} history={"value" in history ? history.value : undefined} range={range} onRange={setRange} />
        )}
      </ReadingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  board: { gap: SPACE.md, paddingBottom: SPACE.xl },
  hero: { gap: SPACE.xs, paddingBottom: SPACE.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    height: PILL_H,
    paddingHorizontal: SPACE.sm,
    borderRadius: PILL_H / 2,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  tile: { borderRadius: RADIUS.lg, padding: SPACE.md, gap: SPACE.xs },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  flex: { flex: 1 },
  strip: { flexDirection: "row", alignItems: "flex-end", height: STRIP_H, gap: BAR_GAP, marginTop: SPACE.xs },
  barSlot: { flex: 1, height: STRIP_H, justifyContent: "flex-end" },
  bar: { borderRadius: BAR_RADIUS },
});
