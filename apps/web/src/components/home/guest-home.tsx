"use client";

/**
 * Home without an account (the phone's GuestHome, flow book A1): one invitation tied to what an account gives here —
 * practice money to start with — and the listed markets at their oracle prices, each opening its detail. Browsing
 * needs nothing; any action asks for an account.
 */
import Link from "next/link";
import { PasskeyGlyph } from "@/components/identity/passkey-glyph";
import { DeskWatchlist } from "@/components/screens/markets/desk-watchlist";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { useMarketLines } from "@/lib/markets/line";

export function GuestHome() {
  const lines = useMarketLines();
  return (
    <Column>
      <section className="mt-6 grid gap-3 rounded-md bg-raised-2 p-5">
        <h1 className="text-section-title">Start with paper money</h1>
        <p className="text-meta text-text-2">Passkey account · P$ to practice · live prices</p>
        <Button asChild size="xl">
          <Link href={ROUTES.welcome}>
            <PasskeyGlyph />
            Create account
          </Link>
        </Button>
      </section>
      <div className="mt-6">
        <DeskWatchlist lines={lines} title="Markets now" />
      </div>
      <Button asChild variant="ghost" className="mt-2 w-full font-sans">
        <Link href={ROUTES.markets}>See all markets</Link>
      </Button>
    </Column>
  );
}
