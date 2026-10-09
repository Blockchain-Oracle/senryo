"use client";
/**
 * The crowd on this window (the phone's `CrowdLine`): how the stake on it splits between Up and Down, from the
 * indexer's window row (refreshed while open). Quiet until someone has called; the split is stake, not heads.
 */
import { useWindowProof } from "@senryo/query";
import type { CSSProperties } from "react";

const PERCENT = 100n;
const UP = 0;
const DOWN = 1;
const WHOLE = 100;

export function CrowdLine({ windowId }: { windowId: `0x${string}` }) {
  const proof = useWindowProof(windowId, { live: true });
  if (!("value" in proof)) return null;
  const p = proof.value;
  const up = p.bandStake[UP] ?? 0n;
  const down = p.bandStake[DOWN] ?? 0n;
  const total = up + down;
  if (total === 0n) return null;
  const upPct = Number((up * PERCENT) / total);
  const text = `Crowd · Up ${upPct}% · Down ${WHOLE - upPct}% · ${p.calls} ${p.calls === 1 ? "call" : "calls"}`;
  return (
    <div className="terminal-crowd" role="img" aria-label={text}>
      <span className="terminal-crowd-bar" style={{ "--crowd-up": `${upPct}%` } as CSSProperties} />
      <span aria-hidden>{text}</span>
    </div>
  );
}
