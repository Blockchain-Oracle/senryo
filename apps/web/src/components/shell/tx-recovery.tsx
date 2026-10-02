"use client";

import { useEffect } from "react";

/**
 * TxRecovery on the web (S8.24, the phone's TxRecoveryHost): once per page load, after the account runtime is up,
 * reconcile every journalled send that a closed tab left unfinished — read only, on its own chain, never re-broadcast —
 * so its operation shows its true outcome. The recovery module loads lazily (chain ABIs stay out of the first paint).
 */
export function TxRecovery() {
  useEffect(() => {
    void import("@/lib/account/sender").then(({ recoverJournal }) => recoverJournal()).catch(() => undefined);
  }, []);
  return null;
}
