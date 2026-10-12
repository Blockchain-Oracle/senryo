/**
 * A game playing itself on the phone (R7.6–R7.7): an arcade game's attract loop on a real tape — the same engine and
 * drawing as a run, steered by the run's autopilot, silent — as a Skia picture for any window (the game's page, the
 * hub's card). One tape per mount; it plays while `running` and the app is in front.
 */
import {
  type ArcadeInk,
  type ArcadeRun,
  createAttract,
  createFlapRun,
  createSledRun,
  type LoopDriver,
  SILENT,
} from "@senryo/arcade";
import { type ArcadeGame, seedFromBytes } from "@senryo/core";
import { useArcadeDesk } from "@senryo/query";
import { useEffect, useRef, useState } from "react";
import { useArcadeFrames } from "./useArcadeFrames";

const SEED_BYTES = 4;
const BYTE = 256;

/** A guest's seed: no money or rank rides on it, so any fresh bytes do. */
export const localSeed = () =>
  seedFromBytes(Uint8Array.from({ length: SEED_BYTES }, () => Math.floor(Math.random() * BYTE)));

export function useAttract(
  game: ArcadeGame,
  ink: ArcadeInk,
  calm: boolean,
  box: { w: number; h: number },
  running: boolean,
) {
  const desk = useArcadeDesk(game);
  const driver = useRef<LoopDriver | null>(null);
  const [key, setKey] = useState(0);
  const made = useRef({ ink, calm });
  made.current = { ink, calm };
  useEffect(() => {
    let alive = true;
    desk.tape.mutateAsync().then(
      (tape) => {
        if (!alive) return;
        driver.current = createAttract((): ArcadeRun => {
          const run = { seed: localSeed(), ranked: false, tape, feel: SILENT, ...made.current };
          return game === "candle-hop" ? createFlapRun(run) : createSledRun(run);
        });
        setKey((k) => k + 1);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  return useArcadeFrames(driver, key, box, running);
}
