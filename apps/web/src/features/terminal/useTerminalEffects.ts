"use client";
/**
 * What a trade does around itself on the web, for calls and rides alike: the press, fill and failure cues, plain
 * warnings, each trade's one toast (`tradeToast`, R5.11), the terms check before money moves, a guest's first call through its own sheet (F14), and a shortfall
 * that names the gap and opens where dollars come from (R5.7: test dollars in Practice, Add money in Real).
 */
import { dollars } from "@senryo/calls";
import type { CallFlowEffects, OfferSlot } from "@senryo/calls/react";
import { useAccount } from "@/lib/account/provider";
import { hasAcknowledgedTerms } from "@/lib/account/terms";
import { ROUTES } from "@/lib/constants/routes";
import { fire } from "@/lib/feedback";
import { activeNetwork } from "@/lib/network";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { HIDDEN_AMOUNT, privacyOn } from "@/lib/shell/privacy";
import { tradeToast } from "@/lib/trade-toast";

export function useTerminalEffects(onGuestCall: (slot: OfferSlot) => boolean) {
  const account = useAccount();
  const effects: CallFlowEffects = {
    cue: (c) =>
      c === "press"
        ? fire("press")
        : c === "fail"
          ? fire("fail", { cue: "error" })
          : c === "filled-close"
            ? fire("close", { cue: "close" })
            : fire("filled", { cue: "open" }),
    notify: (n) => notify({ ...n, tone: "warning" }),
    toast: tradeToast,
    gate: () => {
      if (hasAcknowledgedTerms(account.hint?.address)) return true;
      notify({
        title: "Agree to the terms first",
        description: "One step before any money moves.",
        action: { label: "Open setup", onClick: () => window.location.assign(ROUTES.setup) },
        tone: "warning",
      });
      return false;
    },
    needAccount: (slot) => {
      if (slot !== undefined && onGuestCall(slot)) return;
      notify({
        title: "Sign in to trade",
        description: "Your passkey is your account.",
        action: { label: "Sign in", onClick: () => openDrawer(DRAWERS.account) },
      });
    },
    shortfall: (short) => {
      const practice = activeNetwork().key === "testnet";
      notify({
        title: `${privacyOn() ? HIDDEN_AMOUNT : dollars(short)} short`,
        description: practice ? "Top up with test dollars, then tap again." : "Add money, then tap again.",
        action: {
          label: practice ? "Get test dollars" : "Add money",
          onClick: () => openDrawer(practice ? DRAWERS.wallet : DRAWERS.receive, { amount: String(short) }),
        },
        tone: "warning",
      });
    },
  };
  return effects;
}
