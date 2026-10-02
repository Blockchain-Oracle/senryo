"use client";

/**
 * The risk explainer (flow book C3 step 3, C3a; the phone's risk-explainer sheet): three facts before the first leveraged
 * trade and a fourth before the first short, accepted with one slide. Pre-approval disclosures are exempt from the
 * copy budget. After accepting, the order is slid again — nothing is sent from here.
 */
import { useCallback, useState } from "react";
import { SlideToConfirm } from "@/components/kit/slide-to-confirm";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { readJson, writeJson } from "@/lib/account/local";
import { TRADE_STORAGE } from "@/lib/constants/ticket";
import type { Side } from "@/lib/trade/commit";

const CARDS = [
  {
    title: "Leverage multiplies gains and losses",
    body: "At 5× a 1% move is 5% of your margin, both ways. Settled in dollars: nothing is delivered.",
  },
  {
    title: "Liquidation",
    body: "If losses reach the maintenance level, the position closes with a 1% fee. The ticket shows the price.",
  },
  {
    title: "Market hours",
    body: "When a market is closed or its price pauses, closing still works; opening waits for the market.",
  },
] as const;

const SHORT_CARD = {
  title: "Short: you profit if the price falls",
  body: "Losses grow if it rises, and liquidation sits above your entry. Shorts receive funding when longs dominate.",
} as const;

const flag = (key: string) => readJson(key, (v) => (v === true ? true : undefined)) ?? false;

export interface PrimerState {
  side: Side | undefined;
  needed: (side: Side) => boolean;
  open: (side: Side) => void;
  close: (accepted: boolean) => void;
  /** Bumps when the primer closes, so the ticket's slide re-arms for the real confirmation. */
  generation: number;
}

export function useRiskPrimer(): PrimerState {
  const [side, setSide] = useState<Side>();
  const [generation, setGeneration] = useState(0);
  const needed = useCallback(
    (s: Side) => !flag(TRADE_STORAGE.riskExplained) || (s === "short" && !flag(TRADE_STORAGE.shortRiskExplained)),
    [],
  );
  const close = useCallback(
    (accepted: boolean) => {
      if (accepted) {
        writeJson(TRADE_STORAGE.riskExplained, true);
        if (side === "short") writeJson(TRADE_STORAGE.shortRiskExplained, true);
      }
      setSide(undefined);
      setGeneration((g) => g + 1);
    },
    [side],
  );
  return { side, needed, open: setSide, close, generation };
}

export function RiskPrimer({ state }: { state: PrimerState }) {
  const side = state.side;
  if (!side) return null;
  const general = !flag(TRADE_STORAGE.riskExplained);
  const cards = [...(general ? CARDS : []), ...(side === "short" ? [SHORT_CARD] : [])];
  return (
    <ResponsiveSheet
      open
      onOpenChange={(open) => {
        if (!open) state.close(false);
      }}
      title={general ? "Before your first trade" : "Before your first short"}
      footer={
        <div className="grid w-full gap-2">
          <SlideToConfirm
            label="Slide to accept"
            tone={side === "short" ? "down" : "primary"}
            resetKey={side}
            onConfirm={() => state.close(true)}
          />
          <Button variant="ghost" className="w-full font-sans" onClick={() => state.close(false)}>
            Not now
          </Button>
        </div>
      }
    >
      <div className="grid gap-2">
        {cards.map((c, i) => (
          <div key={c.title} className="grid gap-1 rounded-md bg-raised-2 p-4">
            <p className="text-meta text-text-3">
              {i + 1} / {cards.length}
            </p>
            <p className="text-row">{c.title}</p>
            <p className="text-meta text-text-2">{c.body}</p>
          </div>
        ))}
      </div>
    </ResponsiveSheet>
  );
}
