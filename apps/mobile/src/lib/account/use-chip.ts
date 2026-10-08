import { type ChipState, chipState } from "@senryo/account";
import { useEffect, useRef, useState } from "react";
import { fire } from "~/feedback/fire";
import { CHIP_TICK_MS, UNLOCK_WORD } from "~/lib/constants/auth";
import { useAccount } from "./provider";

export { UNLOCK_WORD };

/** The session chip, re-evaluated once a second while unlocked; a `warn` haptic when it enters the last minute (F04). */
export function useChip(): ChipState {
  const { snapshot } = useAccount();
  const [now, setNow] = useState(() => Date.now());
  const warned = useRef(false);
  useEffect(() => {
    warned.current = false;
    if (snapshot.status !== "unlocked") return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), CHIP_TICK_MS);
    return () => clearInterval(id);
  }, [snapshot]);
  const chip = chipState(snapshot, now, UNLOCK_WORD);
  useEffect(() => {
    if (chip.tone === "warning" && !warned.current) {
      warned.current = true;
      fire("warn");
    }
  }, [chip.tone]);
  return chip;
}
