/**
 * Duel's sound and feel (R7.8, research 10 §4, §7): the match chord and a firm haptic the moment someone takes the
 * other seat; the Duel pulse under the match while it's live; a heartbeat each second of the last 10 before picks
 * close; the result's verdict — a win's jackpot and confetti, a loss's fall, a tie's refund — once, when it settles.
 * Both apps: each passes its own feel (the web's Web Audio and vibration, the phone's WAVs and haptics).
 */
import { useServerSeconds } from "@senryo/live/react";
import type { SongName, SoundCue } from "@senryo/tokens";
import { useEffect, useRef } from "react";
import { type DuelPhase, outcomeText } from "./duel.ts";
import type { DuelFlow } from "./use-duel.ts";

export interface DuelFeel {
  fire(event: "impact" | "tick" | "win" | "confirm" | "loss", options?: { cue?: SoundCue }): void;
  music(song: SongName | null): void;
  celebrate(): void;
}

const HEARTBEAT_FROM_SEC = 10;
const LIVE: ReadonlySet<DuelPhase> = new Set(["opening", "picking", "waiting", "settling"]);

export function useDuelMoments(flow: DuelFlow, feel: DuelFeel): void {
  const { fire, music, celebrate } = feel;
  const now = useServerSeconds();
  const was = useRef<DuelPhase>(flow.phase);
  const settled = useRef<string | null>(null);
  const m = flow.match;

  // Matched: from the queue straight into a deal.
  useEffect(() => {
    if (was.current === "queued" && flow.phase !== "queued" && flow.phase !== "idle") {
      fire("impact", { cue: "matchFound" });
    }
    was.current = flow.phase;
  }, [flow.phase]);

  // The Duel pulse while the match is live; silence once it's over or left.
  useEffect(() => {
    music(LIVE.has(flow.phase) ? "duel" : null);
  }, [flow.phase]);
  useEffect(() => () => music(null), []);

  // The heartbeat: a beat each second of the last ten before picks close.
  const left = m?.pickDeadline ? m.pickDeadline - now : null;
  useEffect(() => {
    if (flow.phase !== "picking" || left === null || left > HEARTBEAT_FROM_SEC || left <= 0) return;
    fire("tick", { cue: "countBeep" });
  }, [flow.phase, left]);

  // The verdict, once per match.
  useEffect(() => {
    if (m?.state !== "finalized" || settled.current === m.matchId) return;
    settled.current = m.matchId;
    const title = outcomeText(m, flow.owner).title;
    if (title.startsWith("You won")) {
      fire("win", { cue: "jackpot" });
      celebrate();
    } else if (title.startsWith("A tie")) {
      fire("confirm", { cue: "refund" });
    } else {
      fire("loss", { cue: "loss" });
    }
  }, [m, flow.owner, fire, celebrate]);
}
