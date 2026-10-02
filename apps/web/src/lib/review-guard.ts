"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The reviewed intent is immutable (money truth rules): a change of the details, an unmount, or the tab being hidden
 * (the web's "app went to background") ends the original review. The returned check throws before a signature when any
 * of those happened since the review was shown, so a stale order is never signed.
 */
export function useReviewGuard(intent: string) {
  const [generation, setGeneration] = useState(0);
  const live = useRef({ intent, mounted: true, generation });
  live.current.intent = intent;
  useEffect(() => {
    live.current.mounted = true;
    const onHide = () => {
      // The passkey sheet keeps the tab visible; leaving the tab ends this review.
      if (document.visibilityState === "hidden") {
        live.current.generation += 1;
        setGeneration(live.current.generation);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      live.current.mounted = false;
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
  return () => {
    if (!live.current.mounted || live.current.intent !== intent || live.current.generation !== generation)
      throw new Error("Details or page state changed. Review again.");
  };
}
