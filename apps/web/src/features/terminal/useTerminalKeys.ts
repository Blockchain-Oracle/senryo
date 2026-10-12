"use client";
/**
 * The terminal's keys (R5.9, D-308): ↑ the first button (Up, Range, Moonshot), ↓ the second (Down, Crash), C closes —
 * when nothing else holds the keyboard. In Real they act only while one-tap is on (no prompt-free money without it);
 * Practice keeps them always (Mitoshi RV-09). Without one-tap in Real a key says why, once.
 */
import { useOneTap } from "@senryo/calls/react";
import { useEffect, useRef } from "react";
import { shortcutBlocked } from "@/components/shell/Rail";
import { useAccount } from "@/lib/account/provider";
import { activeNetwork } from "@/lib/network";
import { notify } from "@/lib/notify";

export interface KeyTargets {
  holding: boolean;
  trading: boolean;
  open: (slot: 0 | 1) => void;
  close: () => void;
}

export function useTerminalKeys(targets: KeyTargets) {
  const oneTap = useOneTap(useAccount());
  const now = useRef({ targets, on: oneTap.state.on });
  now.current = { targets, on: oneTap.state.on };
  const told = useRef(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (shortcutBlocked(event)) return;
      const { targets: t, on } = now.current;
      const up = event.key === "ArrowUp";
      const down = event.key === "ArrowDown";
      const close = event.key.toLowerCase() === "c";
      const acts = (!t.holding && t.trading && (up || down)) || (t.holding && close);
      if (!acts) return;
      event.preventDefault();
      if (activeNetwork().key === "mainnet" && !on) {
        if (!told.current)
          notify({ title: "Keys need one-tap in Real", description: "Turn on one-tap, or use the buttons." });
        told.current = true;
        return;
      }
      if (close) t.close();
      else t.open(up ? 0 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
