/**
 * Line Rider and Candle Hop on the phone (R7.6; the web's `ArcadeScreen`): the game playing itself in a live window
 * (the attract loop: the same engine and drawing on a real tape, steered by its autopilot), a big Play, the three moves,
 * your best, how a score is checked, and the board. Play opens the full-screen stage. Signed in, a run starts from the
 * server's seed and the tape it issued and ranks once the server's replay reproduces it; a guest plays the same game on
 * a tape of its own.
 */

import type { ArcadeTapeView } from "@senryo/api-client";
import {
  type ArcadeFeel,
  type ArcadeInk,
  type ArcadeRun,
  createFlapRun,
  createSledRun,
  rankNote,
} from "@senryo/arcade";
import { GAMES } from "@senryo/config";
import { type ArcadeGame, shortAddress, ticksToMs } from "@senryo/core";
import { useArcadeBoard, useArcadeDesk } from "@senryo/query";
import { Canvas, Picture } from "@shopify/react-native-skia";
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { type LayoutChangeEvent, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "~/components/identity/Avatar";
import { Info, PlayFill } from "~/components/kit/symbols";
import { playCue } from "~/feedback/cues";
import { fire, music, soundsEnabled } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { type Palette, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { ArcadeStage } from "./ArcadeStage";
import { localSeed, useAttract } from "./useAttract";

const _SEED_BYTES = 4;
const _BYTE = 256;
const ASPECT_W = 16;
const ASPECT_H = 9;
const DEMO_ASPECT = ASPECT_W / ASPECT_H;

/** The phone's feel for a run: the shared cues as WAVs and the haptic table (D-317). */
const FEEL: ArcadeFeel = {
  fire,
  sound: (cue) => {
    if (soundsEnabled()) playCue(cue);
  },
  music,
};

export const inkOf = (c: Palette): ArcadeInk => ({
  arena: c.arena,
  raised: c.arenaRaised,
  ink: c.arenaInk,
  up: c.upFill,
  down: c.downFill,
  range: c.rangeFill,
  accent: c.accent,
});

export interface ArcadeMove {
  keys: string;
  text: string;
}

export function ArcadeScreen({
  game,
  title,
  hint,
  moves,
}: {
  game: ArcadeGame;
  title: string;
  hint: string;
  moves: readonly ArcadeMove[];
}) {
  const { color } = useTheme();
  const ink = inkOf(color);
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const me = account.hint?.address?.toLowerCase();
  const signedIn = Boolean(account.hint && account.client);
  const calm = useReducedMotion();
  const desk = useArcadeDesk(game);
  const board = useArcadeBoard(game);
  const spec = GAMES.find((g) => g.key === game);
  const [playing, setPlaying] = useState(false);
  const [sessionBest, setSessionBest] = useState<number | null>(null);
  const [showProof, setShowProof] = useState(false);
  const players = "value" in board ? board.value.players : [];
  const boardBest = players.find((p) => p.owner.toLowerCase() === me)?.score ?? null;
  const best = boardBest === null ? sessionBest : Math.max(boardBest, sessionBest ?? 0);

  const make = useCallback(
    (o: { seed: string; ranked: boolean; tape: ArcadeTapeView; feel: ArcadeFeel }): ArcadeRun => {
      const run = { ...o, calm, ink };
      return game === "candle-hop" ? createFlapRun(run) : createSledRun(run);
    },
    [game, calm, ink],
  );

  // The live window: the game playing itself while the page is in front and the stage is closed.
  const [focused, setFocused] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const demo = useAttract(game, ink, calm, box, focused && !playing);
  const onDemoLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBox({ w, h: w / DEMO_ASPECT });
  };

  const prepare = useCallback(async () => {
    const issued = signedIn ? await desk.seed.mutateAsync().catch(() => null) : null;
    const tape = issued?.tape ?? (await desk.tape.mutateAsync());
    return make({ seed: issued?.seed ?? localSeed(), ranked: issued !== null, tape, feel: FEEL });
  }, [desk.seed, desk.tape, make, signedIn]);

  const submit = useCallback(
    async (run: ArcadeRun) => {
      const checked = await desk.score.mutateAsync({
        seed: run.seed,
        calm: run.calm,
        durationMs: ticksToMs(run.ticks()),
        trace: run.trace(),
        score: run.score(),
      });

      return { note: rankNote(players, me, checked.best) };
    },
    [desk.score, me, players],
  );

  const share = useCallback(
    (score: number) => {
      fire("tick", { cue: "tap" });
      const url = `https://senryo.xyz${spec?.href ?? ""}`;
      void Share.share({ message: `I scored ${score.toLocaleString()} on ${title} at Senryo. Beat it: ${url}` });
    },
    [spec?.href, title],
  );

  const onFinished = useCallback((score: number) => {
    setSessionBest((b) => (b === null ? score : Math.max(b, score)));
  }, []);

  const play = () => {
    fire("press", { cue: "tap" });
    setPlaying(true);
  };

  return (
    <ScrollView
      style={{ backgroundColor: color.ground }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
    >
      <View style={[styles.demo, { backgroundColor: ink.arena }]} onLayout={onDemoLayout}>
        <Canvas style={{ width: box.w, height: box.h }}>
          <Picture picture={demo} />
        </Canvas>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play ${title}`}
          onPress={play}
          style={({ pressed }) => [
            styles.play,
            { backgroundColor: color.upFill, borderBottomColor: color.upFillEdge },
            pressed && styles.pressed,
          ]}
        >
          <PlayFill size={SIZE.icon} color={color.onDirectionFill} />
          <Text style={[TYPE.sectionTitle, { color: color.onDirectionFill }]}>Play</Text>
        </Pressable>
      </View>
      {moves.map((m) => (
        <View key={m.keys} style={[styles.move, { backgroundColor: color.raised2 }]}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{m.keys}</Text>
          <Text style={[TYPE.body, { color: color.inkMuted }]}>{m.text}</Text>
        </View>
      ))}
      <Text style={[TYPE.body, { color: color.inkMuted }]}>
        {best === null ? "No best yet · your first run sets it" : `Your best ${best.toLocaleString()}`}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => setShowProof((v) => !v)} style={styles.proof}>
        <Info size={SIZE.iconSm} color={color.inkMuted} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>How scores are checked</Text>
      </Pressable>
      {showProof ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          Signed in, every run starts from a seed the server issued and is replayed on the server, tick by tick, before
          it ranks — checked, not on chain, and no money rides on it.
          {calm ? " Reduced motion plays the calmer ramp, and the board marks those runs." : ""}
        </Text>
      ) : null}
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Board
      </Text>
      {board.status === "failed" ? (
        <Text style={[TYPE.body, { color: color.inkMuted }]}>
          The board can't be read right now · it retries on its own
        </Text>
      ) : players.length === 0 ? (
        <Text style={[TYPE.body, { color: color.inkMuted }]}>
          {board.status === "unknown" ? "Reading the board…" : "No ranked runs yet. Be the first."}
        </Text>
      ) : (
        players.map((p, i) => (
          <View key={p.owner} style={[styles.row, { borderBottomColor: color.hairline }]}>
            <Text style={[TYPE.caption, styles.rank, { color: color.inkMuted }]}>{i + 1}</Text>
            <Avatar avatar={p.avatar} address={p.owner} size={SIZE.icon} />
            <Text numberOfLines={1} style={[TYPE.rowTitle, styles.who, { color: color.ink }]}>
              {p.handle ? `@${p.handle}` : shortAddress(p.owner)}
              {p.owner.toLowerCase() === me ? " · you" : ""}
              {p.calm ? " · calm" : ""}
            </Text>
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>{p.score.toLocaleString()}</Text>
          </View>
        ))
      )}
      {playing ? (
        <ArcadeStage
          title={title}
          hint={hint}
          best={best}
          signedIn={signedIn}
          ink={ink}
          prepare={prepare}
          submit={submit}
          share={share}
          onFinished={onFinished}
          onSignIn={() => {
            setPlaying(false);
            router.push(accountRequiredRoute("rank your runs", spec?.route) as Href);
          }}
          onClose={() => setPlaying(false)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.inset, gap: SPACE.md },
  demo: { borderRadius: RADIUS.md, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  play: {
    position: "absolute",
    bottom: SPACE.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.xl,
    height: SIZE.buttonHeight,
    borderRadius: RADIUS.sm,
    borderBottomWidth: 4,
  },
  pressed: { transform: [{ translateY: 2 }] },
  move: { padding: SPACE.lg, borderRadius: RADIUS.md, gap: SPACE.xxs },
  proof: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, minHeight: SIZE.touch },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: SPACE.lgPlus },
  who: { flex: 1 },
});
