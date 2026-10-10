"use client";
/**
 * The app's splash (R2.17; Owarine's `Splash.tsx`, Tradash's 1.4 s / 3.5 s): on the first load of any `/app` page the
 * seal settles in and a rising line draws while the page loads; it lifts once the window has loaded and 1.4 s have
 * passed, or at 3.5 s. Later navigations never bring it back; reduced motion keeps the seal and drops the line. It is
 * static HTML until the page's script runs, so CSS lifts it at the cap on its own (`.app-splash`): a slow or failed
 * script never leaves the app covered.
 */
import { MOTION } from "@senryo/tokens";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

const MIN_MS = 1_400;
const MAX_MS = 3_500;
const SEAL = 96;
const LOOP = { duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } as const;
/** The line's resting opacity, and the head dot's resting scale, between beats. */
const DIM = 0.4;
const SMALL = 0.6;
/** The seal settles from just under full size, on the app's own ease (`MOTION.easing`). */
const SETTLE_FROM = 0.9;
const SETTLE_S = 0.45;
/** A rising close, seven prints, in a 160 × 44 box. */
const PATH = "M4 36 L26 28 L50 32 L72 18 L98 24 L122 10 L156 13";

function Sparkline() {
  return (
    <svg width="160" height="44" viewBox="0 0 160 44" fill="none" className="overflow-visible text-accent" aria-hidden>
      <motion.path
        d={PATH}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: DIM }}
        animate={{ pathLength: [0, 1, 1], opacity: [DIM, 1, DIM] }}
        transition={LOOP}
      />
      <motion.circle
        cx={156}
        cy={13}
        r={4}
        fill="currentColor"
        initial={{ opacity: 0, scale: SMALL }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [SMALL, SMALL, 1, 1, SMALL] }}
        transition={LOOP}
      />
    </svg>
  );
}

export function Splash() {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const started = performance.now();
    let lifted = false;
    const lift = () => {
      if (lifted) return;
      lifted = true;
      window.setTimeout(() => setShown(false), Math.max(0, MIN_MS - (performance.now() - started)));
    };
    if (document.readyState === "complete") lift();
    else window.addEventListener("load", lift, { once: true });
    const cap = window.setTimeout(lift, MAX_MS);
    return () => {
      window.removeEventListener("load", lift);
      window.clearTimeout(cap);
    };
  }, []);

  return (
    <AnimatePresence>
      {shown ? (
        <motion.div
          key="splash"
          role="status"
          aria-label="Loading Senryo"
          className="app-splash fixed inset-0 z-[9900] flex flex-col items-center justify-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.div
            initial={{ scale: SETTLE_FROM, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: SETTLE_S, ease: [...MOTION.easing] }}
            className="flex flex-col items-center gap-3 motion-reduce:!transform-none motion-reduce:!opacity-100"
          >
            <Image src="/brand/seal.svg" width={SEAL} height={SEAL} alt="" priority />
            <span className="font-display text-page-title tracking-[0.08em]">SENRYO</span>
          </motion.div>
          <div className="mt-7 motion-reduce:hidden">
            <Sparkline />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
