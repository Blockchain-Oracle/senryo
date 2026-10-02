"use client";

/**
 * Home (flow book §0.9 Home, the phone's Home): the Total — Inter Display, decimals in text-3, `≈` + ⓘ when partial —
 * with Add money / Withdraw under it, the Practice money card until it's claimed, then Positions · Assets · Earn. No
 * session pill (the passkey asks at the action), no availability grid (buying power lives in the ticket), no chart.
 * A guest gets the guest Home: the account actions and the markets to look at.
 */
import { usePortfolio } from "@senryo/query";
import Link from "next/link";
import { AmountHero } from "@/components/kit/amount-hero";
import { PracticeMoneyCard } from "@/components/money/practice-money";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/lib/account/provider";
import { useTermsAccepted } from "@/lib/account/terms";
import { ROUTES, setupHref } from "@/lib/constants/routes";
import { money } from "@/lib/format";
import { GuestHome } from "./guest-home";
import { HomeTabs } from "./home-tabs";

function Total({ address }: { address: `0x${string}` }) {
  const portfolio = usePortfolio(address);
  const value = known(portfolio);
  const available = value?.components.some((c) => c.supported !== false && c.valueUsd6 !== undefined);
  if (value && available)
    return <AmountHero text={money(value.totalUsd6)} partial={value.quality === "partial"} className="pt-6" />;
  if (portfolio.status === "failed" || (value && !available))
    return <p className="pt-8 pb-2 text-row text-text-3">Balance unavailable</p>;
  return <Skeleton className="mt-8 mb-2 h-12 w-52" />;
}

export function HomeScreen() {
  const account = useAccount();
  const address = account.hint?.address;
  const accepted = useTermsAccepted(address);
  if (account.status === "loading")
    return (
      <Column>
        <Skeleton className="mt-8 h-12 w-52" />
      </Column>
    );
  if (!address) return <GuestHome />;
  // Terms come before the first money action (A11): until agreed, the money buttons open setup's terms step first.
  const gate = (href: string) => (accepted ? href : setupHref(href));
  return (
    <Column>
      <Total address={address} />
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button asChild size="xl">
          <Link href={gate(ROUTES.addMoney)}>Add money</Link>
        </Button>
        <Button asChild size="xl" variant="secondary">
          <Link href={gate(ROUTES.withdraw)}>Withdraw</Link>
        </Button>
      </div>
      <PracticeMoneyCard />
      <HomeTabs address={address} />
    </Column>
  );
}
