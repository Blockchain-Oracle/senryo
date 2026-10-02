"use client";

/**
 * The API session for the signed-in account as a `SessionRunner` (`@senryo/query`'s social hooks take one): a SIWE
 * session is created on first use — in scope for the trading session, so no prompt while unlocked — and replaced once
 * when the server no longer knows it. Undefined until an account is ready.
 */
import type { SessionRunner } from "@senryo/query";
import { useMemo } from "react";
import { withSession } from "./api";
import { useAccount } from "./provider";

export function useSessionRunner(): SessionRunner | undefined {
  const { client, hint, settings } = useAccount();
  return useMemo<SessionRunner | undefined>(() => {
    if (!client || !hint) return undefined;
    return (run) => withSession(client, settings.faceId, run);
  }, [client, hint, settings.faceId]);
}
