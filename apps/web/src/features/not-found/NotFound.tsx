"use client";
/**
 * The web's 404 (the owner, 13 Oct: "design our custom 404 well"). Grounded in 21st's "404 Did You Mean" (ziegfiroyt
 * /error9) and Refero's finance 404s (Coinbase, Kraken, ElevenLabs: one centred block, one mark, one way back), in the
 * terminal's own language: "404" as the stage's watermark under a price line that knocks out (`KnockedLine`), the
 * link struck through, the page it most likely meant from search's own ranking (`closestPage`), and Home.
 */
import { closestPage } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import type { SearchEntry } from "@senryo/search";
import { ChevronRight, CornerDownRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EntityMark } from "@/components/identity/entity-mark";
import { pageHref, SEARCH_PLACES } from "@/components/shell/search/hrefs";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { KnockedLine } from "./KnockedLine";
import "./not-found.css";

const SEAL = 40;
const MARK = 28;

export interface Suggestion {
  title: string;
  symbol?: string;
  href: string;
}

/** The page a broken path most likely meant, with its link (null when nothing comes close). */
export function suggestionFor(path: string): Suggestion | null {
  const entry: SearchEntry | null = closestPage(path, SEARCH_PLACES);
  const href = entry ? pageHref(entry.target) : null;
  if (!entry || !href) return null;
  return { title: entry.title, href, ...(entry.symbol ? { symbol: entry.symbol } : {}) };
}

export function NotFound({ path, suggestion }: { path: string; suggestion: Suggestion | null }) {
  return (
    <main className="nf">
      <Link href={ROUTES.welcome} className="nf-seal" aria-label="Senryo">
        <Image src="/brand/seal.svg" width={SEAL} height={SEAL} alt="" priority />
      </Link>
      <div className="nf-body">
        <div className="nf-stage">
          <p className="nf-code font-display tnum" aria-hidden>
            404
          </p>
          <KnockedLine />
        </div>
        <h1 className="font-semibold text-page-title">Off the chart</h1>
        <p className="text-body text-text-2">This link doesn't lead anywhere on Senryo.</p>
        {path ? (
          <p className="nf-path">
            <s>{path}</s>
          </p>
        ) : null}
        {suggestion ? (
          <Link href={suggestion.href} className="nf-suggest">
            {suggestion.symbol ? (
              <EntityMark id={marketId(suggestion.symbol)} size={MARK} decorative />
            ) : (
              <CornerDownRight aria-hidden className="size-5 text-text-3" />
            )}
            <span className="min-w-0 flex-1 truncate">
              <span className="text-text-2">Did you mean </span>
              <span className="font-semibold">{suggestion.title}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-text-3" />
          </Link>
        ) : null}
        <Button asChild size="xl" variant={suggestion ? "secondary" : "default"} className="nf-home">
          <Link href={ROUTES.app}>Go Home</Link>
        </Button>
      </div>
    </main>
  );
}
