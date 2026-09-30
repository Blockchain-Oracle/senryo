"use client";

// 21st: manuarora700/encrypted-text (#18575) — https://21st.dev/@manuarora700/components/encrypted-text (Aceternity).
// Used for the recovery-phrase reveal after the step-up: each word decrypts in place. D2 re-tokenized: mono, muted
// scramble → foreground; fast (desk timing, not the demo's 50 ms/char); starts on mount, not on scroll; static under
// reduced motion; scramble glyphs come from crypto.getRandomValues (no Math.random next to a secret).
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const DEFAULT_REVEAL_MS = 18;
const DEFAULT_FLIP_MS = 40;

function randomChar(): string {
  const slot = new Uint8Array(1);
  crypto.getRandomValues(slot);
  return CHARSET.charAt((slot[0] ?? 0) % CHARSET.length);
}

const scramble = (text: string) => Array.from(text, (ch) => (ch === " " ? " " : randomChar()));

export interface EncryptedTextProps {
  text: string;
  className?: string;
  /** ms between revealing successive characters. */
  revealDelayMs?: number;
  /** ms between scramble flips of the unrevealed characters. */
  flipDelayMs?: number;
  /** Stagger the start (e.g. word index × a few ms) so a grid decrypts as a wave. */
  startDelayMs?: number;
}

export function EncryptedText({
  text,
  className,
  revealDelayMs = DEFAULT_REVEAL_MS,
  flipDelayMs = DEFAULT_FLIP_MS,
  startDelayMs = 0,
}: EncryptedTextProps) {
  const reduced = useReducedMotion() === true;
  const [revealed, setRevealed] = useState(reduced ? text.length : 0);
  const chars = useRef<string[]>(scramble(text));

  useEffect(() => {
    if (reduced) {
      setRevealed(text.length);
      return;
    }
    chars.current = scramble(text);
    setRevealed(0);
    let frame = 0;
    let cancelled = false;
    const start = performance.now() + startDelayMs;
    let lastFlip = start;
    const tick = (now: number) => {
      if (cancelled) return;
      const count = now < start ? 0 : Math.min(text.length, Math.floor((now - start) / Math.max(1, revealDelayMs)));
      setRevealed(count);
      if (count >= text.length) return;
      if (now - lastFlip >= flipDelayMs) {
        for (let i = count; i < text.length; i += 1) chars.current[i] = text[i] === " " ? " " : randomChar();
        lastFlip = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [text, reduced, revealDelayMs, flipDelayMs, startDelayMs]);

  return (
    <span className={cn("font-mono", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {Array.from(text, (ch, i) => (
          <span key={i} className={i < revealed ? "text-foreground" : "text-muted-foreground"}>
            {i < revealed ? ch : (chars.current[i] ?? ch)}
          </span>
        ))}
      </span>
    </span>
  );
}
