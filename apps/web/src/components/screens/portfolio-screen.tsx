"use client";

import { Eye, LineChart } from "lucide-react";
import Link from "next/link";
import { CardAuths } from "@/components/screens/card-auths";
import { AccountPortfolio } from "@/components/screens/portfolio/account-portfolio";
import { PreviewBadge } from "@/components/shell/preview-badge";
import { SectionLabel } from "@/components/shell/primitives";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/ui/loading-state";
import { useAccount } from "@/lib/account/provider";
import { ROUTES } from "@/lib/constants/routes";

/** A guest has no balance to show — so none is shown: what appears here once there is an account, and what works now. */
function GuestPortfolio() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 px-4 pt-6">
      <p className="text-body">
        Your balance, its three capacities — Free to trade, Free to spend, Locked — and your open positions appear here
        once you create an account or sign in on this device.
      </p>
      <p className="text-caption text-muted-foreground">
        Markets, prices and charts are live without one. Watch any address read-only to see a real account.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.markets}>
            <LineChart />
            Markets
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.watch}>
            <Eye />
            Watch an address
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Portfolio (D2 home, S11b): the signed-in account's real balance, curve, capacities and positions; a guest sees the
 * guest state, never sample rows. The card's authorizations are still a preview on the desk and say so.
 */
export function PortfolioScreen() {
  const account = useAccount();
  if (account.status === "loading") return <LoadingState label="Opening your account" className="mx-4 mt-6" />;
  const address = account.hint?.address;
  if (!address) return <GuestPortfolio />;
  return (
    <AccountPortfolio
      address={address}
      aside={
        <>
          <SectionLabel>Card · authorizations</SectionLabel>
          <PreviewBadge
            className="mx-4 mb-2"
            missing="Sample holds. The desk connects your Kinpaku card's real authorizations in a later slice."
          />
          <CardAuths className="mx-4" />
        </>
      }
    />
  );
}
