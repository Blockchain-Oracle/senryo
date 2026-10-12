"use client";
/**
 * The event card's scoreboard (R7.9, research 10 §5): both crests facing each other with their names, the score
 * between them and the game's state — a pulsing LIVE chip while it plays. The card draws each team's colour down its
 * edge (`teamBands`).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BoardSide {
  crest: ReactNode;
  name: string;
  score: number | null;
  /** The team's colour (its edge band and wash); null draws none. */
  color: string | null;
}

export interface ScoreBoard {
  home: BoardSide;
  away: BoardSide;
  /** "LIVE · 2nd 12:41", "Final", or the start ("Mon 18:00"). */
  state: string;
  live: boolean;
}

export function BoardRow({ board }: { board: ScoreBoard }) {
  const scored = board.home.score !== null && board.away.score !== null;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <TeamSide side={board.home} />
      <div className="flex flex-col items-center gap-1">
        <span className="tnum font-display font-semibold text-section-title">
          {scored ? `${board.home.score} – ${board.away.score}` : "vs"}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold text-micro",
            board.live ? "bg-down-surface text-down" : "text-text-3",
          )}
        >
          {board.live ? <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-down" /> : null}
          {board.state}
        </span>
      </div>
      <TeamSide side={board.away} />
    </div>
  );
}

function TeamSide({ side }: { side: BoardSide }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      {side.crest}
      <span className="w-full truncate font-semibold text-meta">{side.name}</span>
    </div>
  );
}

/** A team colour's faint wash behind its half of the card. */
const WASH_ALPHA = "14";
/** The team colour bands down the card's edges (research 10 §5: 6 px). */
const BAND = "0.375rem";

/** The card's background washes and edge bands in the two teams' colours (none without colours). */
export function teamBands(board: ScoreBoard | undefined) {
  if (!board || (!board.home.color && !board.away.color)) return undefined;
  const { home, away } = board;
  return {
    backgroundImage: [
      home.color ? `radial-gradient(70% 60% at 0% 0%, ${home.color}${WASH_ALPHA}, transparent 70%)` : null,
      away.color ? `radial-gradient(70% 60% at 100% 0%, ${away.color}${WASH_ALPHA}, transparent 70%)` : null,
    ]
      .filter(Boolean)
      .join(", "),
    boxShadow: [
      home.color ? `inset ${BAND} 0 0 ${home.color}` : null,
      away.color ? `inset -${BAND} 0 0 ${away.color}` : null,
    ]
      .filter(Boolean)
      .join(", "),
  };
}
