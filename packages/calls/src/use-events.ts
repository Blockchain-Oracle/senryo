/**
 * Yes/no events, both apps (S8.7, D-296): the board with its pools moving live, the caller's calls, and one call —
 * signed by the owner under one Face ID (the call and an exact permit to the book), relayed gas-free, answered once it
 * is on chain with its ticket and transaction. The platform supplies the effects (feedback, notices, sign-in).
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import type { EventView } from "@senryo/api-client";
import { type Hex, isDeployed } from "@senryo/chain";
import { committeeView, EVENT_LIMITS } from "@senryo/config";
import { usd } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import {
  useEventBoard,
  useEventCalls,
  useMarketAccount,
  usePlaceEventCall,
  useQueryEnv,
  useRefreshCaller,
} from "@senryo/query";
import { useEffect, useRef, useState } from "react";
import type { Caller } from "./caller.ts";
import { PROMPTS } from "./constants.ts";
import { sideWord } from "./event-words.ts";

const signing = () => import("./sign.ts");

export interface EventFlowEffects {
  cue(cue: "press" | "filled" | "fail"): void;
  notify(notice: { title: string; description: string }): void;
  needAccount(): void;
}

/** A placed call, kept on screen as its receipt until the caller starts another. */
export interface EventReceipt {
  eventId: Hex;
  question: string;
  yes: boolean;
  stake: bigint;
  ticketId: bigint;
  txHash: Hex;
}

export function useEventsFlow(caller: Caller, effects: EventFlowEffects) {
  const env = useQueryEnv();
  const live = useLive();
  const owner = caller.hint?.address;
  /** Events open once the book is on this network (the markets v2 deploy, D-291); Practice only (D-296). */
  const bookLive = isDeployed(env.chainId, "EventBook");
  const limits = EVENT_LIMITS[env.chainId];
  const board = useEventBoard(bookLive);
  const calls = useEventCalls(bookLive ? owner : undefined);
  const account = useMarketAccount(owner);
  const place = usePlaceEventCall(owner);
  const refresh = useRefreshCaller(owner);
  const [busy, setBusy] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<EventReceipt | null>(null);
  const fx = useRef(effects);
  fx.current = effects;

  useEffect(() => {
    void signing().catch(() => undefined);
  }, []);

  /** One call of exactly `stake` on `yes`; resolves with its receipt, or null when it didn't go through. */
  const call = async (e: EventView, yes: boolean, stake: bigint): Promise<EventReceipt | null> => {
    if (!owner || !caller.client) {
      fx.current.needAccount();
      return null;
    }
    if (!limits || !("value" in account) || busy) return null;
    if (stake < limits.minStake || stake > limits.maxStake) {
      fx.current.notify({
        title: "Outside the limits",
        description: `Calls here are ${usd(limits.minStake)} to ${usd(limits.maxStake)}.`,
      });
      return null;
    }
    if (account.value.balance < stake) {
      fx.current.notify({ title: "Not enough dollars", description: "Call less or add dollars." });
      return null;
    }
    const { signEventCall } = await signing();
    fx.current.cue("press");
    setBusy("Signing…");
    try {
      const signed = await signEventCall(
        { chainId: env.chainId, client: caller.client, account: account.value, nowSec: live.clock.nowSec() },
        { owner, eventId: e.eventId, yes, stake },
        PROMPTS.event(sideWord(yes)),
      );
      setBusy("Placing…");
      const placed = await place.mutateAsync(signed);
      const done: EventReceipt = { eventId: e.eventId, question: e.question, yes, stake, ...placed };
      setReceipt(done);
      fx.current.cue("filled");
      refresh();
      return done;
    } catch (error) {
      if (isSilent(classifyAuthError(error))) return null;
      fx.current.cue("fail");
      fx.current.notify({ title: "That call didn't go through", description: (error as Error).message });
      return null;
    } finally {
      setBusy(null);
    }
  };

  return {
    live: bookLive,
    chainId: env.chainId,
    owner,
    limits,
    events: "value" in board ? board.value.events : [],
    committee: ("value" in board ? board.value.committee : null) ?? committeeView(env.chainId),
    /** fresh · stale · failed · unknown (still reading). */
    boardStatus: board.status,
    calls: "value" in calls ? calls.value : [],
    balance: "value" in account ? account.value.balance : undefined,
    busy,
    receipt,
    clearReceipt: () => setReceipt(null),
    call,
  };
}

export type EventsFlow = ReturnType<typeof useEventsFlow>;
