/** Relay policy: active positions get every new valid source round; idle markets retain the budgeted cadence. */
const BPS = 10_000n;
/** SeedConstants.sol feed heartbeats; FEED_GRACE matches Constants.sol (source read, not mirror heartbeat). */
const SOURCE_HEARTBEAT = { metal: 3600n, fx: 240n } as const;
const SOURCE_GRACE_SEC = 600n;
export interface MirrorRound {
  answer: bigint;
  updatedAt: bigint;
  roundId: bigint;
}

export function mirrorDecision(input: {
  source: MirrorRound;
  mirror: MirrorRound;
  category: "metal" | "fx";
  nowSec: bigint;
  active: boolean;
  confirming: boolean;
  lastSourceRound: string | undefined;
  heartbeatSec: number;
  deviationBps: number;
  confirmSec: number;
}): "invalid-source" | "active-round" | "heartbeat" | "confirmation" | "deviation" | undefined {
  const { source, mirror, nowSec } = input;
  if (
    source.roundId <= 0n ||
    source.answer <= 0n ||
    source.updatedAt <= 0n ||
    source.updatedAt > nowSec ||
    nowSec - source.updatedAt > SOURCE_HEARTBEAT[input.category] + SOURCE_GRACE_SEC
  )
    return "invalid-source";
  const newRound = input.lastSourceRound !== source.roundId.toString();
  if (input.active && newRound) return "active-round";
  const age = nowSec - mirror.updatedAt;
  if (input.confirming && age >= BigInt(input.confirmSec)) return "confirmation";
  if (age >= BigInt(input.heartbeatSec)) return "heartbeat";
  const moved = source.answer > mirror.answer ? source.answer - mirror.answer : mirror.answer - source.answer;
  if (newRound && (mirror.answer <= 0n || moved * BPS >= mirror.answer * BigInt(input.deviationBps)))
    return "deviation";
  return undefined;
}
