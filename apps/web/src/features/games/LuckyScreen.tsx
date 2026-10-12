"use client";
import { luckyBandWord, useLuckyFlow } from "@senryo/calls/react";
import { LUCKY_STAKES_USD } from "@senryo/config";
/**
 * Lucky (S8.8, D-295; Owarine's Lucky; `/app/games/lucky/`): a machine (R7.4) — three deep reels, market, side and
 * reach, behind a payline, and a lever you pull — that lands on a draw sealed before your own seed existed. The reels
 * ratchet as they tumble and stop 720 / 980 / 1240 ms after the draw, each with a thunk a step up the chord and a
 * firmer haptic; the top reach rings the jackpot. The deal is the running window and band on that side whose payout is
 * nearest the reach, priced live; one tap places it as an ordinary call. The games bed plays from the first pull. The
 * proof (the seal re-hashed in the browser) and your draws with the streak sit below.
 */
import { clockText, LUCKY_REACHES, lane, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { PixelMark } from "@senryo/identity/web";
import { Check, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import "./lucky.css";
import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { EntityMark } from "@/components/identity/entity-mark";
import { SlotReel } from "@/components/ui/slot-reel";
import { useAccount } from "@/lib/account/provider";
import { fire, music, sound } from "@/lib/feedback";
import { celebrate } from "@/lib/feedback/celebrate";
import { notify } from "@/lib/notify";
import { PIXEL_COLORS } from "@/lib/pixel-colors";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { cn } from "@/lib/utils";

const USD = 1_000_000n;
const STAKES = LUCKY_STAKES_USD.map((d) => BigInt(d) * USD);
const DEFAULT_STAKE = STAKES[1] ?? USD;
const SIDES = ["Up", "Down"];
/** A reel row's mark: one text line high (the reel measures its rows by a line of text). */
const FACE = 22;
const REACHES = LUCKY_REACHES.map((r) => `${r}×`);
const HUNDRED = 100n;
/** The stagger: each reel stops this long after the draw is known (Owarine's LuckyReels, research 10 §3). */
const FIRST_STOP_MS = 720;
const STOP_GAP_MS = 260;
const STOPS_MS = [FIRST_STOP_MS, FIRST_STOP_MS + STOP_GAP_MS, FIRST_STOP_MS + STOP_GAP_MS * 2] as const;
/** Light, medium, firm: each reel's thunk lands harder. */
const LAND_HAPTICS = ["tick", "snap", "impact"] as const;
const TOP_REACH = LUCKY_REACHES[LUCKY_REACHES.length - 1];
/** The lever's travel when pulled (deg) and its spring back. */
const LEVER_PULL_DEG = 48;
const LEVER_SPRING = { type: "spring", stiffness: 420, damping: 14 } as const;
const tick = () => sound("reelTick");

const multipleText = (e2: bigint) => `${e2 / HUNDRED}.${(e2 % HUNDRED).toString().padStart(2, "0")}×`;

export function LuckyScreen() {
  const account = useAccount();
  const [stake, setStake] = useState<bigint>(DEFAULT_STAKE);
  const [spinId, setSpinId] = useState(0);
  const [landed, setLanded] = useState(0);
  const [stops, setStops] = useState(0);
  const [pulled, setPulled] = useState(false);
  const reduce = useReducedMotion() === true;
  useEffect(() => () => music(null), []);
  const flow = useLuckyFlow(account, {
    cue: (c) =>
      c === "spin"
        ? fire("press", { cue: "reelSpin" })
        : c === "filled"
          ? fire("filled", { cue: "open" })
          : c === "fail"
            ? fire("fail", { cue: "error" })
            : fire(c),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () =>
      notify({
        title: "Sign in to spin",
        description: "Lucky places a real call, so it needs your account.",
        action: { label: "Sign in", onClick: () => openDrawer(DRAWERS.account) },
      }),
  });
  const r = flow.reveal;
  const spinning = flow.phase === "spinning" || (spinId > 0 && landed < spinId);
  const q = flow.dealt ? flow.quoteFor(stake) : null;
  const spin = () => {
    music("games");
    setPulled(true);
    setStops(0);
    setSpinId((n) => n + 1);
    void flow.spin();
  };
  // Each reel's thunk climbs the chord; the third lands the draw, and the top reach rings the jackpot.
  const land = (i: number) => {
    fire(LAND_HAPTICS[i] ?? "snap", { ladder: ["reelLock", i] });
    setStops((n) => n + 1);
    if (i === STOPS_MS.length - 1) {
      setLanded(spinId);
      if (r?.reach === TOP_REACH) {
        fire("win", { cue: "jackpot" });
        celebrate();
      }
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Spin" className="flex flex-col gap-5">
        <p className="text-body text-text-2">A sealed draw picks a market, a side and a reach · one real call</p>
        <div className="lucky-machine">
          <div className="lucky-reels">
            <SlotReel
              label="Market"
              items={flow.seal?.markets ?? ["BTC", "ETH", "SOL", "NVDA", "XAU"]}
              target={r ? r.symbol : null}
              spinId={spinId}
              machine
              stopAfterMs={STOPS_MS[0]}
              onTick={tick}
              onLand={() => land(0)}
              face={(symbol) => (
                <span className="flex items-center gap-2">
                  <EntityMark id={marketId(symbol)} size={FACE} decorative />
                  {symbol}
                </span>
              )}
            />
            <SlotReel
              label="Side"
              items={SIDES}
              target={r ? (r.side === "up" ? "Up" : "Down") : null}
              spinId={spinId}
              machine
              stopAfterMs={STOPS_MS[1]}
              onLand={() => land(1)}
              face={(side) => (
                <span className="flex items-center gap-2">
                  <PixelMark name={side === "Up" ? "bull" : "bear"} size={FACE} colors={PIXEL_COLORS} />
                  {side}
                </span>
              )}
            />
            <SlotReel
              label="Reach"
              items={REACHES}
              target={r ? `${r.reach}×` : null}
              spinId={spinId}
              machine
              stopAfterMs={STOPS_MS[2]}
              onLand={() => land(2)}
              face={(reach) => (
                <span className="flex items-center gap-2">
                  <PixelMark name="plate" size={FACE} colors={PIXEL_COLORS} />
                  {reach}
                </span>
              )}
            />
          </div>
          <span aria-hidden className="lucky-payline" />
          <span aria-hidden className="lucky-lights" data-stops={stops} />
          <motion.button
            type="button"
            className="lucky-lever"
            aria-label="Pull the lever to spin"
            disabled={spinning || flow.phase === "placing"}
            onClick={spin}
            animate={{ rotate: pulled && !reduce ? LEVER_PULL_DEG : 0 }}
            transition={LEVER_SPRING}
            onAnimationComplete={() => setPulled(false)}
          >
            <span className="lucky-lever-ball" />
          </motion.button>
        </div>

        {flow.phase === "dealt" && flow.dealt && !spinning ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-card p-4" aria-live="polite">
            <span className="text-meta text-text-3">The deal</span>
            <span className="font-semibold text-section-title">
              {flow.dealt.symbol} · {lane(flow.dealt.cadenceSec)} · {luckyBandWord(flow.dealt.band)}
            </span>
            <span className="tnum text-body text-text-2">
              {q
                ? `Pays ${multipleText(q.multipleE2)} now · ${usd(q.payout)} on ${usd(stake)}`
                : "Not priced right now"}{" "}
              · calls close in {clockText(Math.max(0, flow.window.closesIn))}
            </span>
            {q?.drifted ? (
              <span className="text-meta text-text-2">The price moved since the deal · this is what it pays now</span>
            ) : null}
          </div>
        ) : flow.phase === "nothing" && !spinning ? (
          <p className="text-body text-text-2" role="status">
            Nothing on {r?.symbol} has room to call right now · spin again
          </p>
        ) : flow.phase === "placed" ? (
          <div className="flex flex-col gap-1 rounded-2xl bg-card p-4" aria-live="polite">
            <span className="font-semibold text-section-title">Placed</span>
            <span className="text-body text-text-2">
              It pays out on its own when the window closes ·{" "}
              <Link href="/app/calls/" className="underline">
                see it in Calls
              </Link>
            </span>
          </div>
        ) : null}

        <fieldset className="m-0 flex min-w-0 gap-2 border-0 p-0">
          <legend className="sr-only">Stake</legend>
          {STAKES.map((v) => (
            <button
              key={v.toString()}
              type="button"
              aria-pressed={stake === v}
              onClick={() => {
                fire("tick", { cue: "tap" });
                setStake(v);
              }}
              className={cn(
                "h-10 flex-1 rounded-lg font-semibold text-button-compact transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring",
                stake === v ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent",
              )}
            >
              {usd(v).replace(".00", "")}
            </button>
          ))}
        </fieldset>

        {flow.phase === "dealt" && !spinning ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={spin}
              className="h-14 rounded-xl bg-secondary font-semibold text-button transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Spin again
            </button>
            <button
              type="button"
              disabled={!q}
              onClick={() => void flow.place(stake)}
              className="h-14 rounded-xl bg-primary font-semibold text-button text-primary-foreground transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              Call it · {usd(stake)}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={spinning || flow.phase === "placing"}
            onClick={spin}
            className="h-14 rounded-xl bg-primary font-semibold text-button text-primary-foreground transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            {spinning ? "Spinning…" : flow.phase === "placing" ? "Placing…" : "Spin"}
          </button>
        )}

        {r && flow.seal ? <Proof flow={flow} /> : null}
      </section>

      <section aria-label="Your draws" className="flex flex-col gap-2 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-section-title">Your draws</h2>
          <span className="tnum text-meta text-text-2">
            {flow.streak > 0 ? `${flow.streak} in a row` : "No streak yet"}
          </span>
        </div>
        {flow.history.length === 0 ? (
          flow.owner ? (
            <p className="text-body text-text-2">Draws you spin show here.</p>
          ) : (
            <SignInPrompt line="Sign in to spin." compact />
          )
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {flow.history.map((d) => (
              <li key={d.drawId} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-row-title">
                  <EntityMark id={marketId(d.symbol)} size={FACE} decorative />
                  <span className="truncate">
                    {d.symbol} · {d.side === "up" ? "Up" : "Down"} · {d.reach}×
                  </span>
                </span>
                <span className="text-meta text-text-3">{d.ticketId === null ? "not called" : "called"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Proof({ flow }: { flow: ReturnType<typeof useLuckyFlow> }) {
  const r = flow.reveal;
  const s = flow.seal;
  if (!r || !s) return null;
  return (
    <details className="flex flex-col gap-1 text-meta text-text-2">
      <summary className="flex cursor-pointer items-center gap-1">
        {flow.verified ? (
          <Check aria-hidden className="size-3.5 text-up" />
        ) : (
          <X aria-hidden className="size-3.5 text-down" />
        )}
        {flow.verified ? "Sealed before your seed · re-hashed here: matches" : "The proof doesn't match"}
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-text-3">Seal</dt>
        <dd className="truncate font-mono">{s.commitment}</dd>
        <dt className="text-text-3">Server seed</dt>
        <dd className="truncate font-mono">{r.serverSeed}</dd>
        <dt className="text-text-3">Your seed</dt>
        <dd className="truncate font-mono">{r.clientSeed}</dd>
        <dt className="text-text-3">Draw</dt>
        <dd className="truncate font-mono">{r.digest}</dd>
        <dt className="text-text-3">Markets</dt>
        <dd>{s.markets.join(", ")}</dd>
      </dl>
    </details>
  );
}
