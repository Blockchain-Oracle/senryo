/**
 * The terminal's actions (S5): open a call or cash one out at the quote the user saw. The limit is that quote less
 * TOLERANCE_BPS; one-tap signs with no prompt, otherwise one Face ID (cancel returns quietly). The relay answers with
 * the call's digest at once; its status then arrives on the stream (`useIntentStatus`).
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import type { IntentStatus } from "@senryo/api-client";
import { ACTION_CLOSE, ACTION_OPEN } from "@senryo/chain";
import { withTolerance } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useCatalog, useMarketAccount, useQueryEnv, useSubmitIntent } from "@senryo/query";
import { useCallback } from "react";
import { useAccount } from "~/lib/account/provider";
import { appDelegates } from "~/lib/delegates";
import { PROMPTS, TOLERANCE_BPS } from "./constants";
import { type CallDraft, type SignDeps, signCall } from "./sign";
import type { CallWindow } from "./window";

export type CallResult = { kind: "sent"; status: IntentStatus; via: "one-tap" | "face-id" } | { kind: "cancelled" };

export interface OpenArgs {
  window: CallWindow;
  band: number;
  /** "Up", "Down", … — the Face ID prompt says what is being signed. */
  bandLabel: string;
  stake: bigint;
  /** The payout the user saw for this stake (`quoteOpen`). */
  payoutQuote: bigint;
}

export interface CloseArgs {
  window: CallWindow;
  ticketId: bigint;
  band: number;
  shares: bigint;
  /** The proceeds the user saw for these shares (`quoteClose`). */
  proceedsQuote: bigint;
}

export function useCallActions() {
  const env = useQueryEnv();
  const live = useLive();
  const { client, hint } = useAccount();
  const owner = hint?.address;
  const catalog = useCatalog();
  const account = useMarketAccount(owner);
  const submit = useSubmitIntent();
  const ready = Boolean(client && owner && "value" in catalog && "value" in account);

  const send = useCallback(
    async (w: CallWindow, draft: Omit<CallDraft, "owner" | "configVersion">, prompt: string): Promise<CallResult> => {
      if (!client || !owner || !("value" in catalog) || !("value" in account)) throw new Error("Not ready to call");
      const deps: SignDeps = {
        chainId: env.chainId,
        client,
        delegates: appDelegates(),
        reserve: catalog.value.contracts.reserve,
        account: account.value,
        nowSec: live.clock.nowSec(),
      };
      try {
        const signed = await signCall(deps, { ...draft, owner, configVersion: catalog.value.configVersion }, prompt);
        const status = await submit.mutateAsync({
          intent: { ...signed.intent, action: signed.intent.action as 1 | 2 },
          signature: signed.signature,
          permit: signed.permit,
          symbol: w.symbol,
          cadenceSec: w.cadenceSec,
          start: w.start,
        });
        return { kind: "sent", status, via: signed.via };
      } catch (error) {
        if (isSilent(classifyAuthError(error))) return { kind: "cancelled" };
        throw error;
      }
    },
    [client, owner, catalog, account, env.chainId, live, submit],
  );

  const open = useCallback(
    (a: OpenArgs) =>
      send(
        a.window,
        {
          action: ACTION_OPEN,
          windowId: a.window.windowId,
          band: a.band,
          ticketId: 0n,
          amount: a.stake,
          limit: withTolerance(a.payoutQuote, TOLERANCE_BPS),
        },
        PROMPTS.call(a.bandLabel, a.window.symbol),
      ),
    [send],
  );

  const close = useCallback(
    (a: CloseArgs) =>
      send(
        a.window,
        {
          action: ACTION_CLOSE,
          windowId: a.window.windowId,
          band: a.band,
          ticketId: a.ticketId,
          amount: a.shares,
          limit: withTolerance(a.proceedsQuote, TOLERANCE_BPS),
        },
        PROMPTS.close,
      ),
    [send],
  );

  return { ready, open, close, pending: submit.isPending };
}
