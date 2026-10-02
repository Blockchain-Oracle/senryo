/**
 * How an open is confirmed (D-238, flow book C3): the session signs it when the policy allows it in scope; above the
 * session's limits (per-trade cap, session total, session leverage) the same reviewed order is signed through one
 * passkey step-up instead of failing. The market's own open-interest room is not something a passkey can lift — that
 * stays the "market full" blocker, so it is never reported as passkey-confirmable here.
 */
import { type AccountClient, type Address, emptyUsage, type FaceIdMode, judgeAction } from "@senryo/account";
import { policyContext } from "~/lib/account/api";

export type ConfirmLevel = "session" | "passkey";

/** Reject reasons a step-up resolves: the session's own limits, not the market's or the account's. */
const STEP_UP_REASONS = new Set(["over-trade-cap", "over-session-total", "over-leverage"]);

export interface OpenCheck {
  client: AccountClient | undefined;
  address: Address | undefined;
  faceId: FaceIdMode | undefined;
  marketId: number;
  isLong: boolean;
  notionalUsd6: bigint;
  /** Initial-margin equity from the reviewed risk snapshot; undefined while it loads. */
  equityUsd6: bigint | undefined;
  /** The market's open-interest headroom for this side; undefined while it loads. */
  roomUsd6: bigint | undefined;
}

export function openConfirmLevel(check: OpenCheck): ConfirmLevel {
  const { client, address, notionalUsd6, roomUsd6, equityUsd6 } = check;
  if (!client || !address || notionalUsd6 <= 0n || equityUsd6 === undefined || roomUsd6 === undefined) return "session";
  // Past the market's room the engine refuses the order whatever signs it: the blocker chain explains that.
  if (notionalUsd6 > roomUsd6) return "session";
  const base = policyContext(address, check.faceId)();
  const verdict = judgeAction(
    { kind: "open", marketId: check.marketId, isLong: check.isLong, notionalUsd6 },
    { ...base, equityUsd6: () => equityUsd6, marketRoomUsd6: () => roomUsd6 },
    client.session.live()?.usage ?? emptyUsage(),
  );
  return verdict.kind === "reject" && verdict.stepUp && STEP_UP_REASONS.has(verdict.reason) ? "passkey" : "session";
}
