/**
 * Lucky, both apps (S8.8, D-295; Owarine's Lucky): spin, and a sealed draw picks a market, a side and a reach; the deal
 * is the running window and band on that side whose payout is nearest the reach. The card shows the seed proof (the
 * commitment re-hashed here) and the live quote, and says so when the price drifted from the deal; one tap places one
 * ordinary call through the relay — one-tap or one Face ID, exactly like the terminal's.
 */
import type { LuckyRevealView, LuckySealView } from "@senryo/api-client";
import { freshSeed, luckyVerifies } from "@senryo/chain";
import { BAND_INDEX, type CadenceSec, type ChainId } from "@senryo/config";
import { LUCKY_CADENCES, luckyDrifted, luckyStreak, multiplierE2, quoteOpen } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useIntentStatus, useLuckyDesk, useLuckyDraws, useQueryEnv, useTickets } from "@senryo/query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Caller } from "./caller.ts";
import { useCallActions } from "./use-call.ts";
import { useCallWindow } from "./use-call-window.ts";

export type LuckyPhase = "idle" | "spinning" | "dealt" | "nothing" | "placing" | "placed";

export interface LuckyFlowEffects {
  cue(cue: "press" | "spin" | "filled" | "fail"): void;
  notify(notice: { title: string; description: string }): void;
  needAccount(): void;
}

const BAND_WORDS: Readonly<Record<number, string>> = {
  [BAND_INDEX.up]: "Up",
  [BAND_INDEX.down]: "Down",
  [BAND_INDEX.moonshot]: "Moonshot",
  [BAND_INDEX.crash]: "Crash",
};
export const luckyBandWord = (band: number) => BAND_WORDS[band] ?? "Call";

export function useLuckyFlow(caller: Caller, effects: LuckyFlowEffects) {
  const env = useQueryEnv();
  const live = useLive();
  const owner = caller.hint?.address;
  const desk = useLuckyDesk(owner);
  const draws = useLuckyDraws(owner);
  const tickets = useTickets(owner);
  const actions = useCallActions(caller);
  const [phase, setPhase] = useState<LuckyPhase>("idle");
  const [seal, setSeal] = useState<LuckySealView | null>(null);
  const [reveal, setReveal] = useState<LuckyRevealView | null>(null);
  const [digest, setDigest] = useState<`0x${string}` | undefined>(undefined);
  const fx = useRef(effects);
  fx.current = effects;

  const dealt = reveal?.dealt ?? null;
  const view = useCallWindow(dealt?.symbol ?? "BTC", (dealt?.cadenceSec ?? LUCKY_CADENCES[0]) as CadenceSec, owner);
  const statusReading = useIntentStatus(digest);
  const status = "value" in statusReading ? statusReading.value : null;

  /** The live quote for `stake` on the dealt band, and whether it drifted from the deal. */
  const quoteFor = (stake: bigint) => {
    if (!dealt || view.window.windowId.toLowerCase() !== dealt.windowId.toLowerCase()) return null;
    const band = view.series?.bands[dealt.band];
    const spot = live.prices.latest(dealt.symbol)?.priceE8;
    if (!band || !view.series || !view.terms || view.k === undefined || spot === undefined) return null;
    const q = quoteOpen(
      band,
      { openE8: view.k, sigmaE8: BigInt(view.series.sigmaE8), tauSec: BigInt(Math.max(0, dealt.expiry - view.now)) },
      BigInt(Math.round(spot)),
      stake,
      {
        halfSpreadE6: BigInt(view.terms.halfSpreadE6),
        minProbE6: BigInt(view.terms.minProbE6),
        maxProbE6: BigInt(view.terms.maxProbE6),
        surchargeE6: 0n,
      },
    );
    if (q.refusal) return null;
    return {
      payout: q.payout,
      multipleE2: multiplierE2(stake, q.payout),
      drifted: luckyDrifted(dealt.priceE6, q.priceE6),
    };
  };

  const verified = useMemo(
    () =>
      Boolean(
        seal &&
          reveal &&
          owner &&
          reveal.digest &&
          luckyVerifies({
            serverSeed: reveal.serverSeed,
            commitment: seal.commitment,
            clientSeed: reveal.clientSeed,
            owner,
            markets: seal.markets,
            marketsHash: seal.marketsHash,
            digest: reveal.digest,
          }),
      ),
    [seal, reveal, owner],
  );

  // The call fills: link it to the draw (its history) and mark the card placed.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (!status || !reveal || status.state !== "filled" || status.ticketId === null) return;
    if (linked.current === reveal.drawId) return;
    linked.current = reveal.drawId;
    setPhase("placed");
    fx.current.cue("filled");
    desk.placed.mutate({ drawId: reveal.drawId, ticketId: status.ticketId });
  }, [status, reveal, desk.placed]);
  useEffect(() => {
    if (status && (status.state === "refused" || status.state === "failed") && phase === "placing") {
      setPhase("dealt");
      fx.current.cue("fail");
      fx.current.notify({
        title: "That call didn't fill",
        description: status.reason ?? "The price moved; try again.",
      });
    }
  }, [status, phase]);

  /** Seal a draw, add this device's seed, reveal: the reels spin while it happens. */
  const spin = async () => {
    if (!owner || !caller.client) return fx.current.needAccount();
    fx.current.cue("spin");
    setPhase("spinning");
    setDigest(undefined);
    try {
      const sealed = await desk.seal.mutateAsync();
      setSeal(sealed);
      const revealed = await desk.reveal.mutateAsync({ drawId: sealed.drawId, clientSeed: freshSeed() });
      setReveal(revealed);
      setPhase(revealed.dealt ? "dealt" : "nothing");
    } catch (error) {
      setPhase("idle");
      fx.current.cue("fail");
      fx.current.notify({ title: "The spin didn't go through", description: (error as Error).message });
    }
  };

  /** Place the dealt call for `stake` at the live quote (less the tolerance). */
  const place = async (stake: bigint) => {
    const q = quoteFor(stake);
    if (!dealt || !q || !view.window.trading) {
      return fx.current.notify({ title: "Not priced right now", description: "Spin again for a fresh deal." });
    }
    fx.current.cue("press");
    setPhase("placing");
    try {
      const sent = await actions.open({
        window: view.window,
        band: dealt.band,
        bandLabel: luckyBandWord(dealt.band),
        stake,
        payoutQuote: q.payout,
      });
      if (sent.kind === "cancelled") return setPhase("dealt");
      setDigest(sent.status.digest);
    } catch (error) {
      setPhase("dealt");
      fx.current.cue("fail");
      fx.current.notify({ title: "That call didn't go through", description: (error as Error).message });
    }
  };

  const history = "value" in draws ? draws.value : [];
  const results = history.map((d) => {
    if (d.ticketId === null) return "open" as const;
    const t = "value" in tickets ? tickets.value.tickets.find((x) => x.ticketId === d.ticketId) : undefined;
    if (t?.state !== "settled") return "open" as const;
    return t.outcome === "win" ? ("won" as const) : t.outcome === "refund" ? ("refunded" as const) : ("lost" as const);
  });

  return {
    chainId: env.chainId as ChainId,
    owner,
    phase,
    seal,
    reveal,
    dealt,
    window: view.window,
    now: view.now,
    verified,
    quoteFor,
    spin,
    place,
    again: () => {
      setPhase("idle");
      setReveal(null);
      setSeal(null);
      setDigest(undefined);
    },
    history,
    streak: luckyStreak(results),
    balance: view.balance,
  };
}

export type LuckyFlow = ReturnType<typeof useLuckyFlow>;
