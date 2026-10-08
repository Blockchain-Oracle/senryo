import { type ConfirmedFeedback, confirmedFeedback, subscribeOperations } from "@senryo/query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { fire } from "~/feedback/fire";
import { prepareSounds, releaseSounds } from "~/feedback/sound";
import { storage } from "~/lib/storage";

function consume(feedback: ConfirmedFeedback, live = true) {
  const key = `senryo.feedback.v2:${feedback.key}`;
  if (storage.getBoolean(key)) return;
  storage.set(key, true);
  if (!live || AppState.currentState !== "active") return;
  fire("filled", { sound: feedback.semantic });
}

/** Operation outcomes own feedback; mounting a historical receipt never replays it. */
export function FeedbackHost() {
  useEffect(() => {
    void prepareSounds();
    const unsubscribe = subscribeOperations((record, live) => {
      for (const feedback of confirmedFeedback(record)) consume(feedback, live);
    });
    return () => {
      unsubscribe();
      releaseSounds();
    };
  }, []);
  return null;
}
