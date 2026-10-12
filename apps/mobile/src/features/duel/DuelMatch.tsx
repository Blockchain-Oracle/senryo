/**
 * A dealt duel on the phone (P4, D-322): the stage keeps both seats — you and the person you drew — with each running
 * total (provisional until every card is in) and the pot between; while the deck is sealed it says so; while picks are
 * open the clock drains (21st Progress Bar #23549) and the stage beats through the last ten seconds; then the three
 * market lanes, where your calls lock in. When it's over the verdict takes the stage. The sealed deck's commitment
 * closes the screen.
 */
import { clockTone, opponentOf, potLine, seatOf, seatTotal } from "@senryo/calls";
import { type DuelFlow, useDuelCardQuotes } from "@senryo/calls/react";
import { DUEL } from "@senryo/config";
import { clockText, shortAddress } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useProfile } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "~/components/kit/ProgressBar";
import { SPACE, TYPE, useTheme } from "~/theme";
import { DuelLanes } from "./DuelLanes";
import { DuelResult } from "./DuelResult";
import { DuelStage } from "./DuelStage";

const HEARTBEAT_FROM_SEC = 10;

export function DuelMatch({
  flow,
  rating,
  onRematch,
  onDone,
}: {
  flow: DuelFlow;
  rating: string;
  onRematch: (tier: number) => void;
  onDone: () => void;
}) {
  const { color } = useTheme();
  const now = useServerSeconds();
  const m = flow.match;
  const quotes = useDuelCardQuotes(m);
  const them = m ? opponentOf(m, flow.owner) : null;
  const profile = useProfile(them ?? undefined);
  if (!m || !them) return null;
  const seat = seatOf(m, flow.owner);
  if (seat === null) return null;
  const other = seat === 0 ? 1 : 0;
  const p = "value" in profile ? profile.value : undefined;
  const themName = p?.handle ? `@${p.handle}` : shortAddress(them);
  const picking = m.state === "picking";
  const left = m.pickDeadline === null ? 0 : Math.max(0, m.pickDeadline - now);
  const theirCount = m.picks.filter((x) => x.seat === other).length;
  const over = m.state === "finalized" || m.state === "refunded" || m.state === "failed";
  const pot = potLine(m);
  return (
    <View style={styles.wrap} accessibilityLabel="Your duel">
      <DuelStage
        me={flow.owner}
        rating={rating}
        opponent={{ kind: "person", address: them }}
        opponentName={themName}
        pot={pot}
        totals={[seatTotal(m, seat), seatTotal(m, other)]}
        beat={picking && left > 0 && left <= HEARTBEAT_FROM_SEC ? left : null}
        matchKey={m.matchId}
      >
        {m.state === "opening" || m.state === "sealed" ? (
          <Text accessibilityLiveRegion="polite" style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>
            Matched · sealing the deck so neither of you sees it first…
          </Text>
        ) : null}
        {picking ? (
          <ProgressBar
            label={`Picks close · ${themName} has ${theirCount} of ${DUEL.cards}`}
            value={left}
            max={DUEL.pickWindowSec}
            valueText={`${clockText(left)} left`}
            tone={clockTone(left)}
          />
        ) : null}
        {over ? <DuelResult m={m} me={flow.owner} onRematch={() => onRematch(m.tier)} onDone={onDone} /> : null}
      </DuelStage>
      {m.cards.length > 0 ? <DuelLanes m={m} seat={seat} quotes={quotes} flow={flow} opponentName={themName} /> : null}
      <Text style={[TYPE.micro, { color: color.inkMuted }]}>
        Deck sealed {shortAddress(m.deckHash)}
        {m.serverSeed ? ` · seed ${shortAddress(m.serverSeed)}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  center: { textAlign: "center" },
});
