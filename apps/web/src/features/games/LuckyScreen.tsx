"use client";
import { luckyBandWord, useLuckyFlow } from "@senryo/calls/react";
import { LUCKY_STAKES_USD } from "@senryo/config";
/**
 * Lucky (S8.8, D-295; Owarine's Lucky; `/app/games/lucky/`): three reels — market, side, reach — land on a draw sealed
 * before your own seed existed; the deal is the running window and band on that side whose payout is nearest the reach,
 * priced live. One tap places it as an ordinary call. The proof (the seal re-hashed in the browser) and your draws with
 * the streak sit below.
 */
import { clockText, LUCKY_REACHES, lane, usd } from "@senryo/core";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SlotReel } from "@/components/ui/slot-reel";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { cn } from "@/lib/utils";

const USD = 1_000_000n;
const STAKES = LUCKY_STAKES_USD.map((d) => BigInt(d) * USD);
const DEFAULT_STAKE = STAKES[1] ?? USD;
const SIDES = ["Up", "Down"];
const REACHES = LUCKY_REACHES.map((r) => `${r}×`);
const HUNDRED = 100n;

const multipleText = (e2: bigint) => `${e2 / HUNDRED}.${(e2 % HUNDRED).toString().padStart(2, "0")}×`;

export function LuckyScreen() {
  const account = useAccount();
  const [stake, setStake] = useState<bigint>(DEFAULT_STAKE);
  const [spinId, setSpinId] = useState(0);
  const [landed, setLanded] = useState(0);
  const flow = useLuckyFlow(account, {
    cue: (c) =>
      c === "spin" ? fire("tick", { cue: "tap" }) : c === "filled" ? fire("filled", { cue: "open" }) : fire(c),
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
    setSpinId((n) => n + 1);
    void flow.spin();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Spin" className="flex flex-col gap-5">
        <p className="text-body text-text-2">A sealed draw picks a market, a side and a reach · one real call</p>
        <div className="grid grid-cols-3 gap-3">
          <SlotReel
            label="Market"
            items={flow.seal?.markets ?? ["BTC", "ETH", "SOL", "NVDA", "XAU"]}
            target={r ? r.symbol : null}
            spinId={spinId}
            onLand={() => setLanded(spinId)}
          />
          <SlotReel label="Side" items={SIDES} target={r ? (r.side === "up" ? "Up" : "Down") : null} spinId={spinId} />
          <SlotReel label="Reach" items={REACHES} target={r ? `${r.reach}×` : null} spinId={spinId} />
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
          <p className="text-body text-text-2">{flow.owner ? "Draws you spin show here." : "Sign in to spin."}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {flow.history.map((d) => (
              <li key={d.drawId} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-row-title">
                  {d.symbol} · {d.side === "up" ? "Up" : "Down"} · {d.reach}×
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
