/**
 * What the chart and the ear say while a call is open (Tradash's dispatch table, via Owarine's `useChartFeedback`):
 * the reaction engine fed every quote tick (`useLiveQuote`'s readings, so nothing is priced twice) — a favourable
 * step climbs the pentatonic profit ladder with a tick, a second step against it plays the adverse blip, a surge or
 * mega move its flourish and edge glow, a slump the down flourish, and callouts ride the price head. Silent with sounds
 * off (`fire` gates it); the overlay is visual only.
 */
import { type RefObject, useEffect, useRef } from "react";
import { fire } from "~/feedback/fire";
import type { ReactionOverlayHandle } from "./ReactionOverlay";
import { ReactionEngine } from "./reactions";
import type { QuoteTick } from "./useLiveQuote";

const LADDER_TOP = 10;
const ADVERSE_FROM = 2;

export function useReactions(
  symbol: string,
  onTick: (listener: (tick: QuoteTick) => void) => () => void,
  overlay: RefObject<ReactionOverlayHandle | null>,
) {
  const engine = useRef(new ReactionEngine());
  useEffect(() => {
    engine.current.reset();
  }, [symbol]);
  useEffect(
    () =>
      onTick((tick) => {
        for (const r of engine.current.feed(tick)) {
          if (r.kind === "step") {
            if (r.favorable) fire("move", { profit: Math.min(LADDER_TOP, r.count - 1) });
            else if (r.count >= ADVERSE_FROM) fire("move", { cue: "adverse" });
          } else if (r.kind === "surge") {
            if (r.favorable) fire("snap", { cue: r.mega ? "mega" : "surge" });
            else fire("warn", { cue: "slump" });
            overlay.current?.flash(r.favorable, r.mega);
          } else {
            if (r.tone === "warn") fire("warn");
            overlay.current?.callout(r.tone, r.emoji, r.text);
          }
        }
      }),
    [onTick, overlay],
  );
}
