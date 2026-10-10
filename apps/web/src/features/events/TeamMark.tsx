"use client";
/**
 * A side's mark (R2.7): the team's logo from the identity registry (`ids.team`, provenance and all) where one is on
 * file; otherwise its abbreviation on a round plate. Never an image from a feed.
 */
import type { EventView } from "@senryo/api-client";
import { hasArt, ids } from "@senryo/identity";
import { EntityMark } from "@/components/identity/entity-mark";

const SIZE = 36;

export function TeamMark({ league, team }: { league: string; team: EventView["home"] }) {
  const id = ids.team(league, team.abbr);
  if (hasArt(id)) return <EntityMark id={id} size={SIZE} label={team.name} />;
  return (
    <span
      role="img"
      aria-label={team.name}
      title={team.name}
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary ring-2 ring-card"
    >
      <span aria-hidden className="font-semibold text-micro text-text-2">
        {team.abbr}
      </span>
    </span>
  );
}
