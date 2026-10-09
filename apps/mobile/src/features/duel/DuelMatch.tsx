/**
 * A dealt duel on the phone (S8.6; the web's `DuelMatch`): you versus them with each total, the pick clock (21st
 * Progress Bar #23549, RN port), your undecided cards as a swipe deck (21st Swipe Deck #23568, RN port: ← Down,
 * Up →), then every card as a row — your call and theirs (theirs once you've called that card or the picks closed)
 * and what each returned — the outcome, and the sealed deck's commitment.
 */
import {
  cardLine,
  cardResultText,
  clockTone,
  DUEL_SIDES,
  multiplierText,
  opponentOf,
  outcomeText,
  pickOn,
  seatOf,
  sideLabel,
} from "@senryo/calls";
import { type DuelCardQuote, type DuelFlow, useDuelCardQuotes } from "@senryo/calls/react";
import { DUEL } from "@senryo/config";
import { clockText, shortAddress, signedUsd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useServerSeconds } from "@senryo/live/react";
import { useProfile } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ProgressBar } from "~/components/kit/ProgressBar";
import { SwipeDeck } from "~/components/kit/SwipeDeck";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MARK = 28;
const FACE_MARK = 40;
const CARD_HEIGHT = 200;
const CALL_WIDTH = 84;
const [UP, DOWN] = DUEL_SIDES;

function useName(address: string | null): string {
  const profile = useProfile(address ?? undefined);
  if (!address) return "—";
  return "value" in profile && profile.value.handle ? `@${profile.value.handle}` : shortAddress(address);
}

export function DuelMatch({ flow, onAgain }: { flow: DuelFlow; onAgain: () => void }) {
  const { color } = useTheme();
  const m = flow.match;
  const now = useServerSeconds();
  const quotes = useDuelCardQuotes(m);
  const them = useName(m ? opponentOf(m, flow.owner) : null);
  if (!m) return null;
  const seat = seatOf(m, flow.owner);
  if (seat === null) return null;
  const other = seat === 0 ? 1 : 0;
  const picking = m.state === "picking";
  const left = m.pickDeadline === null ? 0 : Math.max(0, m.pickDeadline - now);
  const undecided = quotes.filter((q) => !pickOn(m, seat, q.index) && !flow.placing.has(q.index));
  const theirCount = m.picks.filter((p) => p.seat === other).length;
  const outcome = outcomeText(m, flow.owner);
  const over = m.state === "finalized" || m.state === "refunded" || m.state === "failed";
  const totalTone = (t: bigint | null) =>
    t === null ? color.inkMuted : t > 0n ? color.up : t < 0n ? color.down : color.ink;
  const mine = m.results?.[seat] ?? null;
  const theirs = m.results?.[other] ?? null;
  return (
    <View style={styles.wrap} accessibilityLabel="Your duel">
      <View style={styles.versus}>
        <View style={styles.flex}>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>You</Text>
          <Text style={[TYPE.numMd, { color: totalTone(mine) }]}>{mine === null ? "—" : signedUsd(mine)}</Text>
        </View>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>vs</Text>
        <View style={[styles.flex, styles.end]}>
          <Text numberOfLines={1} style={[TYPE.caption, { color: color.inkMuted }]}>
            {them}
          </Text>
          <Text style={[TYPE.numMd, { color: totalTone(theirs) }]}>{theirs === null ? "—" : signedUsd(theirs)}</Text>
        </View>
      </View>

      {m.state === "opening" || m.state === "sealed" ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.body, { color: color.inkMuted }]}>
          Matched with {them} · sealing the deck…
        </Text>
      ) : null}

      {picking ? (
        <View style={styles.wrap}>
          <ProgressBar
            label={`Picks close · ${them} has ${theirCount} of ${DUEL.cards}`}
            value={left}
            max={DUEL.pickWindowSec}
            valueText={`${clockText(left)} left`}
            tone={clockTone(left)}
          />
          <SwipeDeck
            items={undecided}
            itemKey={(q) => q.card.windowId}
            itemLabel={(q) => cardLine(q.card)}
            onDecide={(q, side) => void flow.pick(q, side === "right" ? UP : DOWN)}
            leftLabel={DOWN.label}
            rightLabel={UP.label}
            emptyLabel={flow.placing.size > 0 ? "Placing your calls…" : `Waiting for ${them}`}
            height={CARD_HEIGHT}
          >
            {(q) => <CardFace q={q} stake={m.cardStake} />}
          </SwipeDeck>
        </View>
      ) : null}

      {m.cards.map((c, i) => {
        const own = pickOn(m, seat, i);
        const their = pickOn(m, other, i);
        const shown = !picking || own !== null;
        const q = quotes[i];
        return (
          <View key={c.windowId} style={[styles.row, { borderBottomColor: color.hairline }]}>
            <EntityMark id={marketId(c.symbol)} size={MARK} decorative />
            <View style={styles.flex}>
              <Text style={[TYPE.rowTitle, { color: color.ink }]}>{cardLine(c)}</Text>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>
                {q && q.closesIn > 0 ? `Closes in ${clockText(q.closesIn)}` : "Closed"}
              </Text>
            </View>
            <Call label="You" pick={own} stake={m.cardStake} pending={flow.placing.has(i)} />
            <Call label={them} pick={shown ? their : null} stake={m.cardStake} hidden={!shown && their !== null} />
          </View>
        );
      })}

      {over || m.state === "settling" || m.state === "forfeited" ? (
        <View accessibilityLiveRegion="polite">
          <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{outcome.title}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{outcome.detail}</Text>
        </View>
      ) : null}

      <Text style={[TYPE.micro, { color: color.inkMuted }]}>
        Deck sealed {shortAddress(m.deckHash)}
        {m.serverSeed ? ` · seed ${shortAddress(m.serverSeed)}` : ""}
      </Text>

      {over ? <Button label="Duel again" onPress={onAgain} /> : null}
    </View>
  );
}

function Call(p: {
  label: string;
  pick: { band: number; returned: bigint | null; result: bigint | null } | null;
  stake: bigint;
  pending?: boolean;
  hidden?: boolean;
}) {
  const { color } = useTheme();
  const word = p.pending ? "Placing" : p.hidden ? "Called" : p.pick ? sideLabel(p.pick.band) : "—";
  const ink = p.pick && !p.hidden ? (p.pick.band === UP.band ? color.up : color.down) : color.inkMuted;
  return (
    <View style={styles.call}>
      <Text numberOfLines={1} style={[TYPE.micro, { color: color.inkMuted }]}>
        {p.label}
      </Text>
      <Text style={[TYPE.rowTitle, { color: ink }]}>{word}</Text>
      {p.pick && p.pick.returned !== null ? (
        <Text style={[TYPE.micro, { color: color.inkMuted }]}>{cardResultText(p.pick, p.stake)}</Text>
      ) : null}
    </View>
  );
}

function CardFace({ q, stake }: { q: DuelCardQuote; stake: bigint }) {
  const { color } = useTheme();
  const [up, down] = q.sides;
  return (
    <View style={styles.face}>
      <View style={styles.faceHead}>
        <EntityMark id={marketId(q.card.symbol)} size={FACE_MARK} decorative />
        <View>
          <Text style={[TYPE.title, { color: color.ink }]}>{cardLine(q.card)}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>Closes in {clockText(q.closesIn)}</Text>
        </View>
      </View>
      <View style={styles.odds}>
        <View>
          <Text style={[TYPE.caption, { color: color.down }]}>← {down?.label}</Text>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>
            {down?.payout ? multiplierText(stake, down.payout) : "—"}
          </Text>
        </View>
        <View style={styles.end}>
          <Text style={[TYPE.caption, { color: color.up }]}>{up?.label} →</Text>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>
            {up?.payout ? multiplierText(stake, up.payout) : "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  flex: { flex: 1 },
  end: { alignItems: "flex-end" },
  versus: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.rowMinHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  call: { width: CALL_WIDTH, alignItems: "flex-end" },
  face: { flex: 1, padding: SPACE.lg, justifyContent: "space-between" },
  faceHead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  odds: { flexDirection: "row", justifyContent: "space-between" },
});
