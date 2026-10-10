"use client";
import { dollarId } from "@senryo/identity";
/**
 * The wallet (`?d=wallet`; the phone's Wallet, S5.12): the balance in the mode's money, Practice's daily test dollars
 * (the relay mints them gas-free), and Receive and Withdraw. A guest is asked to sign in. Real's deposit from any
 * chain arrives with mainnet (S9).
 */
import { useMarketAccount, usePracticeGrant } from "@senryo/query";
import { ArrowDownToLine, ArrowUpRight, Coins } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/drawer";
import { useAccount } from "@/lib/account/provider";
import { useSessionRunner } from "@/lib/account/use-session-runner";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { fire } from "@/lib/feedback";
import { money } from "@/lib/format";
import { notify } from "@/lib/notify";
import { DRAWERS, dropDrawerParam, openDrawer } from "@/lib/shell/drawer-param";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import type { DrawerProps } from "./types";

const PRACTICE = ACTIVE_NETWORK.key === "testnet";
const DOLLAR_MARK = 36;

function go(name: string) {
  fire("tick", { cue: "tap" });
  dropDrawerParam();
  openDrawer(name);
}

export function WalletDrawer({ open, onOpenChange }: DrawerProps) {
  const address = useAccount().hint?.address;
  const account = useMarketAccount(address);
  const session = useSessionRunner();
  const grant = usePracticeGrant(address, session);
  const hidden = usePrivacy();
  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title="Wallet"
      description={PRACTICE ? "Practice · test dollars" : "Real · USDC"}
    >
      {!address ? (
        <div className="flex flex-col gap-3 pt-2">
          <p className="text-body text-text-2">Sign in to see your balance.</p>
          <Button size="xl" onClick={() => go(DRAWERS.account)}>
            Sign in
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6 pt-2">
          <p className="flex items-center gap-3">
            <EntityMark id={dollarId(ACTIVE_NETWORK.chainId)} size={DOLLAR_MARK} decorative />
            <span className="tnum font-semibold text-display-balance">
              {masked("value" in account ? money(account.value.balance) : "—", hidden)}
            </span>
          </p>
          {PRACTICE ? (
            <Button
              size="xl"
              disabled={grant.isPending || !session}
              onClick={() =>
                grant.mutate(undefined, {
                  onSuccess: (r) => {
                    if (r.state === "granted") {
                      fire("filled", { cue: "win" });
                      notify({
                        title: `Added ${money(r.amount)}`,
                        description: "Test dollars, in your Practice balance.",
                      });
                    } else notify({ title: "Already topped up today", description: "Come back tomorrow for more." });
                  },
                  onError: (e) =>
                    notify({ title: "Couldn't add test dollars", description: e.message, tone: "warning" }),
                })
              }
            >
              <Coins aria-hidden />
              {grant.isPending ? "Adding…" : "Get test dollars"}
            </Button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="xl" onClick={() => go(DRAWERS.receive)}>
              <ArrowDownToLine aria-hidden />
              Receive
            </Button>
            <Button variant="secondary" size="xl" onClick={() => go(DRAWERS.withdraw)}>
              <ArrowUpRight aria-hidden />
              Withdraw
            </Button>
          </div>
        </div>
      )}
    </SlideOver>
  );
}
