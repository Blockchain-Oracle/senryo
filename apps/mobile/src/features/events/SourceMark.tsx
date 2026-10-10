/**
 * A committee member's source, by its mark (R2.8; the web's `SourceMark`): ESPN's wordmark; the league's own mark
 * where the event names its league and the registry has one. theScore and the NFL stay words (recorded gaps).
 */
import { hasArt, ids } from "@senryo/identity";
import { EntityMark } from "~/components/identity/EntityMark";
import { SIZE } from "~/theme";

const WORDMARK_H = 14;

export function SourceMark({ source, league }: { source: string | undefined; league?: string | undefined }) {
  if (source === "espn")
    return <EntityMark id={ids.provider("espn")} size={WORDMARK_H} variant="wordmark" decorative />;
  if (source === "league" && league && hasArt(ids.league(league)))
    return <EntityMark id={ids.league(league)} size={SIZE.markInline} decorative />;
  return null;
}
