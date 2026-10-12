"use client";
/**
 * A side's crest (D-315, F11): the team's own crest from `@senryo/identity`'s team table (fetched by script from ESPN's
 * team feeds, pinned and self-hosted — never hot-linked), the dark-ground crest in the dark theme (from hydration on,
 * `useScheme`); only a club the feed doesn't list falls back to its abbreviation on a plate.
 */
import type { EventView } from "@senryo/api-client";
import { ids, TEAM_CRESTS } from "@senryo/identity";
import { TEAM_CREST_URLS } from "@senryo/identity/web";
import { useScheme } from "@/lib/use-scheme";
import { cn } from "@/lib/utils";

export function TeamMark({
  league,
  team,
  size = "md",
}: {
  league: string;
  team: EventView["home"];
  /** md 36 px in a row, lg 48 px on a card (research 10 §5). */
  size?: "md" | "lg";
}) {
  const scheme = useScheme();
  const id = ids.team(league, team.abbr);
  const crest = TEAM_CRESTS[id];
  const src = TEAM_CREST_URLS[scheme === "dark" && crest?.dark ? `${id}:dark` : id];
  const box = size === "lg" ? "size-12" : "size-9";
  if (src) {
    return (
      // biome-ignore lint/performance/noImgElement: a static export; the crest is a fixed 128 px file
      <img
        src={src}
        alt={team.name}
        title={team.name}
        className={cn(box, "shrink-0 object-contain")}
        draggable={false}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={team.name}
      title={team.name}
      className={cn(box, "flex shrink-0 items-center justify-center rounded-full bg-secondary ring-2 ring-card")}
    >
      <span aria-hidden className="font-semibold text-micro text-text-2">
        {team.abbr}
      </span>
    </span>
  );
}
