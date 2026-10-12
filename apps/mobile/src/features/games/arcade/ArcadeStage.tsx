/**
 * The arcade's stage on the phone (R7.1, R7.6; Owarine `ArcadeFullScreen.tsx`): a run takes the whole phone, sideways —
 * the stage is turned a quarter turn by a transform (no native orientation change, so it ships by update), and the
 * world's long axis runs down the phone. A "turn your phone" cue rides the 3-2-1-GO. Touch anywhere to crouch, let go to
 * hop; in the air the half you touch leans back or forward. The same runs as the web (`@senryo/arcade`), drawn through
 * Skia. A practice run pauses (the button, Back, or the app leaving); a ranked run can't pause, and leaving ends it
 * unranked. The game-over card: the score, a NEW BEST stamp, the replay check, the run's numbers, Play again, Share,
 * Exit.
 */
import type { ArcadeInk, ArcadeRun, LoopDriver, RunInput } from "@senryo/arcade";
import { Canvas, Picture } from "@shopify/react-native-skia";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { Pause, RotatePhone, Volume, VolumeX, X } from "~/components/kit/symbols";
import { fire, music, soundsEnabled } from "~/feedback/fire";
import { notify } from "~/lib/notify";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { FONT, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { OverCard, Plate, Round, type StageResult } from "./StageParts";
import { useAppActive, useArcadeFrames } from "./useArcadeFrames";

type Phase = "loading" | "countdown" | "playing" | "paused" | "over";

const COUNT_MS = 600;
const COUNT_FROM = 3;
const OVER_DELAY_MS = 900;
const HUD_MS = 100;
const HINT_MS = 5_000;
const QUARTER_TURN = "90deg";
const SCORE_SIZE = 40;
const COUNT_SIZE = 120;
const COMBO_SIZE = 24;

export interface PhoneStageProps {
  title: string;
  hint: string;
  best: number | null;
  signedIn: boolean;
  ink: ArcadeInk;
  prepare: () => Promise<ArcadeRun>;
  submit: (run: ArcadeRun) => Promise<{ note: string }>;
  share: (score: number) => void;
  onFinished: (score: number) => void;
  onSignIn: () => void;
  onClose: () => void;
}

export function ArcadeStage(props: PhoneStageProps) {
  const { title, hint, best, signedIn, prepare, submit, share, onFinished, onSignIn, onClose } = props;
  const { color } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const run = useRef<ArcadeRun | null>(null);
  const driver = useRef<LoopDriver | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [count, setCount] = useState(COUNT_FROM);
  const [hud, setHud] = useState({ score: 0, combo: 1, line: "" });
  const [result, setResult] = useState<StageResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [hinting, setHinting] = useState(true);
  const [sound, setSound] = useState(soundsEnabled());
  const active = useAppActive();
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const finish = useCallback(
    async (r: ArcadeRun, left: boolean) => {
      setPhase("over");
      const score = r.score();
      const isBest = !left && best !== null && score > best;
      const card = (note: string | null): StageResult => ({ score, isBest, note, stats: r.stats() });
      onFinished(score);
      if (isBest) fire("win", { cue: "win" });
      if (left) return setResult(card("You left the game, so this run isn't ranked."));
      if (!r.ranked) return setResult(card(signedIn ? "A practice run · not ranked" : null));
      setChecking(true);
      setResult(card(null));
      try {
        setResult(card((await submit(r)).note));
      } catch (error) {
        setResult(card("That run wasn't ranked."));
        notify({ title: "That run wasn't ranked", description: (error as Error).message, tone: "warning" });
      } finally {
        setChecking(false);
      }
    },
    [best, signedIn, submit, onFinished],
  );
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // Make the run, then count it in. `attempt` restarts it (Play again).
  useEffect(() => {
    let alive = true;
    setPhase("loading");
    setResult(null);
    setHinting(true);
    prepare().then(
      (r) => {
        if (!alive) return;
        run.current = r;
        let overSeen = false;
        let lastHud = 0;
        driver.current = {
          step: () => {
            const p = phaseRef.current;
            if (p !== "playing" && !(p === "over" && r.isOver())) return;
            r.step();
            if (r.isOver() && !overSeen) {
              overSeen = true;
              setTimeout(() => void finishRef.current(r, false), OVER_DELAY_MS);
            }
          },
          draw: (view, alpha, now) => {
            r.draw(view, alpha, now);
            if (now - lastHud < HUD_MS) return;
            lastHud = now;
            const h = r.hud();
            setHud({ score: h.score, combo: h.combo ?? 1, line: h.line ?? "" });
          },
        };
        setRunKey((k) => k + 1);
        setCount(COUNT_FROM);
        setPhase("countdown");
      },
      (error: Error) => {
        if (!alive) return;
        notify({ title: "The game can't start right now", description: error.message, tone: "warning" });
        onClose();
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      fire("tick", { cue: "countGo" });
      music("games");
      const t = setTimeout(() => setPhase("playing"), COUNT_MS);
      return () => clearTimeout(t);
    }
    fire("tick", { cue: "countBeep" });
    const t = setTimeout(() => setCount((n) => n - 1), COUNT_MS);
    return () => clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    if (phase !== "playing") return;
    const t = setTimeout(() => setHinting(false), HINT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // The app leaving: a practice run pauses, a ranked one ends.
  useEffect(() => {
    const r = run.current;
    if (active || phase !== "playing" || !r || r.isOver()) return;
    if (r.ranked) void finish(r, true);
    else setPhase("paused");
  }, [active, phase, finish]);

  const picture = useArcadeFrames(driver, runKey, { w: long, h: short }, phase !== "loading" && phase !== "paused");

  // Touch: any finger holds; the last one down picks the lean by its half of the (turned) stage.
  const touches = useRef(new Map<string, -1 | 1>());
  const push = useCallback(() => {
    const r = run.current;
    if (!r) return;
    const sides = [...touches.current.values()];
    const next: RunInput =
      phaseRef.current === "playing" ? { hold: sides.length > 0, lean: sides.at(-1) ?? 0 } : { hold: false, lean: 0 };
    r.input(next);
  }, []);
  const onTouch = (e: GestureResponderEvent, down: boolean) => {
    for (const t of e.nativeEvent.changedTouches) {
      if (down) touches.current.set(t.identifier, t.locationX < long / 2 ? -1 : 1);
      else touches.current.delete(t.identifier);
    }
    push();
  };
  useEffect(() => {
    if (phase !== "playing") touches.current.clear();
    push();
  }, [phase, push]);

  // Leaving the stage stops the music.
  useEffect(() => () => music(null), []);

  const toggleSound = () => {
    const next = !sound;
    storage.set(STORAGE_KEYS.sounds, next);
    setSound(next);
    fire("tick", { cue: "toggle" });
  };
  const exit = () => {
    fire("tick", { cue: "tap" });
    onClose();
  };
  const canPause = phase === "playing" && run.current?.ranked === false;
  const ink = { color: props.ink.ink };
  const dim = { color: props.ink.ink, opacity: 0.6 };
  const pad = { paddingLeft: insets.top + SPACE.lg, paddingRight: insets.bottom + SPACE.lg };

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={["portrait"]}
      onRequestClose={() => (canPause ? setPhase("paused") : exit())}
    >
      <StatusBar hidden />
      <View style={[styles.root, { backgroundColor: props.ink.arena }]}>
        <View style={[styles.stage, { width: long, height: short, left: (short - long) / 2, top: (long - short) / 2 }]}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Picture picture={picture} />
          </Canvas>
          <View
            style={StyleSheet.absoluteFill}
            onTouchStart={(e) => onTouch(e, true)}
            onTouchEnd={(e) => onTouch(e, false)}
            onTouchCancel={(e) => onTouch(e, false)}
            accessible
            accessibilityLabel={`${title} · ${hint}`}
          />
          <View pointerEvents="box-none" style={[styles.top, pad]}>
            <View pointerEvents="none">
              <Text style={[styles.score, ink]}>{hud.score.toLocaleString()}</Text>
              {best !== null ? <Text style={[TYPE.caption, dim]}>Best {best.toLocaleString()}</Text> : null}
            </View>
            {hud.combo > 1 ? (
              <Animated.Text key={hud.combo} entering={ZoomIn} style={[styles.combo, { color: props.ink.accent }]}>
                ×{hud.combo}
              </Animated.Text>
            ) : null}
            <View style={styles.buttons}>
              <Round label={sound ? "Mute" : "Sound on"} onPress={toggleSound} bg={color.arenaRaised}>
                {sound ? (
                  <Volume size={SIZE.iconSm} color={props.ink.ink} />
                ) : (
                  <VolumeX size={SIZE.iconSm} color={props.ink.ink} />
                )}
              </Round>
              {canPause ? (
                <Round label="Pause" onPress={() => setPhase("paused")} bg={color.arenaRaised}>
                  <Pause size={SIZE.iconSm} color={props.ink.ink} />
                </Round>
              ) : null}
              <Round label="Exit the game" onPress={exit} bg={color.arenaRaised}>
                <X size={SIZE.iconSm} color={props.ink.ink} />
              </Round>
            </View>
          </View>
          <View pointerEvents="none" style={[styles.bottom, pad]}>
            {phase === "playing" && hinting ? <Text style={[TYPE.body, ink]}>{hint}</Text> : null}
            <Text style={[TYPE.caption, dim]}>
              {hud.line}
              {run.current ? (run.current.ranked ? " · Ranked run" : " · Practice run") : ""}
            </Text>
          </View>
          {phase === "countdown" ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
              <View style={styles.turn}>
                <RotatePhone size={SIZE.icon} color={props.ink.ink} />
                <Text style={[TYPE.body, ink]}>Turn your phone sideways</Text>
              </View>
              <Animated.Text
                key={count}
                entering={ZoomIn}
                style={[styles.count, { color: count === 0 ? props.ink.up : props.ink.ink }]}
              >
                {count === 0 ? "GO" : count}
              </Animated.Text>
            </View>
          ) : null}
          {phase === "paused" ? (
            <Plate bg={color.arenaRaised} scrim={color.scrim}>
              <Text style={[TYPE.sectionTitle, ink]}>Paused</Text>
              <Button label="Resume" onPress={() => setPhase("playing")} />
              <Button label="Exit" variant="ghost" onPress={exit} />
            </Plate>
          ) : null}
          {phase === "over" && result ? (
            <OverCard
              title={title}
              result={result}
              checking={checking}
              signedIn={signedIn}
              ink={props.ink}
              onAgain={() => setAttempt((n) => n + 1)}
              onShare={() => share(result.score)}
              onExit={exit}
              onSignIn={onSignIn}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { position: "absolute", transform: [{ rotate: QUARTER_TURN }] },
  top: {
    position: "absolute",
    top: SPACE.md,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  bottom: { position: "absolute", bottom: SPACE.md, left: 0, right: 0, gap: SPACE.xxs },
  buttons: { flexDirection: "row", gap: SPACE.sm },
  score: { fontFamily: FONT.display, fontSize: SCORE_SIZE, lineHeight: SCORE_SIZE, fontVariant: ["tabular-nums"] },
  combo: { fontFamily: FONT.display, fontSize: COMBO_SIZE, lineHeight: COMBO_SIZE },
  count: { fontFamily: FONT.display, fontSize: COUNT_SIZE, lineHeight: COUNT_SIZE },
  center: { alignItems: "center", justifyContent: "center" },
  turn: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.lg },
});
