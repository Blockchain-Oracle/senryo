"use client";
/**
 * Practice | Real (D-320, F9; roy-chain's 21st #23552 mode switch for the thumb and keys, Owarine's `environment.ts`
 * for the flood): a 44 px two-segment switch whose thumb springs across, the new mode's colours flooding out from the
 * tap in a growing circle (a view transition, 520 ms) — instant with reduced motion or no view transitions. Real is
 * fully browsable before mainnet: live prices and their graphs; its ticket says trading opens with mainnet.
 */
import { MAINNET, type NetworkKey, TESTNET } from "@senryo/config";
import { ids } from "@senryo/identity";
import { motion, useReducedMotion } from "motion/react";
import { type MouseEvent, useId } from "react";
import { flushSync } from "react-dom";
import { EntityMark } from "@/components/identity/entity-mark";
import { fire } from "@/lib/feedback";
import { setActiveNetwork, useNetwork } from "@/lib/network";
import { cn } from "@/lib/utils";

const CHAIN_MARK = 16;
const FLOOD_MS = 520;
const FLOOD_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const THUMB_SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.45 } as const;
const OPTIONS = [
  { key: "testnet" as const, label: TESTNET.modeLabel, chainId: TESTNET.chainId, hint: "Test dollars" },
  {
    key: "mainnet" as const,
    label: MAINNET.modeLabel,
    chainId: MAINNET.chainId,
    hint: "Live prices · trading opens with mainnet",
  },
];

type ViewTransitionDoc = Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } };

function flood(event: MouseEvent, apply: () => void, reduced: boolean): void {
  const doc = document as ViewTransitionDoc;
  if (reduced || !doc.startViewTransition) {
    apply();
    return;
  }
  const { clientX: x, clientY: y } = event;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const t = doc.startViewTransition(() => flushSync(apply));
  void t.ready.then(() =>
    document.documentElement.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: FLOOD_MS, easing: FLOOD_EASE, pseudoElement: "::view-transition-new(root)" },
    ),
  );
}

export function ModeSwitch({ className }: { className?: string | undefined }) {
  const network = useNetwork();
  const reduced = useReducedMotion() === true;
  const group = useId();
  const pick = (key: NetworkKey, event: MouseEvent) => {
    if (key === network.key) return;
    fire("snap", { cue: "toggle" });
    flood(event, () => setActiveNetwork(key), reduced);
  };
  return (
    <fieldset aria-label="Mode" className={cn("mode-switch", className)}>
      {OPTIONS.map((o) => {
        const on = o.key === network.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            title={o.hint}
            className={cn("mode-switch-option", on && "is-on")}
            onClick={(e) => pick(o.key, e)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const next = OPTIONS.find((x) => x.key !== o.key);
              if (next) setActiveNetwork(next.key);
            }}
          >
            {on ? (
              <motion.span
                layoutId={`${group}-thumb`}
                className="mode-switch-thumb"
                transition={reduced ? { duration: 0 } : THUMB_SPRING}
              />
            ) : null}
            <span className="mode-switch-label">
              <EntityMark id={ids.evmChain(o.chainId)} size={CHAIN_MARK} decorative />
              {o.label}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
