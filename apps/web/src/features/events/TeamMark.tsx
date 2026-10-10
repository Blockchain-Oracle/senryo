"use client";
/**
 * A side's mark: its logo as the source feed publishes it (ESPN's), on a round plate; its abbreviation when there is
 * none or it fails to load.
 */
import type { EventView } from "@senryo/api-client";
import { useState } from "react";

const SIZE = 36;

export function TeamMark({ team }: { team: EventView["home"] }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      title={team.name}
      className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary ring-2 ring-card"
    >
      {team.logo && !failed ? (
        <img
          src={team.logo}
          alt={team.name}
          width={SIZE}
          height={SIZE}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-7 object-contain"
        />
      ) : (
        <span className="font-semibold text-micro text-text-2">{team.abbr}</span>
      )}
    </span>
  );
}
