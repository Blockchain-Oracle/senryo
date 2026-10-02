/**
 * Freeze is one tap (E-D3): revoke the onchain allowance first (session scope), then pause the card at the issuer.
 * Partial outcomes stay honest (E3 rules):
 * - the revoke didn't finalize → nothing was paused → "Freeze not confirmed" with Retry (unless the result is still
 *   unknown, which offers nothing new until it settles);
 * - the revoke finalized but the issuer pause failed → the card is frozen in effect (no allowance) → it reads Frozen
 *   while the pause is retried quietly.
 * A cancelled Face ID is the user's choice: nothing changes and nothing is said.
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import type { CardSummaryCard } from "@senryo/api-client";
import type { AccountSnapshot } from "@senryo/chain";
import { allowanceState } from "@senryo/query";
import { useEffect, useState } from "react";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { fire } from "~/feedback/fire";
import { useCardAllowance } from "./useCardAllowance";
import { useFreezeCard } from "./useCardService";

const MS_PER_SECOND = 1000n;
/** A pause the issuer refused is asked again this often while the tab is open. */
const PAUSE_RETRY_MS = 15_000;

export type FreezeState = "idle" | "freezing" | "unconfirmed" | "pause-owed";

export function useCardFreeze(card: CardSummaryCard | undefined, snapshot: AccountSnapshot | undefined) {
  const allowance = useCardAllowance(snapshot);
  const pause = useFreezeCard();
  const [state, setState] = useState<FreezeState>("idle");
  const outcome = useSettledOutcome(allowance.trace.events);

  const pauseCard = async (token: string): Promise<boolean> => {
    try {
      await pause.mutateAsync(token);
      return true;
    } catch {
      return false;
    }
  };

  const freeze = async () => {
    if (!card || state === "freezing") return;
    setState("freezing");
    const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
    const live =
      snapshot !== undefined &&
      allowanceState(snapshot.allowanceDailyLimit, snapshot.allowanceExpiry, snapshot.allowanceLeft, nowSec).kind ===
        "live";
    if (live) {
      const revoked = await allowance.freeze();
      if (revoked?.final?.stage !== "finalized") {
        setState("unconfirmed");
        return;
      }
    }
    const paused = await pauseCard(card.cardToken);
    setState(paused ? "idle" : "pause-owed");
    fire("confirm");
  };

  // Frozen in effect, the issuer still open: keep asking quietly until it pauses (or the card reads PAUSED).
  const owed = state === "pause-owed" && card?.state === "ACTIVE" ? card.cardToken : undefined;
  useEffect(() => {
    if (!owed) return;
    const timer = setInterval(() => void pause.mutateAsync(owed).catch(() => undefined), PAUSE_RETRY_MS);
    return () => clearInterval(timer);
  }, [owed, pause.mutateAsync]);

  // A Face ID the user cancelled reads as nothing having happened (the trace keeps the cancelled attempt).
  const failure = allowance.trace.events.findLast((e) => e.stage === "failed")?.error;
  const cancelled =
    state === "unconfirmed" && outcome === "not-sent" && failure !== undefined && isSilent(classifyAuthError(failure));
  return {
    freeze,
    state: cancelled ? "idle" : state,
    /** The revoke was signed but its result isn't known yet: no new action until it settles. */
    unresolved: outcome === "unknown",
    frozen: card?.state === "PAUSED" || state === "pause-owed",
  };
}
