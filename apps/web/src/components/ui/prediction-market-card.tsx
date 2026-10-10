"use client";
/**
 * 21st:isaiahbjork/prediction-market-card (#2537), retokenized and made true: a yes/no question with its pool, each
 * side's stakes, Yes's share as a split bar, and Yes / No; choosing a side slides the call view up inside the card (an
 * exact amount, presets, what it would pay with the pools as they are) and Confirm places it. Changes from the source:
 * the pools and the share are the book's (no simulated votes), no badges or bordered boxes (a surface one step above
 * its ground), rounded-rectangle buttons with the 0.97 press, an exact amount in dollars and cents (never truncated),
 * both sides' marks, the call's receipt in place of the form once it lands, and the closing bar counts to the close.
 */
import { formatUnits, parseUnits } from "@senryo/core";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 300, damping: 30, mass: 0.8 } as const;
/** The question behind the call view: lifted, dimmed and shrunk (the source's values). */
const BEHIND = { y: -20, opacity: 0.3, scale: 0.95 } as const;
const FRONT = { y: 0, opacity: 1, scale: 1 } as const;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const PERCENT = 100;
const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

export interface PredictionCallView {
  title: ReactNode;
  lines: readonly ReactNode[];
  /** "Call again" and the like. */
  action?: { label: string; onClick: () => void };
}

export function PredictionMarketCard(p: {
  /** The two sides' marks, home first. */
  marks: ReactNode;
  meta: ReactNode;
  question: ReactNode;
  /** The countdown to the close while calls are taken; null once closed. */
  clock: string | null;
  /** What's left of the calling time, 1 → 0 (the bar under the card). */
  closing: number;
  pools: { yes: bigint; no: bigint };
  calls: number;
  /** While calls are taken; else `status` says where it stands. */
  open: boolean;
  status: ReactNode;
  /** The side the question was decided for (it stays lit once settled). */
  answer?: boolean | null;
  limits: { min: bigint; max: bigint };
  presets: readonly bigint[];
  balance: bigint | undefined;
  /** "Pays about $18.40 if Yes wins now" for a stake on a side. */
  estimate: (yes: boolean, stake: bigint) => ReactNode;
  busy: string | null;
  /** Places the call; resolves true once it is on chain (the receipt then shows). */
  onConfirm: (yes: boolean, stake: bigint) => Promise<boolean>;
  receipt: PredictionCallView | null;
  /** Why calling isn't possible here (not deployed, signed out…); null when it is. */
  blocked?: string | null;
}) {
  const reduce = useReducedMotion();
  const [side, setSide] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const total = p.pools.yes + p.pools.no;
  const share = total === 0n ? null : Number((p.pools.yes * BigInt(PERCENT)) / total);
  const parsed = parseUnits(text === "" ? "0" : text, DOLLAR_DECIMALS);
  const stake = parsed.ok ? parsed.value : 0n;
  const problem = !parsed.ok
    ? "Dollars and cents only"
    : stake === 0n
      ? null
      : stake < p.limits.min
        ? `At least ${usd(p.limits.min)}`
        : stake > p.limits.max
          ? `At most ${usd(p.limits.max)}`
          : p.balance !== undefined && stake > p.balance
            ? "More than your balance"
            : null;
  const ready = side !== null && stake > 0n && problem === null && p.busy === null;
  const showForm = side !== null || p.receipt !== null;

  const choose = (yes: boolean) => {
    fire("tick", { cue: "tap" });
    setSide(yes);
  };
  const back = () => {
    setSide(null);
    setText("");
  };
  const confirm = async () => {
    if (side === null || !ready) return;
    if (await p.onConfirm(side, stake)) back();
  };

  return (
    <article className="relative overflow-hidden rounded-2xl bg-card">
      <motion.div
        animate={reduce ? {} : showForm ? BEHIND : FRONT}
        transition={SPRING}
        className="flex flex-col gap-4 p-4"
        aria-hidden={showForm}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-meta text-text-3">{p.meta}</span>
          {p.clock ? <span className="tnum font-semibold text-meta text-foreground">{p.clock}</span> : null}
        </div>
        <div className="flex items-start gap-3">
          <div className="flex shrink-0 -space-x-2">{p.marks}</div>
          <h3 className="font-semibold text-row-title leading-snug">{p.question}</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Figure label="Pool" value={usd(total)} />
          <Figure label="On Yes" value={usd(p.pools.yes)} tone="up" />
          <Figure label="On No" value={usd(p.pools.no)} tone="down" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="tnum font-semibold text-section-title text-up">{share === null ? "—" : `${share}%`}</span>
            <span className="tnum text-meta text-text-3">
              {p.calls === 1 ? "1 call" : `${p.calls} calls`} · share of stakes
            </span>
            <span className="tnum font-semibold text-section-title text-down">
              {share === null ? "—" : `${PERCENT - share}%`}
            </span>
          </div>
          <div
            className={cn("relative h-3 overflow-hidden rounded-sm", share === null ? "bg-secondary" : "bg-down")}
            role="img"
            aria-label={share === null ? "Nothing staked yet" : `${share}% of stakes on Yes`}
          >
            {share === null ? null : (
              <>
                <div
                  className="absolute inset-y-0 left-0 bg-up transition-[width] duration-500 ease-out"
                  style={{ width: `${share}%` }}
                />
                <div
                  aria-hidden
                  className="absolute -top-1/4 h-[150%] w-2 bg-card"
                  style={{ left: `${share}%`, transform: "translateX(-100%) skewX(-15deg)" }}
                />
              </>
            )}
          </div>
        </div>
        {p.open ? (
          <div className="grid grid-cols-2 gap-3">
            <SideButton yes onClick={() => choose(true)} disabled={Boolean(p.blocked)} answer={p.answer} />
            <SideButton yes={false} onClick={() => choose(false)} disabled={Boolean(p.blocked)} answer={p.answer} />
          </div>
        ) : null}
        <p className="min-h-5 text-meta text-text-2" role="status">
          {p.open && p.blocked ? p.blocked : p.status}
        </p>
      </motion.div>

      <AnimatePresence>
        {showForm ? (
          <motion.div
            key="call"
            initial={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            transition={SPRING}
            className="absolute inset-0 flex flex-col gap-4 bg-card p-4"
          >
            {p.receipt ? (
              <Receipt receipt={p.receipt} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={back}
                    className="flex items-center gap-2 rounded-md text-meta text-text-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <ArrowLeft aria-hidden className="size-4" />
                    Back
                  </button>
                  {p.clock ? <span className="tnum font-semibold text-meta text-foreground">{p.clock}</span> : null}
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-meta text-text-3">Your call</span>
                  <span className={cn("font-semibold text-section-title", side ? "text-up" : "text-down")}>
                    {side ? "Yes" : "No"}
                  </span>
                </div>
                <label className="relative block">
                  <span className="sr-only">Stake in dollars</span>
                  <span className="absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-section-title text-text-3">
                    $
                  </span>
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    value={text}
                    onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="0.00"
                    className="tnum h-14 w-full rounded-xl bg-secondary pr-4 pl-10 font-semibold text-section-title outline-none focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {p.presets.map((v) => (
                    <button
                      key={v.toString()}
                      type="button"
                      aria-pressed={stake === v}
                      onClick={() => {
                        fire("tick", { cue: "tap" });
                        setText(formatUnits(v, DOLLAR_DECIMALS, CENTS));
                      }}
                      className={cn(
                        "h-10 rounded-lg font-semibold text-button-compact transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring",
                        stake === v ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent",
                      )}
                    >
                      {usd(v).replace(".00", "")}
                    </button>
                  ))}
                </div>
                <p className="min-h-5 text-meta text-text-2" role="status" aria-live="polite">
                  {p.busy ??
                    problem ??
                    (side !== null && stake > 0n ? p.estimate(side, stake) : "Pick or type a stake")}
                </p>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => void confirm()}
                  className={cn(
                    "mt-auto h-14 rounded-xl font-semibold text-button transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                    side ? "bg-up text-up-foreground" : "bg-down text-down-foreground",
                  )}
                >
                  {p.busy ?? `Call ${side ? "Yes" : "No"}${stake > 0n ? ` · ${usd(stake)}` : ""}`}
                </button>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="h-1 bg-secondary" aria-hidden>
        <div
          className="h-full bg-down transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.round(Math.max(0, Math.min(1, p.closing)) * PERCENT)}%` }}
        />
      </div>
    </article>
  );
}

function Figure(p: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-meta text-text-3">{p.label}</span>
      <span
        className={cn(
          "tnum truncate font-semibold text-row-title",
          p.tone === "up" ? "text-up" : p.tone === "down" ? "text-down" : "",
        )}
      >
        {p.value}
      </span>
    </div>
  );
}

function SideButton(p: { yes: boolean; onClick: () => void; disabled: boolean; answer?: boolean | null | undefined }) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled}
      className={cn(
        "h-14 rounded-xl font-semibold text-button transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
        p.yes ? "bg-up text-up-foreground" : "bg-down text-down-foreground",
      )}
    >
      {p.yes ? "Yes" : "No"}
    </button>
  );
}

function Receipt({ receipt }: { receipt: PredictionCallView }) {
  return (
    <div className="flex h-full flex-col gap-3" aria-live="polite">
      <span className="font-semibold text-section-title">{receipt.title}</span>
      <ul className="flex flex-col gap-1">
        {receipt.lines.map((line, i) => (
          <li key={i} className="text-meta text-text-2">
            {line}
          </li>
        ))}
      </ul>
      {receipt.action ? (
        <button
          type="button"
          onClick={receipt.action.onClick}
          className="mt-auto h-14 rounded-xl bg-secondary font-semibold text-button transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {receipt.action.label}
        </button>
      ) : null}
    </div>
  );
}
