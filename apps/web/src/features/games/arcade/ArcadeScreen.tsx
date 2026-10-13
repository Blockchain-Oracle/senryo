"use client";
/**
 * Line Rider and Candle Hop's page (S8.8, D-295; R7.1–R7.2): the game's own scene with a big Play, its three moves,
 * your best, and the board beside it. Play takes the whole screen (full screen and, on a phone that allows it,
 * landscape) and hands the run to the stage. Signed in, a run starts from the server's seed and the price tape it
 * issued, and ranks once the server's replay reproduces it; a guest plays the same game on a tape of its own. How a
 * score is checked sits behind ⓘ.
 */
import {
  type ArcadeFeel,
  type ArcadeInk,
  type ArcadeRun,
  createFlapRun,
  createSledRun,
  rankNote,
} from "@senryo/arcade";
import { GAMES } from "@senryo/config";
import { type ArcadeGame, seedFromBytes, shortAddress, ticksToMs } from "@senryo/core";
import { useArcadeBoard, useArcadeDesk } from "@senryo/query";
import { Info, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { Avatar } from "@/components/identity/avatar";
import { LoadFailed } from "@/components/kit/load-failed";
import { useAccount } from "@/lib/account/provider";
import { fire, music, sound } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { GameScene } from "../GameScene";
import { ArcadeStage } from "./ArcadeStage";

const SEED_BYTES = 4;
/** A board row's portrait (R2.8): the row's text height. */
const BOARD_AVATAR = 24;
/** The web's feel for a run: Web Audio cues and the vibration table (D-317). */
const FEEL: ArcadeFeel = { fire, sound, music };

export interface ArcadeMove {
  keys: string;
  text: string;
}

/** Full screen on Play (inside the tap, as browsers require), and landscape where a phone lets a page ask. */
function goFullScreen(): void {
  const el = document.documentElement;
  if (!el.requestFullscreen || document.fullscreenElement) return;
  el.requestFullscreen({ navigationUI: "hide" }).then(
    () => {
      const o = screen.orientation as ScreenOrientation & { lock?: (to: string) => Promise<void> };
      void o.lock?.("landscape").catch(() => undefined);
    },
    () => undefined,
  );
}

export function ArcadeScreen({
  game,
  title,
  hint,
  moves,
}: {
  game: ArcadeGame;
  title: string;
  /** The one line the stage shows for its first seconds. */
  hint: string;
  moves: readonly ArcadeMove[];
}) {
  const account = useAccount();
  const me = account.hint?.address?.toLowerCase();
  const signedIn = Boolean(account.hint && account.client);
  const reduce = useReducedMotion() ?? false;
  const desk = useArcadeDesk(game);
  const board = useArcadeBoard(game);
  const [playing, setPlaying] = useState(false);
  const [sessionBest, setSessionBest] = useState<number | null>(null);
  const players = "value" in board ? board.value.players : [];
  const boardBest = players.find((p) => p.owner.toLowerCase() === me)?.score ?? null;
  const best = boardBest === null ? sessionBest : Math.max(boardBest, sessionBest ?? 0);
  const spec = GAMES.find((g) => g.key === game);

  const prepare = useCallback(
    async (ink: ArcadeInk): Promise<ArcadeRun> => {
      let issued: Awaited<ReturnType<typeof desk.seed.mutateAsync>> | null = null;
      if (signedIn) issued = await desk.seed.mutateAsync().catch(() => null);
      // Signed in but no seed: the run plays, unranked, and says so (D6, the phone's own).
      if (signedIn && issued === null)
        notify({ title: "This run won't rank", description: "The board can't be reached." });
      const seed = issued?.seed ?? seedFromBytes(crypto.getRandomValues(new Uint8Array(SEED_BYTES)));
      const ranked = issued !== null;
      const tape = issued?.tape ?? (await desk.tape.mutateAsync());
      const run = { seed, ranked, calm: reduce, tape, ink, feel: FEEL };
      return game === "candle-hop" ? createFlapRun(run) : createSledRun(run);
    },
    [desk.seed, desk.tape, game, reduce, signedIn],
  );

  const submit = useCallback(
    async (run: ArcadeRun) => {
      const checked = await desk.score.mutateAsync({
        seed: run.seed,
        calm: run.calm,
        durationMs: ticksToMs(run.ticks()),
        trace: run.trace(),
        score: run.score(),
      });

      return { best: checked.best, note: rankNote(players, me, checked.best) };
    },
    [desk.score, me, players],
  );

  const share = useCallback(
    (score: number) => {
      const url = `${window.location.origin}${spec?.href ?? ""}`;
      const text = `I scored ${score.toLocaleString()} on ${title} at Senryo. Beat it:`;
      fire("tick", { cue: "tap" });
      if (navigator.share) {
        void navigator.share({ title, text, url }).catch(() => undefined);
        return;
      }
      void navigator.clipboard.writeText(`${text} ${url}`).then(
        () => notify({ title: "Copied", description: "Your score and the link are on the clipboard.", tone: "info" }),
        () => undefined,
      );
    },
    [spec?.href, title],
  );

  const onFinished = useCallback((score: number) => {
    setSessionBest((b) => (b === null ? score : Math.max(b, score)));
  }, []);

  const play = () => {
    fire("press", { cue: "tap" });
    goFullScreen();
    setPlaying(true);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-label={title} className="flex flex-col gap-5">
        <div className="relative">
          <GameScene game={game} />
          <button
            type="button"
            onClick={play}
            className="press-lift absolute inset-0 m-auto flex h-16 w-fit items-center gap-3 rounded-2xl border-b-4 border-up-fill-edge bg-up-fill px-8 font-semibold text-on-direction-fill text-section-title shadow-lg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Play aria-hidden className="size-6 fill-current" />
            Play
          </button>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {moves.map((m) => (
            <li key={m.keys} className="flex flex-col gap-1 rounded-2xl bg-card p-4">
              <span className="font-semibold text-row-title">{m.keys}</span>
              <span className="text-body text-text-2">{m.text}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-body text-text-2">
            {best === null ? "No best yet · your first run sets it" : `Your best ${best.toLocaleString()}`}
          </span>
          <details className="group text-meta text-text-3">
            <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-text-2">
              <Info aria-hidden className="size-4" /> How scores are checked
            </summary>
            <p className="mt-2 max-w-md">
              Signed in, every run starts from a seed the server issued and is replayed on the server, tick by tick,
              before it ranks — checked, not on chain, and no money rides on it.
              {reduce ? " Reduced motion plays the calmer ramp, and the board marks those runs." : ""}
            </p>
          </details>
        </div>
      </section>
      <section aria-label="Board" className="flex flex-col gap-2 lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-semibold text-section-title">Board</h2>
        {board.status === "failed" ? (
          <LoadFailed text="The board can't be read right now" />
        ) : players.length === 0 ? (
          <p className="text-body text-text-2">
            {board.status === "unknown" ? "Reading the board…" : "No ranked runs yet. Be the first."}
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {players.map((p, i) => (
              <li key={p.owner} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-row-title">
                  <span className="tnum w-5 shrink-0 text-text-3">{i + 1}</span>
                  <Avatar avatar={p.avatar} address={p.owner} size={BOARD_AVATAR} />
                  <span className="truncate">
                    {p.handle ? `@${p.handle}` : shortAddress(p.owner)}
                    {p.owner.toLowerCase() === me ? " · you" : ""}
                    {p.calm ? " · calm" : ""}
                  </span>
                </span>
                <span className="tnum font-semibold text-row-title">{p.score.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {playing ? (
        <ArcadeStage
          game={game}
          title={title}
          hint={hint}
          best={best}
          signedIn={signedIn}
          prepare={prepare}
          submit={submit}
          share={share}
          onFinished={onFinished}
          onClose={() => setPlaying(false)}
        />
      ) : null}
    </div>
  );
}
