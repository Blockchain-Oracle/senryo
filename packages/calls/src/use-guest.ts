/**
 * The guest in React (R5.10, `guest.ts`): who trades on this device — the passkey account, else on Practice the guest's
 * key — the guest's start at its first call (the key, a SIWE session, the Practice grant, and a wait until its test
 * dollars land), and, once a passkey account exists, its dollars moving over by an EIP-3009 transfer the relay
 * submits (`/v1/money/withdraw`, no MON needed). Calls and rides still open on the key pay the key when they end; each
 * payout is moved the same way, and the key is forgotten when nothing of it is left.
 */
import type { Address, LocalAccount } from "@senryo/account";
import { marketAccountRoute, practiceGrantRoute } from "@senryo/api-client";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import {
  marketKeys,
  type SessionRunner,
  useMarketAccount,
  useQueryEnv,
  useRides,
  useTickets,
  useWithdraw,
} from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Caller } from "./caller.ts";
import { forgetGuest, guestCaller, guestNow, makeGuest, subscribeGuest } from "./guest.ts";
import { reasonWords } from "./reason-words.ts";
import type { TradeNote } from "./toast-run.ts";
import type { OfferSlot } from "./use-call-flow.ts";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const MS = 1_000;
/** The grant's transfer lands in a block or two; wait this long before saying it didn't. */
const DOLLARS_WAIT_MS = 20_000;
const DOLLARS_POLL_MS = 800;
const AUTH_TTL_SEC = 3_600;
const OPEN_CALL = new Set(["committed", "open", "closing"]);
const OPEN_RIDE = new Set(["committed", "open", "closing"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useGuestKey(): LocalAccount | null | undefined {
  return useSyncExternalStore(subscribeGuest, guestNow, guestNow);
}

export interface Trader {
  caller: Caller;
  owner: Address | undefined;
  /** Trading as this device's Practice guest. */
  guest: boolean;
}

/** Who trades here: the passkey account when there is one, else on Practice the guest once it has started. */
export function useTrader(account: Caller): Trader {
  const env = useQueryEnv();
  const key = useGuestKey();
  const guest = useMemo(() => (key ? guestCaller(key) : undefined), [key]);
  if (account.hint) return { caller: account, owner: account.hint.address, guest: false };
  if (env.chainId === TESTNET_CHAIN_ID && guest) return { caller: guest, owner: guest.hint?.address, guest: true };
  return { caller: account, owner: undefined, guest: false };
}

export type GuestPhase = "idle" | "starting" | "failed";

/**
 * Start the guest at its first call: false on Real (it needs an account); throws with the reason when the test dollars
 * can't be had. `sessionFor` is the app's SIWE session for a plain key (its api client holds the token).
 */
export function useGuestStart(sessionFor: (key: LocalAccount) => SessionRunner) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const [phase, setPhase] = useState<GuestPhase>("idle");
  const start = useCallback(async (): Promise<boolean> => {
    if (env.chainId !== TESTNET_CHAIN_ID) return false;
    setPhase("starting");
    try {
      const key = await makeGuest();
      const read = () => env.api.call(marketAccountRoute, { query: { chainId: env.chainId, owner: key.address } });
      if ((await read()).balance === 0n) {
        const grant = await sessionFor(key)(() => env.api.call(practiceGrantRoute, {}));
        if (grant.state === "unavailable") throw new Error("Test dollars aren't available right now.");
      }
      for (const until = Date.now() + DOLLARS_WAIT_MS; Date.now() < until; await sleep(DOLLARS_POLL_MS)) {
        const account = await read();
        if (account.balance > 0n) {
          client.setQueryData(marketKeys.account(env.chainId, key.address), account);
          setPhase("idle");
          return true;
        }
      }
      throw new Error("The test dollars are taking a while. Tap again in a moment.");
    } catch (error) {
      setPhase("failed");
      throw error;
    }
  }, [env, client, sessionFor]);
  return { start, phase };
}

const START_TOAST = "guest-start";

/**
 * A visitor's first tap on Practice (R5.10): start the guest and place that same call or ride — no re-tap — once the
 * guest trades here and its dollars have landed. Returns false on Real (it needs an account) so the app asks for one.
 */
export function useGuestTap(i: {
  owner: Address | undefined;
  symbol: string;
  sessionFor: (key: LocalAccount) => SessionRunner;
  place: (slot: OfferSlot) => void;
  toast: (id: string, note: TradeNote | null) => void;
}): (slot: OfferSlot) => boolean {
  const env = useQueryEnv();
  const { start } = useGuestStart(i.sessionFor);
  const held = useRef<OfferSlot | null>(null);
  const [landed, setLanded] = useState(0);
  const latest = useRef(i);
  latest.current = i;

  useEffect(() => {
    const slot = held.current;
    if (!landed || !i.owner || slot === null) return;
    held.current = null;
    latest.current.place(slot);
  }, [landed, i.owner]);

  return useCallback(
    (slot: OfferSlot) => {
      if (env.chainId !== TESTNET_CHAIN_ID) return false;
      if (held.current !== null) return true;
      held.current = slot;
      const { symbol, toast } = latest.current;
      toast(START_TOAST, {
        title: "Getting your test dollars…",
        description: "Practice needs no sign-up. Make a passkey later to keep them.",
        symbol,
        tone: "loading",
      });
      start().then(
        () => {
          toast(START_TOAST, null);
          setLanded((n) => n + 1);
        },
        (error: Error) => {
          held.current = null;
          toast(START_TOAST, {
            title: "Couldn't get test dollars",
            description: reasonWords(error.message, error.message),
            symbol,
            tone: "warning",
          });
        },
      );
      return true;
    },
    [env.chainId, start],
  );
}

/**
 * Once a passkey account exists on Practice, the guest's dollars move to it — now, and again whenever an open call or
 * ride of the key pays out — and the key is forgotten when it holds nothing and nothing of it is open.
 */
export function useGuestSweep(owner: Address | undefined, notify: (n: { title: string; description: string }) => void) {
  const env = useQueryEnv();
  const key = useGuestKey();
  const from = owner && key && env.chainId === TESTNET_CHAIN_ID ? key : undefined;
  const account = useMarketAccount(from?.address);
  const tickets = useTickets(from?.address);
  const rides = useRides(from?.address);
  const withdraw = useWithdraw(from?.address);
  const busy = useRef(false);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const balance = "value" in account ? account.value.balance : undefined;
  const open =
    !("value" in tickets) ||
    !("value" in rides) ||
    tickets.value.tickets.some((t) => OPEN_CALL.has(t.state)) ||
    rides.value.rides.some((r) => OPEN_RIDE.has(r.state));

  useEffect(() => {
    if (!from || !owner || balance === undefined || busy.current) return;
    if (balance === 0n) {
      if (!open) void forgetGuest();
      return;
    }
    busy.current = true;
    void (async () => {
      try {
        const { freshAuthNonce, transferAuthRequest } = await import("@senryo/chain");
        const authorization = {
          from: from.address,
          to: owner,
          value: balance,
          validAfter: 0n,
          validBefore: BigInt(Math.floor(Date.now() / MS) + AUTH_TTL_SEC),
          nonce: freshAuthNonce(),
        };
        const signature = await from.signTypedData(transferAuthRequest(env.chainId, authorization));
        const r = await withdraw.mutateAsync({ authorization, signature });
        if (r.state === "reverted") return;
        notifyRef.current({
          title: `Your $${formatUnits(balance, DOLLAR_DECIMALS, CENTS)} moved to your account`,
          description: open ? "Calls still open move over as they pay out." : "Everything from before is yours now.",
        });
      } catch {
        // Tried again at the next balance read.
      } finally {
        busy.current = false;
      }
    })();
  }, [from, owner, balance, open, env.chainId, withdraw]);
}
