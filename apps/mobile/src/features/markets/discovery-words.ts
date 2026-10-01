/** A discovery gate's on-screen words (review S03): plain language, never the plan's blocker code. */
import type { ExecutionGate } from "@senryo/config";

const BLOCKED: Record<Extract<ExecutionGate, { state: "blocked" }>["blocker"], string> = {
  B2: "Price too jumpy",
  B10: "No practice venue",
};

/** The row's short state: "Read-only", or what blocks it. */
export function gateShort(gate: ExecutionGate | undefined): string {
  if (gate?.state === "blocked") return BLOCKED[gate.blocker];
  return "Read-only";
}

/** The page's gate title. */
export function gateTitle(gate: ExecutionGate | undefined): string {
  if (gate?.state === "blocked") return `Not tradeable here · ${BLOCKED[gate.blocker]}`;
  return "Not tradeable here yet";
}
