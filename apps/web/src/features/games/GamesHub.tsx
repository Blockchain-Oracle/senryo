"use client";
/**
 * The Games hub (S8.8, D-295; Owarine's hub): every game with whose money is at risk — Lucky's one real call, Warm-up and
 * the arcade's none — then the head-to-head and multi-call places that have their own pages.
 */
import { GAMES } from "@senryo/config";
import { ids, marketId, type PixelMarkName } from "@senryo/identity";
import { PixelMark } from "@senryo/identity/web";
import Link from "next/link";
import type { ReactNode } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { PIXEL_COLORS } from "@/lib/pixel-colors";

const ART = 40;
const ROW_ART = 28;
/** Each game's key art (R2.8): the pixel marks it plays with (the arcade's candles are seeded, not a market's). */
const GAME_ART: Readonly<Record<string, readonly PixelMarkName[]>> = {
  lucky: ["coin"],
  "warm-up": ["bull", "bear"],
  "line-rider": ["bull"],
  "candle-hop": ["bear"],
};

function Art({ names }: { names: readonly PixelMarkName[] }) {
  return (
    <span aria-hidden className="flex items-center gap-1">
      {names.map((n) => (
        <PixelMark key={n} name={n} size={ART} colors={PIXEL_COLORS} />
      ))}
    </span>
  );
}

const WITH_MONEY = [
  { href: "/app/duel/", title: "Duel", line: "The same three cards · the better total takes the pot", art: "markets" },
  { href: "/app/parlay/", title: "Parlay", line: "Two to four calls that must all come true", art: "markets" },
  { href: "/app/events/", title: "Events", line: "Yes or No on real games", art: "leagues" },
] as const;

/** The places' marks: the markets they deal (the majors' own marks), or the leagues events are about. */
const PLACE_ART: Readonly<Record<"markets" | "leagues", ReactNode>> = {
  markets: <EntityMark id={marketId("MAJORS")} size={ROW_ART} decorative />,
  leagues: (
    <span className="flex items-center gap-1">
      {["nhl", "mlb", "epl"].map((l) => (
        <EntityMark key={l} id={ids.league(l)} size={ROW_ART} decorative />
      ))}
    </span>
  ),
};

export function GamesHub() {
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Games" className="grid gap-3 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link
            key={g.key}
            href={g.href}
            className="flex flex-col gap-1 rounded-2xl bg-card p-4 transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Art names={GAME_ART[g.key] ?? []} />
            <span className="pt-2 font-semibold text-section-title">{g.title}</span>
            <span className="text-body text-text-2">{g.line}</span>
            <span className="text-meta text-text-3">{g.stakes}</span>
          </Link>
        ))}
      </section>
      <section aria-label="Head to head and more" className="flex flex-col gap-2">
        <h2 className="font-semibold text-section-title">Head to head and more</h2>
        <ul className="flex flex-col divide-y divide-border">
          {WITH_MONEY.map((w) => (
            <li key={w.href}>
              <Link
                href={w.href}
                className="flex items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {PLACE_ART[w.art]}
                <span className="flex flex-col">
                  <span className="font-semibold text-row-title">{w.title}</span>
                  <span className="text-meta text-text-3">{w.line}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
