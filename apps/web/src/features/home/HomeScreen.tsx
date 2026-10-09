"use client";
/**
 * Home (the phone's Home, S5.10): the balance in the mode's money, the one-tap chip, your open calls (each opens its
 * terminal) and the live markets to call on. A guest gets the promise and one way in.
 */
import { useCallRows } from "@senryo/calls/react";
import { lane, sideName } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useMarketAccount } from "@senryo/query";
import Link from "next/link";
import { EntityMark } from "@/components/identity/entity-mark";
import { Button } from "@/components/ui/button";
import { MarketList, tradeHref } from "@/features/markets/MarketList";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { tapFeedback } from "@/lib/feedback";
import { money } from "@/lib/format";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { OneTapChip } from "./OneTapChip";

const MARK = 36;

function OpenCalls({ owner }: { owner: `0x${string}` }) {
  const { open } = useCallRows(owner);
  const hidden = usePrivacy();
  if (open.length === 0) return null;
  return (
    <section aria-labelledby="home-open" className="flex flex-col gap-2">
      <h2 id="home-open" className="font-semibold text-section-title">
        Open calls
      </h2>
      <ul className="flex flex-col">
        {open.map((r) => (
          <li key={r.key}>
            <Link
              href={tradeHref(r.symbol)}
              onClick={tapFeedback}
              className="flex min-h-16 items-center gap-3 rounded-md px-3 py-2 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <EntityMark id={marketId(r.symbol)} size={MARK} decorative />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-row-title">
                  {r.symbol} {sideName(r.band)} · {lane(r.cadenceSec)}
                </span>
                <span className="text-meta text-text-3">{r.status}</span>
              </span>
              <span className="tnum font-semibold text-row-title">{masked(r.result, hidden)}</span>
            </Link>
          </li>
        ))}
      </ul>
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
          <span className="text-meta text-text-3">{ACTIVE_NETWORK.key === "testnet" ? "Test dollars" : "USDC"}</span>
          <span className="tnum font-semibold text-display-balance">
            {masked("value" in account ? money(account.value.balance) : "—", hidden)}
          </span>
          <OneTapChip />
        </section>
      ) : (
        <section className="flex flex-col items-start gap-3">
          <h1 className="font-semibold text-page-title">Call the next move</h1>
          <p className="text-body text-text-2">Up or Down on live prices, in dollars.</p>
          <Button asChild size="xl">
            <Link href="/">Create account</Link>
          </Button>
        </section>
      )}
      {address ? <OpenCalls owner={address} /> : null}
      <section aria-labelledby="home-markets" className="flex flex-col gap-3">
        <h2 id="home-markets" className="font-semibold text-section-title">
          Call the next move
        </h2>
        <MarketList />
      </section>
    </div>
  );
}
