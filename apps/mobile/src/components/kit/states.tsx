import type { Diagnosis, Reading } from "@senryo/core";
import { type ReactNode, useEffect, useState } from "react";
import { type DimensionValue, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { ELAPSED_TICK_MS, MS_PER_SECOND } from "~/lib/constants/time";
import { DIAGNOSIS_COPY, ERROR_COPY } from "~/lib/copy/diagnosis";
import { clockTime } from "~/lib/format";
import { HAIRLINE_PX, RADIUS, SIZE, SKELETON, SPACE, TYPE, useTheme } from "~/theme";
import { Button } from "./Button";

/**
 * The states kit (ported): a skeleton only where nothing was ever known, never an invented number; every empty panel
 * says why and names the next action; every error says what still works.
 */
export function Skeleton({ width = "100%", height = SIZE.skeletonLine }: { width?: DimensionValue; height?: number }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue<number>(SKELETON.from);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(SKELETON.to, { duration: SKELETON.periodMs }), -1, true);
  }, [reduce, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ width, height, borderRadius: RADIUS.sm, backgroundColor: color.muted }, style]} />;
}

export type LoadingShape = "line" | "row" | "list" | "plate" | "chart";
const LIST_ROWS = [0, 1, 2] as const;

function useElapsed(): string {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return `${((now - start) / MS_PER_SECOND).toFixed(1)}s`;
}

/** D2's terminal loader (21st Loading State #23591): what is syncing, from where, and for how long. */
export function LoadingState({ shape = "row", label = "Loading" }: { shape?: LoadingShape; label?: string }) {
  const { color } = useTheme();
  const elapsed = useElapsed();
  const row = (key: number) => (
    <View key={key} style={styles.row}>
      <Skeleton width="50%" />
      <Skeleton width="20%" />
      <Skeleton width="22%" />
    </View>
  );
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={[styles.loading, { borderColor: color.hairline }]}
    >
      <View style={styles.loadingHead}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{label}</Text>
        <Text style={[TYPE.numSm, { color: color.inkMuted }]}>{elapsed}</Text>
      </View>
      {shape === "line" ? <Skeleton width="66%" /> : null}
      {shape === "row" ? row(0) : null}
      {shape === "list" ? LIST_ROWS.map(row) : null}
      {shape === "plate" ? <Skeleton height={SIZE.skeletonPlate} /> : null}
      {shape === "chart" ? <Skeleton height={SIZE.chartEquity} /> : null}
    </View>
  );
}

/** Says why it is empty and names the next action — never a blank panel. */
export function EmptyState({
  why,
  detail,
  action,
}: {
  why: string;
  detail?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { color } = useTheme();
  return (
    <View style={[styles.panel, styles.dashed, { borderColor: color.hairline, backgroundColor: color.card }]}>
      <Text style={[TYPE.title, styles.center, { color: color.ink }]}>{why}</Text>
      {detail ? <Text style={[TYPE.body, styles.center, { color: color.inkMuted }]}>{detail}</Text> : null}
      {action ? (
        <Button label={action.label} onPress={action.onPress} variant="outline" size="sm" block={false} />
      ) : null}
    </View>
  );
}

/** The diagnosis in human words, a retry where one can help, the technical line on request. */
export function ErrorState({ diagnosis, retry }: { diagnosis: Diagnosis; retry?: () => void }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const copy = DIAGNOSIS_COPY[diagnosis.kind];
  const offerRetry = retry !== undefined && diagnosis.kind !== "not-deployed";
  return (
    <View
      accessibilityRole="alert"
      style={[styles.panel, { backgroundColor: color.destructiveWash, borderColor: color.destructive }]}
    >
      <Text style={[TYPE.title, styles.center, { color: color.ink }]}>{copy.headline}</Text>
      <Text style={[TYPE.body, styles.center, { color: color.inkMuted }]}>{copy.body}</Text>
      {offerRetry ? (
        <Button label={ERROR_COPY.retry} onPress={retry} variant="outline" size="sm" block={false} />
      ) : null}
      {diagnosis.technical ? (
        <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" hitSlop={SPACE.sm}>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {open ? "▾" : "▸"} {ERROR_COPY.technical}
          </Text>
        </Pressable>
      ) : null}
      {open ? (
        <Text selectable style={[TYPE.numSm, { color: color.inkMuted }]}>
          {diagnosis.kind} · {diagnosis.technical}
        </Text>
      ) : null}
    </View>
  );
}

/** "Updated 14:02 · refreshing" — polite live region, so VoiceOver hears the change without being interrupted. */
export function StaleStamp({ at, refreshing, failed }: { at: number; refreshing: boolean; failed: boolean }) {
  const { color } = useTheme();
  const tail = failed ? ERROR_COPY.staleFailed : refreshing ? "refreshing" : "stale";
  return (
    <Text accessibilityLiveRegion="polite" style={[TYPE.caption, { color: failed ? color.warn : color.inkMuted }]}>
      Updated {clockTime(at)} · {tail}
    </Text>
  );
}

/** Renders a Reading honestly: skeleton → value (with a stale stamp) → error only when nothing was ever known. */
export function ReadingView<T>({
  reading,
  loading = "row",
  loadingLabel,
  retry,
  children,
}: {
  reading: Reading<T>;
  loading?: LoadingShape;
  loadingLabel?: string;
  retry?: () => void;
  children: (value: T) => ReactNode;
}) {
  switch (reading.status) {
    case "unknown":
      return <LoadingState shape={loading} {...(loadingLabel ? { label: loadingLabel } : {})} />;
    case "failed":
      return <ErrorState diagnosis={reading.error} {...(retry ? { retry } : {})} />;
    // fresh and stale share one tree: the stamp slot is null when fresh, so children keep their position and state
    // across a fresh↔stale change (a moving child remounted the whole Ticket — the phone "keeps refreshing" bug, S8.16a).
    case "stale":
    case "fresh":
      return (
        <>
          {reading.status === "stale" ? (
            <StaleStamp at={reading.at} refreshing={reading.refreshing} failed={reading.error !== undefined} />
          ) : null}
          {children(reading.value)}
        </>
      );
  }
}

const styles = StyleSheet.create({
  loading: { gap: SPACE.sm, padding: SPACE.md, borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm },
  loadingHead: { flexDirection: "row", justifyContent: "space-between" },
  row: { flexDirection: "row", gap: SPACE.sm },
  panel: {
    borderRadius: RADIUS.sm,
    borderWidth: HAIRLINE_PX,
    padding: SPACE.xl,
    gap: SPACE.md,
    alignItems: "center",
  },
  dashed: { borderStyle: "dashed" },
  center: { textAlign: "center" },
});
