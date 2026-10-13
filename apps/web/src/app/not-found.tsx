"use client";
/**
 * Any path the site doesn't have (exported as `404.html`, which nginx serves). A market link to a symbol the catalogue
 * doesn't list (`/app/trade/xyz/`) opens the last market this browser opened and says so there — the phone keeps its
 * last market the same way; a known symbol in another case (`/app/trade/BTC/`) opens it. Anything else is the 404:
 * the link struck through and the page it most likely meant (`features/not-found`).
 */
import { lastMarket, marketFromLink } from "@senryo/calls";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NotFound, type Suggestion, suggestionFor } from "@/features/not-found/NotFound";
import "@/lib/visit-store";

const TRADE_PATH = /^\/app\/trade\/([^/]+)\/?$/;
/** Where a stray market link lands before this browser has opened any market. */
const FIRST_MARKET = "BTC";

const terminalOf = (symbol: string) => `/app/trade/${symbol.toLowerCase()}/`;

export default function NotFoundPage() {
  const router = useRouter();
  const [lost, setLost] = useState<{ path: string; suggestion: Suggestion | null } | null>(null);
  useEffect(() => {
    const path = window.location.pathname;
    const slug = TRADE_PATH.exec(path)?.[1];
    if (!slug) {
      setLost({ path, suggestion: suggestionFor(path) });
      return;
    }
    let raw = slug;
    try {
      raw = decodeURIComponent(slug);
    } catch {
      // A malformed escape: read the symbol as typed.
    }
    const known = marketFromLink(raw);
    router.replace(
      known ? terminalOf(known) : `${terminalOf(lastMarket() ?? FIRST_MARKET)}?missing=${encodeURIComponent(raw)}`,
    );
  }, [router]);
  return lost ? <NotFound path={lost.path} suggestion={lost.suggestion} /> : null;
}
