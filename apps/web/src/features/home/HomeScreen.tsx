"use client";
/**
 * Home (the phone's Home, S5): the balance in the mode's money and the markets with their live prices. Open calls,
 * the record and the setup nudges join with S6.6.
 */
import { useMarketAccount } from "@senryo/query";
import { MarketList } from "@/features/markets/MarketList";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { money } from "@/lib/format";
import { masked, usePrivacy } from "@/lib/shell/privacy";

export function HomeScreen() {
  const address = useAccount().hint?.address;
  const account = useMarketAccount(address);
  const hidden = usePrivacy();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {address ? (
        <section aria-label="Balance" className="flex flex-col gap-1">
          <span className="text-meta text-text-3">{ACTIVE_NETWORK.key === "testnet" ? "Test dollars" : "USDC"}</span>
          <span className="tnum font-semibold text-display-balance">
            {masked("value" in account ? money(account.value.balance) : "—", hidden)}
          </span>
        </section>
      ) : null}
      <section aria-labelledby="home-markets" className="flex flex-col gap-3">
        <h2 id="home-markets" className="font-semibold text-section-title">
          Markets
        </h2>
        <MarketList />
      </section>
    </div>
  );
}
