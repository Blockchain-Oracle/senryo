"use client";
/**
 * A committee member's source, by its mark (R2.8): ESPN's wordmark; the league's own mark where the event names its
 * league and the registry has one. theScore and the NFL are recorded gaps (no grant), so they stay words.
 */
import { hasArt, ids } from "@senryo/identity";
import { EntityMark } from "@/components/identity/entity-mark";

const WORDMARK_H = 14;
const LEAGUE_MARK = 20;

export function SourceMark({ source, league }: { source: string | undefined; league?: string | undefined }) {
  if (source === "espn")
    return <EntityMark id={ids.provider("espn")} size={WORDMARK_H} variant="wordmark" decorative />;
  if (source === "league" && league && hasArt(ids.league(league)))
    return <EntityMark id={ids.league(league)} size={LEAGUE_MARK} decorative />;
  return null;
}
