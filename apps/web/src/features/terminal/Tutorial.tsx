"use client";
/**
 * The terminal's five-step tour (R5.15; Tradash's tour by way of Owarine's `Tutorial.tsx`, reworded for calls and
 * rides): full screen, progress dashes, Back and Skip; a drawn illustration — the line, UP and DOWN, the line with its
 * PnL pill, a trailing stop, CLOSE — then "Step N", a title and a sentence, with the network named on every step;
 * Next, and on the last step Start. Reduced motion: the line is drawn at once and steps swap without sliding.
 */
import { TOUR_STEPS, tourNote } from "@senryo/calls";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { useQueryEnv } from "@senryo/query";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronLeft, LineChart, Waves, X } from "lucide-react";
import { AnimatePresence, motion, type Transition, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const ICONS = [LineChart, ArrowUp, Waves, ArrowUpRight, X] as const;
const PATH = "M8 120 C 50 110, 70 70, 110 80 S 170 40, 210 52 S 260 30, 292 26";
const DRAW: Transition = { duration: 1.6, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.8 };
const SWAP: Transition = { duration: 0.2 };
const SLIDE_Y = 12;
const STEP = { buttons: 1, pnl: 2, trail: 3, close: 4 } as const;

/** The step's drawing: a line, the two buttons, a line with its PnL pill, a trailing stop, CLOSE. No art files. */
function Illustration({ step }: { step: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-44 w-72 overflow-hidden rounded-2xl bg-secondary">
      {step === STEP.buttons ? (
        <div className="absolute inset-0 flex items-center justify-center gap-3">
          <span className="flex h-12 w-28 items-center justify-center gap-1 rounded-full bg-up font-extrabold text-up-foreground tracking-widest">
            <ArrowUp aria-hidden className="size-4" strokeWidth={3} /> UP
          </span>
          <span className="flex h-12 w-28 items-center justify-center gap-1 rounded-full bg-down font-extrabold text-down-foreground tracking-widest">
            <ArrowDown aria-hidden className="size-4" strokeWidth={3} /> DOWN
          </span>
        </div>
      ) : (
        <svg viewBox="0 0 300 150" className="absolute inset-0 size-full text-up" aria-hidden>
          {step === STEP.trail ? (
            <line x1="8" x2="292" y1="78" y2="78" stroke="currentColor" strokeDasharray="6 4" strokeWidth="1.5" />
          ) : null}
          <motion.path
            d={PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            {...(reduce ? {} : { transition: DRAW })}
          />
          <circle cx="292" cy="26" r="4" fill="currentColor" />
        </svg>
      )}
      {step === STEP.pnl || step === STEP.close ? (
        <span className="tnum absolute top-3 right-3 rounded-full bg-up px-2.5 py-1 font-bold text-meta text-up-foreground">
          +$1.24
        </span>
      ) : null}
      {step === STEP.trail ? (
        <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-up px-3 py-1 font-bold text-meta text-up-foreground">
          <ArrowUpRight aria-hidden className="size-3" /> Trailing
        </span>
      ) : null}
      {step === STEP.close ? (
        <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground px-3 py-1 font-bold text-background text-meta">
          <X aria-hidden className="size-3" /> CLOSE $6.24
        </span>
      ) : null}
    </div>
  );
}

export function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();
  const { chainId } = useQueryEnv();
  const s = TOUR_STEPS[step] ?? TOUR_STEPS[0];
  const Icon = ICONS[step] ?? LineChart;
  const last = step === TOUR_STEPS.length - 1;
  const tap = () => fire("press", { cue: "tap" });
  const finish = () => {
    tap();
    setStep(0);
    onDone();
  };
  return (
    <div
      role="dialog"
      aria-modal
      aria-label="How the terminal works"
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl"
    >
      <header className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0rem)+1rem)]">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => {
            tap();
            setStep(step - 1);
          }}
          className="flex min-h-11 items-center gap-1 text-meta text-text-3 disabled:invisible"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Back
        </button>
        <div className="flex gap-1.5" role="img" aria-label={`Step ${step + 1} of ${TOUR_STEPS.length}`}>
          {TOUR_STEPS.map((t, i) => (
            <span
              key={t.title}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color]",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>
        <button type="button" onClick={finish} className="min-h-11 text-meta text-text-3">
          Skip
        </button>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            className="flex flex-col items-center gap-4"
            initial={reduce ? false : { opacity: 0, y: SLIDE_Y }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -SLIDE_Y }}
            transition={SWAP}
          >
            <Illustration step={step} />
            <span className="flex items-center gap-1.5 font-bold text-meta tracking-widest">
              <Icon aria-hidden className="size-3.5" /> STEP {step + 1}
            </span>
            <h2 className="text-page-title">{s.title}</h2>
            <p className="max-w-sm text-body text-text-2">{s.body}</p>
            <p className="max-w-sm text-meta text-text-3">{tourNote(chainId === TESTNET_CHAIN_ID)}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="flex flex-col gap-2 px-4 pb-[calc(env(safe-area-inset-bottom,0rem)+1rem)]">
        <Button
          size="xl"
          autoFocus
          onClick={() => {
            if (last) return finish();
            tap();
            setStep(step + 1);
          }}
        >
          {last ? "Start" : "Next"}
        </Button>
      </footer>
    </div>
  );
}
