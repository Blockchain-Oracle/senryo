/**
 * The phone stage's plates (R7.1, R7.6; the web's `StageParts`): the round 44-point controls, the plate over the run
 * (pause, game over) and the game-over card — the score, a NEW BEST stamp, the replay check, the run's numbers, Play
 * again, Share, Exit, and Sign in for a guest. In the arena's ink.
 */
import type { ArcadeInk, RunStat } from "@senryo/arcade";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { Share2 } from "~/components/kit/symbols";
import { FONT, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const PLATE_MIN = 320;
const PLATE_MAX = 440;
const PRESSED_SCALE = 0.96;
const STAMP_DELAY_MS = 200;
const SCORE_SIZE = 40;
const DIM = 0.6;

export interface StageResult {
  score: number;
  isBest: boolean;
  note: string | null;
  stats: RunStat[];
}

export function Round({
  label,
  onPress,
  bg,
  children,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={SPACE.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { backgroundColor: bg }, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function Plate({ bg, scrim, children }: { bg: string; scrim: string; children: ReactNode }) {
  return (
    <Animated.View entering={FadeIn} style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: scrim }]}>
      <Animated.View entering={ZoomIn} style={[styles.plate, { backgroundColor: bg }]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

export function OverCard(p: {
  title: string;
  result: StageResult;
  checking: boolean;
  signedIn: boolean;
  ink: ArcadeInk;
  onAgain: () => void;
  onShare: () => void;
  onExit: () => void;
  onSignIn: () => void;
}) {
  const { color } = useTheme();
  const ink = { color: p.ink.ink };
  const dim = { color: p.ink.ink, opacity: DIM };
  return (
    <Plate bg={color.arenaRaised} scrim={color.scrim}>
      <Text style={[TYPE.caption, dim]}>{p.title.toUpperCase()}</Text>
      <Text style={[styles.score, ink]}>{p.result.score.toLocaleString()}</Text>
      {p.result.isBest ? (
        <Animated.Text entering={ZoomIn.delay(STAMP_DELAY_MS)} style={[TYPE.sectionTitle, { color: p.ink.up }]}>
          NEW BEST
        </Animated.Text>
      ) : null}
      <Text style={[TYPE.caption, dim]}>{p.checking ? "Checking the run by replay…" : p.result.note}</Text>
      <View style={styles.stats}>
        {p.result.stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={[TYPE.caption, dim]}>{s.label}</Text>
            <Text style={[TYPE.rowTitle, ink]}>{s.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button label="Play again" block={false} onPress={p.onAgain} />
        <Button
          label="Share"
          variant="secondary"
          block={false}
          leading={<Share2 size={SIZE.iconSm} color={color.ink} />}
          onPress={p.onShare}
        />
        <Button label="Exit" variant="ghost" block={false} onPress={p.onExit} />
      </View>
      {p.signedIn ? null : <Button label="Sign in to rank your runs" variant="ghost" onPress={p.onSignIn} />}
    </Plate>
  );
}

const styles = StyleSheet.create({
  round: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ scale: PRESSED_SCALE }] },
  center: { alignItems: "center", justifyContent: "center" },
  plate: {
    minWidth: PLATE_MIN,
    maxWidth: PLATE_MAX,
    padding: SPACE.xl,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    gap: SPACE.sm,
  },
  score: { fontFamily: FONT.display, fontSize: SCORE_SIZE, lineHeight: SCORE_SIZE, fontVariant: ["tabular-nums"] },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: SPACE.lg },
  stat: { alignItems: "center" },
  actions: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.sm },
});
