"use client";
import { useTerminalReady } from "@senryo/calls/react";
/**
 * Tradash's two trade buttons (Owarine `TradeButtons`, Codex direction 11 §3, R5.5) in Senryo's direction plates.
 * - Entry: UP / DOWN (or RANGE alone, MOONSHOT / CRASH) with a line under each — a call's "Pays 2.14× · $10.70", a
 *   ride's "Knocked out at $80,431".
 * - Held: TRAIL and CLOSE. TRAIL is muted with "Need +0.08% to trail" until it qualifies, then arms in one tap;
 *   armed, TRAILING shows its stop. CLOSE always carries the exact amount it returns, rolling. Holding CLOSE closes
 *   part; holding TRAIL opens the full exit.
 * The pair cross-fades (y 12 → 0, 180 ms on `[0.22, 1, 0.36, 1]`); reduced motion only fades.
 */
import { ArrowDown, ArrowUp, ArrowUpRight, LoaderCircle, MoveVertical, Rocket, TrendingDown, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ComponentType, ReactNode } from "react";
import { LiveText } from "@/components/kit/live-text";
import { Odometer, viewDollars } from "@/components/ui/odometer";
import { EASE_OUT } from "@/lib/constants/motion";
import type { LiveValue } from "@/lib/terminal/live-value";
import { useLiveValue } from "@/lib/terminal/live-value";
import { cn } from "@/lib/utils";
import type { CashOutFigure } from "./useLiveQuote";
import { useLongPress } from "./useLongPress";
import "./trade-buttons.css";

const SWAP = 0.18;
const RISE = 12;

export type Side = { kind: "up" | "down" | "range" | "moonshot" | "crash"; label: string; line: LiveValue<string> };

export interface TrailView {
  armed: boolean;
  ready: boolean;
  caption: string;
}

const ICON: Readonly<Record<Side["kind"], ComponentType<{ className?: string; strokeWidth?: number }>>> = {
  up: ArrowUp,
  down: ArrowDown,
  range: MoveVertical,
  moonshot: Rocket,
  crash: TrendingDown,
};
const TONE: Readonly<Record<Side["kind"], string>> = {
  up: "is-up",
  moonshot: "is-up",
  down: "is-down",
  crash: "is-down",
  range: "is-neutral",
};

export type TradeButtonsProps = { instrument: "call" | "ride" } & (
  | {
      mode: "entry";
      sides: readonly [Side] | readonly [Side, Side];
      disabled: boolean;
      onPick: (slot: 0 | 1) => void;
      onPreview: (slot: 0 | 1 | null) => void;
    }
  | {
      mode: "held";
      closeWord: string;
      close: LiveValue<CashOutFigure>;
      trail: LiveValue<TrailView | null>;
      busy: "close" | "trail" | null;
      /** Why the close is held (the lockout, a pending fill), or null. */
      held: string | null;
      onClose: () => void;
      onClosePart?: () => void;
      onTrail: () => void;
      onExit?: () => void;
    }
);

function EntryButton({
  side,
  slot,
  disabled,
  onPick,
  onPreview,
}: {
  side: Side;
  slot: 0 | 1;
  disabled: boolean;
  onPick: (slot: 0 | 1) => void;
  onPreview: (slot: 0 | 1 | null) => void;
}) {
  const Icon = ICON[side.kind];
  // A link (search's Up / Down, D-340) asked for this side: lit a few seconds, never pressed.
  const ready = useTerminalReady().side === side.kind;
  return (
    <div className="trade-slot">
      <button
        type="button"
        className={cn("terminal-call", TONE[side.kind], ready && "is-ready")}
        disabled={disabled}
        onClick={() => onPick(slot)}
        onPointerEnter={() => onPreview(slot)}
        onPointerLeave={() => onPreview(null)}
        onFocus={() => onPreview(slot)}
        onBlur={() => onPreview(null)}
        aria-keyshortcuts={slot === 0 ? "ArrowUp" : "ArrowDown"}
      >
        <Icon aria-hidden className="size-4.5" strokeWidth={3} />
        {side.label}
      </button>
      <LiveText value={side.line} className="terminal-call-pays tnum" />
    </div>
  );
}

function CloseButton({
  word,
  close,
  busy,
  disabled,
  onClose,
  onPart,
}: {
  word: string;
  close: LiveValue<CashOutFigure>;
  busy: boolean;
  disabled: boolean;
  onClose: () => void;
  onPart: (() => void) | undefined;
}) {
  // A link selected this position (D-340, D-343): its close ringed for a few seconds, never pressed.
  const ready = useTerminalReady().position !== null;
  const figure = useLiveValue(close);
  const press = useLongPress(onClose, onPart);
  const off = disabled || busy || figure.units === null;
  return (
    <button
      type="button"
      className={cn("trade-close", ready && "is-ready")}
      disabled={off}
      aria-keyshortcuts="C"
      {...press}
    >
      {busy ? (
        <LoaderCircle aria-hidden className="size-5 animate-spin" />
      ) : (
        <X aria-hidden className="size-5" strokeWidth={3} />
      )}
      <span className="trade-close-words">
        <span>{word}</span>
        {figure.units === null ? (
          <span className="trade-close-value">—</span>
        ) : (
          <Odometer value={viewDollars(figure.units)} sensitive className="trade-close-value" />
        )}
      </span>
    </button>
  );
}

function TrailButton({
  trail,
  busy,
  disabled,
  onTrail,
  onExit,
}: {
  trail: LiveValue<TrailView | null>;
  busy: boolean;
  disabled: boolean;
  onTrail: () => void;
  onExit: (() => void) | undefined;
}) {
  const t = useLiveValue(trail);
  const press = useLongPress(t?.armed ? (onExit ?? onTrail) : onTrail, onExit);
  const off = disabled || busy || !t || (!t.armed && !t.ready);
  return (
    <div className="trade-slot">
      <button
        type="button"
        aria-pressed={t?.armed ?? false}
        className={cn("trade-trail", t?.armed && "is-armed")}
        disabled={off}
        {...press}
      >
        {busy ? (
          <LoaderCircle aria-hidden className="size-5 animate-spin" />
        ) : (
          <ArrowUpRight aria-hidden className="size-5" strokeWidth={3} />
        )}
        {busy ? "ARMING…" : t?.armed ? "TRAILING" : "TRAIL"}
      </button>
      <span className="terminal-call-pays tnum">{t?.caption ?? ""}</span>
    </div>
  );
}

export function TradeButtons(props: TradeButtonsProps) {
  const reduce = useReducedMotion();
  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: SWAP } }
    : {
        initial: { opacity: 0, y: RISE },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -RISE },
        transition: { duration: SWAP, ease: EASE_OUT },
      };
  let body: ReactNode;
  if (props.mode === "entry") {
    body = (
      <motion.div
        key={`${props.instrument}-entry`}
        className={cn("trade-pair", props.sides.length === 1 && "is-one")}
        {...fade}
      >
        {props.sides.map((side, i) => (
          <EntryButton
            key={side.kind}
            side={side}
            slot={i as 0 | 1}
            disabled={props.disabled}
            onPick={props.onPick}
            onPreview={props.onPreview}
          />
        ))}
      </motion.div>
    );
  } else {
    body = (
      <motion.div key={`${props.instrument}-held`} className="trade-pair" {...fade}>
        <TrailButton
          trail={props.trail}
          busy={props.busy === "trail"}
          disabled={props.held !== null}
          onTrail={props.onTrail}
          onExit={props.onExit}
        />
        <div className="trade-slot">
          <CloseButton
            word={props.closeWord}
            close={props.close}
            busy={props.busy === "close"}
            disabled={props.held !== null}
            onClose={props.onClose}
            onPart={props.onClosePart}
          />
          <span className="terminal-call-pays">{props.held ?? ""}</span>
        </div>
      </motion.div>
    );
  }
  return (
    <AnimatePresence mode="wait" initial={false}>
      {body}
    </AnimatePresence>
  );
}
