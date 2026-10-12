/**
 * Below the arena (P4): the rank ladder — the top players by rating with their records, your row pinned when you're
 * outside them (`useDuelLadder`) — and your finished duels, each with the opponent's portrait, the verdict and both
 * totals. An empty history is one line inviting a first duel.
 */
import type { DuelRatingView, DuelView } from "@senryo/api-client";
import { DUEL_LIVE_STATES, opponentOf, outcomeText } from "@senryo/calls";
import { shortAddress } from "@senryo/core";
import { useDuelLadder, useProfile } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const LADDER_ROWS = 10;
const FACE = 32;

export function DuelLadder({ me, rating }: { me: string | undefined; rating: DuelRatingView | null }) {
  const { color } = useTheme();
  const ladder = useDuelLadder();
  const players = "value" in ladder ? ladder.value.players : [];
  const top = players.slice(0, LADDER_ROWS);
  const mine = me?.toLowerCase();
  const myRank = players.findIndex((p) => p.owner.toLowerCase() === mine);
  const pinned = rating && rating.played > 0 && (myRank < 0 || myRank >= LADDER_ROWS);
  if (top.length === 0) return null;
  return (
    <View style={styles.section} accessibilityLabel="Duel ladder">
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Ladder
      </Text>
      {top.map((p, i) => (
        <LadderRow
          key={p.owner}
          rank={i + 1}
          name={p.handle ? `@${p.handle}` : shortAddress(p.owner)}
          rating={p.rating}
          record={`${p.wins}–${p.losses}${p.ties ? `–${p.ties}` : ""}`}
          you={p.owner.toLowerCase() === mine}
        />
      ))}
      {pinned && rating ? (
        <LadderRow
          rank={myRank >= 0 ? myRank + 1 : null}
          name="You"
          rating={rating.rating}
          record={`${rating.wins}–${rating.losses}${rating.ties ? `–${rating.ties}` : ""}`}
          you
        />
      ) : null}
    </View>
  );
}

function LadderRow(p: { rank: number | null; name: string; rating: number; record: string; you: boolean }) {
  const { color } = useTheme();
  return (
    <View style={[styles.row, p.you && { backgroundColor: color.selectedRow }]}>
      <Text style={[TYPE.numSm, styles.rank, { color: color.inkMuted }]}>{p.rank ?? "—"}</Text>
      <Text numberOfLines={1} style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>
        {p.name}
      </Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{p.record}</Text>
      <Text style={[TYPE.rowTitle, { color: color.ink }]}>{p.rating}</Text>
    </View>
  );
}

export function DuelHistory({ me, duels }: { me: string | undefined; duels: readonly DuelView[] }) {
  const { color } = useTheme();
  const done = duels.filter((d) => !DUEL_LIVE_STATES.has(d.state));
  return (
    <View style={styles.section} accessibilityLabel="Your duels">
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Your duels
      </Text>
      {done.length === 0 ? (
        <Text style={[TYPE.body, { color: color.inkMuted }]}>Your first duel lands here — pick a tier above.</Text>
      ) : (
        done.map((d) => <HistoryRow key={d.matchId} d={d} me={me} />)
      )}
    </View>
  );
}

function HistoryRow({ d, me }: { d: DuelView; me: string | undefined }) {
  const { color } = useTheme();
  const them = opponentOf(d, me);
  const profile = useProfile(them ?? undefined);
  const p = them && "value" in profile ? profile.value : undefined;
  const o = outcomeText(d, me);
  const won = d.winner !== null && d.winner.toLowerCase() === me?.toLowerCase();
  return (
    <View style={styles.row}>
      <Avatar avatar={p?.avatar ?? null} {...(them ? { address: them } : {})} size={FACE} />
      <View style={styles.flex}>
        <Text style={[TYPE.rowTitle, { color: won ? color.up : color.ink }]}>{o.title}</Text>
        <Text numberOfLines={1} style={[TYPE.caption, { color: color.inkMuted }]}>
          vs {p?.handle ? `@${p.handle}` : them ? shortAddress(them) : "—"}
          {o.detail ? ` · ${o.detail}` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.xs },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.touch, borderRadius: SPACE.sm },
  rank: { width: SIZE.touch, textAlign: "center" },
  flex: { flex: 1 },
});
