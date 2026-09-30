"use client";

import { type ChipState, chipState } from "@senryo/account";
import { useEffect, useState } from "react";
import { CHIP_TICK_MS } from "@/lib/constants/auth";
import { useAccount } from "./provider";

/** The session chip, re-evaluated once a second while unlocked (spec client.md chip states; web says PASSKEY). */
export function useChip(): ChipState {
  const { snapshot } = useAccount();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (snapshot.status !== "unlocked") return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), CHIP_TICK_MS);
    return () => clearInterval(id);
  }, [snapshot]);
  return chipState(snapshot, now, "PASSKEY");
}
