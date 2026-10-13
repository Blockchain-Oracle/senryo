"use client";
/**
 * Any path the site doesn't have (exported as `404.html`, which nginx serves). A market link to a symbol the catalogue
 * doesn't list (`/app/trade/xyz/`) opens the last market this browser opened and says so there — the phone keeps its
 * last market the same way; a known symbol in another case (`/app/trade/BTC/`) opens it. Anything else says the page
 * isn't here, with one way Home.
 */
import { lastMarket, marketFromLink } from "@senryo/calls";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import "@/lib/visit-store";

const TRADE_PATH = /^\/app\/trade\/([^/]+)\/?$/;
/** Where a stray market link lands before this browser has opened any market. */
const FIRST_MARKET = "BTC";

const terminalOf = (symbol: string) => `/app/trade/${symbol.toLowerCase()}/`;

export default function NotFound() {
  const router = useRouter();
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const slug = TRADE_PATH.exec(window.location.pathname)?.[1];
    if (!slug) {
      setLost(true);
      return;
    }
    const raw = decodeURIComponent(slug);
    const known = marketFromLink(raw);
    router.replace(
      known ? terminalOf(known) : `${terminalOf(lastMarket() ?? FIRST_MARKET)}?missing=${encodeURIComponent(raw)}`,
    );
  }, [router]);
  if (!lost) return null;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-start justify-center gap-4 px-4">
      <h1 className="font-semibold text-page-title">This page isn't here</h1>
      <p className="text-body text-text-2">The link may be old, or mistyped.</p>
      <Button size="xl" onClick={() => router.push(ROUTES.app)}>
        Go Home
      </Button>
    </main>
  );
}
