/**
 * Duel, both apps (S8.6, D-294): the tiers, the queue (one Face ID: the entry and its permit), the dealt deck with each
 * card's Up and Down priced live once a second from its line, the swipes (signed by this device's seat key — no
 * prompt), and the result. Every move of the match arrives on the stream (`duel`, `duelQueue`); the platform supplies
 * the effects (feedback, notices, the sign-in prompt).
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import { type DuelView, printRoute } from "@senryo/api-client";
import { isDeployed } from "@senryo/chain";
import { DUEL, duelEntryCost, duelTierOf, FILL_DELAY_SEC } from "@senryo/config";
import { multiplierE2, type QuoteTerms, quoteOpen, withTolerance } from "@senryo/core";
import { useLive, useServerSeconds } from "@senryo/live/react";
import {
  useCancelDuel,
  useCatalog,
  useDuel,
  useDuelPick,
  useDuelQueue,
  useDuels,
  useEnterDuel,
  useMarketAccount,
  useQueryEnv,
  useRefreshCaller,
} from "@senryo/query";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Caller } from "./caller.ts";
import { PROMPTS, TOLERANCE_BPS } from "./constants.ts";
import { DUEL_LIVE_STATES, DUEL_SIDES, phaseOf, picksOf, seatOf } from "./duel.ts";
import type { SignDeps } from "./sign.ts";

const signing = () => Promise.all([import("./sign.ts"), import("./delegates.ts")]);
const PRINT_RETRIES = 10;
const PRINT_RETRY_MS = 1_000;

export interface DuelSideQuote {
  band: number;
  label: string;
  /** What the card's stake returns on a win, and that as a multiple × 100; null while unpriced or out of range. */
  payout: bigint | null;
  multipleE2: bigint | null;
}

/** Each revealed card's Up and Down at the live price, from its line (K), σ and the time left. */
export function useDuelCardQuotes(m: DuelView | null) {
  const now = useServerSeconds();
  const live = useLive();
  const { api } = useQueryEnv();
  const catalog = useCatalog();
  const cards = m?.cards ?? [];
  const archived = useQueries({
    queries: cards.map((c) => ({
      queryKey: ["prices", "print", c.symbol, c.start],
      queryFn: async () => BigInt((await api.call(printRoute, { query: { symbol: c.symbol, t: c.start } })).priceE8),
      enabled: now > c.start && !live.prints.at(c.symbol, c.start),
      staleTime: Number.POSITIVE_INFINITY,
      retry: PRINT_RETRIES,
      retryDelay: PRINT_RETRY_MS,
    })),
  });
  const markets = "value" in catalog ? catalog.value.markets : [];
  const t = "value" in catalog ? catalog.value.terms : undefined;
  const terms: QuoteTerms | undefined = t && {
    halfSpreadE6: BigInt(t.halfSpreadE6),
    minProbE6: BigInt(t.minProbE6),
    maxProbE6: BigInt(t.maxProbE6),
    surchargeE6: 0n,
  };
  return cards.map((c, i) => {
    const k = live.prints.at(c.symbol, c.start)?.priceE8 ?? archived[i]?.data;
    const series = markets.find((x) => x.symbol === c.symbol)?.series.find((s) => s.cadenceSec === c.cadenceSec);
    const spot = live.prices.latest(c.symbol)?.priceE8;
    const tau = BigInt(Math.max(0, c.expiry - (now + FILL_DELAY_SEC)));
    const sides: DuelSideQuote[] = DUEL_SIDES.map((side) => {
      const band = series?.bands[side.band];
      if (!m || k === undefined || spot === undefined || !band || !series || !terms) {
        return { ...side, payout: null, multipleE2: null };
      }
      const w = { openE8: k, sigmaE8: BigInt(series.sigmaE8), tauSec: tau };
      const q = quoteOpen(band, w, BigInt(Math.round(spot)), m.cardStake, terms);
      if (q.refusal) return { ...side, payout: null, multipleE2: null };
      return { ...side, payout: q.payout, multipleE2: multiplierE2(m.cardStake, q.payout) };
    });
    return { card: c, index: i, k, spot, closesIn: Math.max(0, c.expiry - now), sides };
  });
}

export type DuelCardQuote = ReturnType<typeof useDuelCardQuotes>[number];

export interface DuelFlowEffects {
  cue(cue: "press" | "filled" | "fail"): void;
  notify(notice: { title: string; description: string }): void;
  needAccount(): void;
}

export function useDuelFlow(caller: Caller, effects: DuelFlowEffects) {
  const env = useQueryEnv();
  const live = useLive();
  const owner = caller.hint?.address;
  /** Duels open once the arena is on this network (the markets v2 deploy, D-291); until then the tiers are read-only. */
  const arenaLive = isDeployed(env.chainId, "DuelArena");
  const catalog = useCatalog();
  const account = useMarketAccount(owner);
  const queue = useDuelQueue(arenaLive ? owner : undefined);
  const duels = useDuels(arenaLive ? owner : undefined);
  const enterMutation = useEnterDuel(owner);
  const cancelMutation = useCancelDuel(owner);
  const pickMutation = useDuelPick();
  const refresh = useRefreshCaller(owner);
  const [busy, setBusy] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Set<number>>(new Set());
  const fx = useRef(effects);
  fx.current = effects;

  const entry = "value" in queue ? queue.value : null;
  const history = "value" in duels ? duels.value.duels : [];
  const activeId =
    (entry?.state === "paired" ? entry.matchId : null) ??
    history.find((d) => DUEL_LIVE_STATES.has(d.state))?.matchId ??
    null;
  const matchQuery = useDuel(activeId);
  const match = "value" in matchQuery ? matchQuery.value : (history.find((d) => d.matchId === activeId) ?? null);
  const phase = phaseOf(entry, match, owner);

  useEffect(() => {
    void signing().catch(() => undefined);
  }, []);
  // A swipe the relay couldn't place comes back on the stream; the card is free to try again.
  useEffect(
    () =>
      live.onUser<{ matchId: string; card: number; failed?: string }>("duelPick", (e) => {
        if (!e.failed) return;
        setPlacing((s) => new Set([...s].filter((c) => c !== e.card)));
        fx.current.cue("fail");
        fx.current.notify({ title: "That pick didn't go through", description: e.failed });
      }),
    [live],
  );
  // Picks land: clear their pending marks; a finished duel refreshes the balance and history.
  useEffect(() => {
    if (!match) return;
    const seat = seatOf(match, owner);
    if (seat !== null) {
      const mine = new Set(picksOf(match, seat).map((p) => p.card));
      setPlacing((s) => (s.size === 0 ? s : new Set([...s].filter((c) => !mine.has(c)))));
    }
    if (match.state === "finalized" || match.state === "refunded") refresh();
  }, [match, owner, refresh]);

  const deps = async (): Promise<SignDeps | undefined> => {
    if (!owner || !caller.client) {
      fx.current.needAccount();
      return undefined;
    }
    if (!("value" in account) || !("value" in catalog)) return undefined;
    const { appDelegates } = (await signing())[1];
    return {
      chainId: env.chainId,
      client: caller.client,
      delegates: appDelegates(),
      reserve: catalog.value.contracts.reserve,
      account: account.value,
      nowSec: live.clock.nowSec(),
    };
  };

  /** Joins the queue at `tierId`: one Face ID for the entry and its permit. */
  const enter = async (tierId: number) => {
    const tier = duelTierOf(env.chainId, tierId);
    if (!tier) return;
    const d = await deps();
    if (!d || !owner) return;
    if ("value" in account && account.value.balance < duelEntryCost(tier)) {
      return fx.current.notify({ title: "Not enough dollars", description: "Pick a smaller duel or add dollars." });
    }
    const [{ signDuelEntry }] = await signing();
    fx.current.cue("press");
    setBusy("Signing…");
    try {
      const signed = await signDuelEntry(d, { owner, tier: tierId, cost: duelEntryCost(tier) }, PROMPTS.duel);
      setBusy("Joining…");
      await enterMutation.mutateAsync(signed);
    } catch (error) {
      if (isSilent(classifyAuthError(error))) return;
      fx.current.cue("fail");
      fx.current.notify({ title: "Couldn't join", description: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (entry?.state !== "queued") return;
    try {
      await cancelMutation.mutateAsync(entry.digest);
    } catch (error) {
      fx.current.notify({ title: "Already matched", description: (error as Error).message });
    }
  };

  /** One swipe: `side` on card `card`, accepting the live payout less the tolerance. */
  const pick = async (q: DuelCardQuote, side: (typeof DUEL_SIDES)[number]) => {
    if (!match || !owner || placing.has(q.index)) return;
    const seat = seatOf(match, owner);
    const quote = q.sides.find((s) => s.band === side.band);
    if (seat === null || !caller.client) return;
    if (!quote?.payout) {
      return fx.current.notify({ title: "Not priced right now", description: "This side is out of range." });
    }
    const [{ signDuelPick }, { appDelegates }] = await signing();
    const pickMsg = {
      matchId: match.matchId,
      player: owner,
      card: q.index,
      band: side.band,
      minPayout: withTolerance(quote.payout, TOLERANCE_BPS),
    };
    fx.current.cue("press");
    setPlacing((s) => new Set([...s, q.index]));
    try {
      const signed = await signDuelPick(
        { chainId: env.chainId, client: caller.client, delegates: appDelegates() },
        pickMsg,
        match.keys[seat],
        PROMPTS.duelPick,
      );
      await pickMutation.mutateAsync({ pick: pickMsg, signature: signed.signature });
    } catch (error) {
      setPlacing((s) => new Set([...s].filter((c) => c !== q.index)));
      if (isSilent(classifyAuthError(error))) return;
      fx.current.cue("fail");
      fx.current.notify({ title: "That pick didn't go through", description: (error as Error).message });
    }
  };

  return {
    live: arenaLive,
    chainId: env.chainId,
    owner,
    entry,
    match,
    phase,
    history,
    rating: "value" in duels ? duels.value.rating : null,
    balance: "value" in account ? account.value.balance : undefined,
    busy,
    placing,
    cards: DUEL.cards,
    enter,
    cancel,
    pick,
  };
}

export type DuelFlow = ReturnType<typeof useDuelFlow>;
