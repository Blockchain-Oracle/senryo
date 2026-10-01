import { networkOf } from "@senryo/config";
import { keys } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { type Recovered, recoverJournal } from "~/lib/account/sender";
import { notify } from "~/lib/notify";

/** While a journaled tx is still unresolved, look again this often. */
const RECOVERY_POLL_MS = 5_000;

/** What the user called it (gas action → words); anything else is "transaction". */
const ACTION_LABEL: Readonly<Record<string, string>> = {
  increase: "trade",
  decrease: "reduce",
  close: "close",
  deposit: "deposit",
  withdraw: "withdrawal",
  executeTrigger: "TP/SL",
  lpDeposit: "pool deposit",
  lpRequestRedeem: "pool redemption request",
  lpClaimRedeem: "pool redemption",
  swapCollateral: "collateral swap",
  setSpendAllowance: "spend allowance",
  setCardEnvelope: "card limit",
};

/**
 * TxRecovery (S8.24, D-179), mounted once at the root. At launch, on every return to the foreground, and every few
 * seconds while anything is unresolved, it reconciles the send journal on each entry's own chain. A send interrupted
 * by an app kill ends in a true outcome, never a resend. Each outcome refreshes that account on that chain and is
 * reported once, naming its own mode (not the selected one).
 */
export function TxRecoveryHost() {
  const queryClient = useQueryClient();
  const running = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const pass = async () => {
      if (running.current || stopped) return;
      running.current = true;
      clearTimeout(timer);
      try {
        const { recovered, waiting } = await recoverJournal();
        for (const r of recovered) {
          report(r);
          void queryClient.invalidateQueries({ queryKey: keys.account(r.chainId, r.from) });
        }
        if (waiting > 0 && !stopped) timer = setTimeout(() => void pass(), RECOVERY_POLL_MS);
      } finally {
        running.current = false;
      }
    };
    void pass();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void pass();
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [queryClient]);
  return null;
}

function report({ chainId, action, outcome }: Recovered): void {
  const label = ACTION_LABEL[action] ?? "transaction";
  const mode = networkOf(chainId).modeLabel;
  if (outcome.kind === "settled" && outcome.stage === "finalized") {
    notify({ title: `Your earlier ${label} went through`, description: `${mode} · confirmed while you were away` });
    return;
  }
  const why =
    outcome.kind === "settled"
      ? "It was rejected onchain; only gas was spent."
      : "It never reached the chain; nothing moved.";
  notify({ title: `Your earlier ${label} didn't go through`, description: `${mode} · ${why}`, tone: "warning" });
}
