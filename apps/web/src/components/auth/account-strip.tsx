"use client";

/**
 * Above the portfolio: the practice starter claim for a signed-in account that hasn't claimed (the TTFT moment, F05),
 * or the way in for a guest (F03). Hidden once claimed — the balance itself is the proof.
 */
import { UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account/provider";
import { ROUTES } from "@/lib/constants/routes";
import { StarterPanel } from "./starter-panel";

export function AccountStrip() {
  const account = useAccount();
  if (account.status === "loading") return null;
  if (!account.hint) {
    return (
      <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-sm border border-border p-3">
        <p className="text-caption text-muted-foreground">Browsing without an account · sample figures below.</p>
        <Button asChild size="sm">
          <Link href={ROUTES.welcome}>
            <UserRoundPlus />
            Create account
          </Link>
        </Button>
      </div>
    );
  }
  return <StarterPanel className="mx-4 mt-4" hideWhenClaimed />;
}
