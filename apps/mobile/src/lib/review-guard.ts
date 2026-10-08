import { createReviewLease } from "@senryo/query";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
/** Changes, unmounts and background interruptions invalidate the original asynchronous review. */
export function useReviewGuard(intent: string) {
  const [, render] = useState(0);
  const lease = useRef(createReviewLease(intent));
  lease.current.update(intent);
  useEffect(() => {
    lease.current.mount();
    const listener = AppState.addEventListener("change", (state) => {
      // Native authentication can briefly make iOS inactive; a real background interrupts review.
      if (state === "background") {
        lease.current.interrupt();
        render((generation) => generation + 1);
      }
    });
    return () => {
      lease.current.unmount();
      listener.remove();
    };
  }, []);
  return lease.current.capture();
}
