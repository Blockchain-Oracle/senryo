"use client";
/**
 * The Games hub (S8.8, D-295; Owarine's hub): every game with whose money is at risk — Lucky's one real call, Warm-up and
 * the arcade's none — then the head-to-head and multi-call places that have their own pages.
 */
import { GAMES } from "@senryo/config";
import Link from "next/link";

const WITH_MONEY = [
  { href: "/app/duel/", title: "Duel", line: "The same three cards · the better total takes the pot" },
  { href: "/app/parlay/", title: "Parlay", line: "Two to four calls that must all come true" },
  { href: "/app/events/", title: "Events", line: "Yes or No on real games" },
] as const;

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
            <span className="font-semibold text-section-title">{g.title}</span>
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
              <Link href={w.href} className="flex flex-col py-3 focus-visible:outline-2 focus-visible:outline-ring">
                <span className="font-semibold text-row-title">{w.title}</span>
                <span className="text-meta text-text-3">{w.line}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
