/**
 * The parlay builder, both apps (S8.5, D-293): 2–4 picks on the windows trading now; each leg's live chance from its
 * window's line and the latest price, recomputed once a second (a slip, not a chart); the joint chance and payout as
 * the chain prices them (`quoteParlay`); and placing it — one-tap or one Face ID, relayed gas-free, its status pushed
 * on the stream as an intent. The platform supplies the effects (feedback, notices, the sign-in prompt).
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import { type IntentStatus, printRoute } from "@senryo/api-client";
import { FILL_DELAY_SEC, MARKETS, PARLAY } from "@senryo/config";
import { probE6, quoteParlay, withTolerance } from "@senryo/core";
import { useLive, useServerSeconds } from "@senryo/live/react";
import {
  useCatalog,
  useIntentStatus,
  useMarketAccount,
  useQueryEnv,
  useRefreshCaller,
  useSubmitParlay,
} from "@senryo/query";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Caller } from "./caller.ts";
import { PROMPTS, TOLERANCE_BPS } from "./constants.ts";
import { PARLAY_SIDES, type ParlayPick } from "./parlay.ts";
import type { SignDeps } from "./sign.ts";
import { windowFor } from "./window.ts";

const signing = () => Promise.all([import("./sign.ts"), import("./delegates.ts")]);
const PRINT_RETRIES = 10;
const PRINT_RETRY_MS = 1_000;
const SETTLED = new Set(["filled", "refused", "failed"]);

export function useParlayQuote(picks: readonly ParlayPick[], stake: bigint) {
  const now = useServerSeconds();
  const live = useLive();
  const { api } = useQueryEnv();
  const catalog = useCatalog();
  const windows = picks.map((p) => windowFor(p.symbol, p.cadenceSec, now));
  const archived = useQueries({
    queries: windows.map((w) => ({
      queryKey: ["prices", "print", w.symbol, w.start],
      queryFn: async () => BigInt((await api.call(printRoute, { query: { symbol: w.symbol, t: w.start } })).priceE8),
      enabled: now > w.start && !live.prints.at(w.symbol, w.start),
      staleTime: Number.POSITIVE_INFINITY,
      retry: PRINT_RETRIES,
      retryDelay: PRINT_RETRY_MS,
    })),
  });
  const markets = "value" in catalog ? catalog.value.markets : [];
  const legs = picks.map((p, i) => {
    const w = windows[i] ?? windowFor(p.symbol, p.cadenceSec, now);
    const k = live.prints.at(w.symbol, w.start)?.priceE8 ?? archived[i]?.data;
    const series = markets.find((m) => m.symbol === p.symbol)?.series.find((s) => s.cadenceSec === p.cadenceSec);
    const spot = live.prices.latest(p.symbol)?.priceE8;
    const tau = BigInt(Math.max(0, w.expiry - (now + FILL_DELAY_SEC)));
    const chanceOf = (index: number) => {
      const band = series?.bands[index];
      return k !== undefined && spot !== undefined && band && series
        ? probE6(band, k, BigInt(Math.round(spot)), BigInt(series.sigmaE8), tau)
        : null;
    };
    const group = MARKETS.find((m) => m.symbol === p.symbol)?.calendarId ?? 0;
    /** Each side's chance (Up, Down) for the slip's odds buttons; `probE6` is the picked side's. */
    const sides = PARLAY_SIDES.map((side) => chanceOf(side.band));
    return { pick: p, window: w, k, probE6: chanceOf(p.band), sides, group };
  });
  const terms = "value" in catalog ? catalog.value.terms : undefined;
  const priced = legs.every((l) => l.probE6 !== null);
  const quote =
    terms && priced && legs.length >= PARLAY.minLegs
      ? quoteParlay(
          legs.map((l) => ({ probE6: l.probE6 ?? 0n, group: l.group })),
          stake,
          {
            halfSpreadE6: BigInt(terms.halfSpreadE6),
            minProbE6: BigInt(terms.minProbE6),
            maxProbE6: BigInt(terms.maxProbE6),
            surchargeE6: 0n,
          },
          PARLAY.correlationBps,
        )
      : null;
  return { now, legs, quote, trading: windows.every((w) => w.trading) };
}

export type ParlayQuoteView = ReturnType<typeof useParlayQuote>;

export interface ParlayFlowEffects {
  cue(cue: "press" | "filled" | "fail"): void;
  notify(notice: { title: string; description: string }): void;
  needAccount(): void;
}

export function useParlayFlow(caller: Caller, effects: ParlayFlowEffects) {
  const env = useQueryEnv();
  const live = useLive();
  const owner = caller.hint?.address;
  const catalog = useCatalog();
  const account = useMarketAccount(owner);
  const submit = useSubmitParlay();
  const [picks, setPicks] = useState<ParlayPick[]>([]);
  const [signing_, setSigning] = useState(false);
  const [digest, setDigest] = useState<`0x${string}` | undefined>(undefined);
  const intent = useIntentStatus(digest);
  const status: IntentStatus | null = "value" in intent ? intent.value : null;
  const fx = useRef(effects);
  fx.current = effects;
  const refresh = useRefreshCaller(owner);
  useEffect(() => {
    void signing().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!status || !SETTLED.has(status.state)) return;
    refresh();
    if (status.state === "filled") {
      fx.current.cue("filled");
      setPicks([]);
    } else {
      fx.current.cue("fail");
      fx.current.notify({
        title: status.state === "refused" ? "Parlay refused" : "Parlay didn't go through",
        description: status.reason ?? "Your stake was not taken.",
      });
    }
    setDigest(undefined);
  }, [status, refresh]);

  const pick = (p: ParlayPick) =>
    setPicks((old) => {
      const rest = old.filter((o) => o.symbol !== p.symbol);
      const same = old.find((o) => o.symbol === p.symbol && o.band === p.band && o.cadenceSec === p.cadenceSec);
      if (same) return rest; // tapping a pick again removes it
      return rest.length >= PARLAY.maxLegs ? old : [...rest, p];
    });
  const remove = (symbol: string) => setPicks((old) => old.filter((o) => o.symbol !== symbol));

  /** Places `picks` at `stake` for at least the quote less the tolerance, legs sorted in close order. */
  const place = async (q: ParlayQuoteView, stake: bigint) => {
    if (!owner || !caller.client) return fx.current.needAccount();
    if (!("value" in catalog) || !("value" in account)) return;
    if (!q.quote || q.quote.refusal || !q.trading) {
      return fx.current.notify({ title: "Not priced right now", description: "A leg is closing or out of range." });
    }
    if (account.value.balance < stake) {
      return fx.current.notify({ title: "Not enough dollars", description: "Lower the stake or add dollars." });
    }
    const legs = [...q.legs].sort((a, b) => a.window.expiry - b.window.expiry);
    const [{ signParlay }, { appDelegates }] = await signing();
    const deps: SignDeps = {
      chainId: env.chainId,
      client: caller.client,
      delegates: appDelegates(),
      reserve: catalog.value.contracts.reserve,
      account: account.value,
      nowSec: live.clock.nowSec(),
    };
    fx.current.cue("press");
    setSigning(true);
    try {
      const signed = await signParlay(
        deps,
        {
          owner,
          windowIds: legs.map((l) => l.window.windowId),
          bands: legs.map((l) => l.pick.band),
          stake,
          minPayout: withTolerance(q.quote.payout, TOLERANCE_BPS),
          configVersion: catalog.value.configVersion,
        },
        PROMPTS.parlay(legs.length),
      );
      const s = await submit.mutateAsync({
        intent: signed.intent,
        signature: signed.signature,
        permit: signed.permit,
        legs: legs.map((l) => ({ symbol: l.window.symbol, cadenceSec: l.window.cadenceSec, start: l.window.start })),
      });
      setDigest(s.digest);
    } catch (error) {
      if (isSilent(classifyAuthError(error))) return;
      fx.current.cue("fail");
      fx.current.notify({ title: "Couldn't place the parlay", description: (error as Error).message });
    } finally {
      setSigning(false);
    }
  };

  const pending = signing_ ? "Signing…" : digest ? "Placing the parlay…" : null;
  const balance = "value" in account ? account.value.balance : undefined;
  return { picks, pick, remove, clear: () => setPicks([]), place, pending, balance };
}
