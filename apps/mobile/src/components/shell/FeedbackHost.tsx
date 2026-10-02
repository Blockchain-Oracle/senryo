import { subscribeOperations } from "@senryo/query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { fire } from "~/feedback/fire";
import { prepareSounds, releaseSounds } from "~/feedback/sound";
import { storage } from "~/lib/storage";

/** The event a filled Perpl taker order emits (packages/chain/src/perpl/fills.ts). */
const PERPL_FILL_EVENT = "TakerOrderFilledV2";

/** Operation outcomes own feedback; mounting a historical receipt never replays it. */
export function FeedbackHost() {
  useEffect(() => {
    void prepareSounds();
    const unsubscribe = subscribeOperations((record, live) => {
      if (record.outcome !== "completed" && record.outcome !== "partial") return;
      const step = record.steps.findLast(
        (s) => s.outcome === "completed" && s.hash && !/approve|permit|allowance|trigger|cancel/i.test(s.action),
      );
      if (!step?.hash) return;
      const key = `senryo.feedback.v1:${record.id}:${record.outcome}`;
      if (storage.getBoolean(key)) return;
      storage.set(key, true);
      if (!live || AppState.currentState !== "active") return;
      if (/approve|permit|allowance|trigger|cancel/i.test(step.action)) return;
      // An IOC order on Perpl can finalize without matching anyone: only a decoded fill earns the fill sound.
      if (/^perplOrder$/i.test(step.action) && !step.facts?.some((f) => f.event === PERPL_FILL_EVENT)) return;
      const sound = /deposit|claim|faucet/i.test(step.action)
        ? "deposit"
        : /withdraw|transfer|swap/i.test(step.action)
          ? "send"
          : "fill";
      fire("filled", { sound });
    });
    return () => {
      unsubscribe();
      releaseSounds();
    };
  }, []);
  return null;
}
