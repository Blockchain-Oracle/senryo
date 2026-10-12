"use client";
/**
 * Home (the phone's Home, S5.10): the balance in the mode's money, the one-tap chip, your open positions live (R5.3)
 * and the live markets to call on. A guest gets the promise and a way to play, not an account wall: their
 * passkey arrives with their first call (F14).
 */
import { useLiveBook } from "@senryo/calls/react";
import { useMarketAccount } from "@senryo/query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketList, tradeHref } from "@/features/markets/MarketList";
import { PositionsPanel } from "@/features/positions/PositionsPanel";
import { useAccount } from "@/lib/account/provider";
import { tapFeedback } from "@/lib/feedback";
import { money } from "@/lib/format";
import { activeNetwork } from "@/lib/network";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { OneTapChip } from "./OneTapChip";

/** What's open now, live (R5.3): the Unrealized card and a row per call and ride, each with its Cash out. */
function OpenPositions() {
  const book = useLiveBook();
  if (book.entries.length === 0 && book.parlays === 0) return null;
  return (
    <section aria-labelledby="home-open" className="flex flex-col gap-2">
      <h2 id="home-open" className="font-semibold text-section-title">
        Open positions
      </h2>
      <PositionsPanel empty="none" />
    </section>
  );
}

export function HomeScreen() {
  const address = useAccount().hint?.address;
  const account = useMarketAccount(address);
  const hidden = usePrivacy();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {address ? (
        <section aria-label="Balance" className="flex flex-col gap-2">
          {/* One h1 per page (R2.18): the balance is the visual hero; the heading names the page for assistive tech. */}
          <h1 className="sr-only">Home</h1>
          <span className="text-meta text-text-3">{activeNetwork().key === "testnet" ? "Test dollars" : "USDC"}</span>
          <span className="tnum font-semibold text-display-balance">
            {masked("value" in account ? money(account.value.balance) : "—", hidden)}
          </span>
          <OneTapChip />
        </section>
      ) : (
        <section className="flex flex-col items-start gap-3">
          <h1 className="font-semibold text-page-title">Call the next move</h1>
          <p className="text-body text-text-2">Up or Down on live prices. Pick one: your passkey signs it.</p>
          <Button size="xl" asChild>
            <Link href={tradeHref("BTC")} onClick={tapFeedback}>
              Make a call
            </Link>
          </Button>
        </section>
      )}
      {address ? <OpenPositions /> : null}
      <section aria-labelledby="home-markets" className="flex flex-col gap-3">
        <h2 id="home-markets" className="font-semibold text-section-title">
          Markets
        </h2>
        <MarketList />
      </section>
    </div>
  );
}
