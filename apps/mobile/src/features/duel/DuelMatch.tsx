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
  tierTitle,
} from "@senryo/calls";
import { type DuelCardQuote, type DuelFlow, useDayLine, useDuelCardQuotes } from "@senryo/calls/react";
import { DUEL, duelTierOf } from "@senryo/config";
import { clockText, shortAddress, signedUsd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useServerSeconds } from "@senryo/live/react";
import { useProfile } from "@senryo/query";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from "react-native-reanimated";
import { Avatar } from "~/components/identity/Avatar";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ChangeChip } from "~/components/kit/ChangeChip";
import { ProgressBar } from "~/components/kit/ProgressBar";
import { Sparkline } from "~/components/kit/Sparkline";
import { SwipeDeck } from "~/components/kit/SwipeDeck";
import { useNetwork } from "~/lib/network";
import { FONT, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MARK = 28;
const FACE_MARK = 40;
const CARD_HEIGHT = 240;
/** The match's faces (research 10 §4): 72-point portraits, a VS that slams in, a heartbeat through the last 10 s. */
const PORTRAIT = 72;
const VS_SIZE = 40;
const VS_SPRING = { damping: 9, stiffness: 180 } as const;
const HEARTBEAT_FROM_SEC = 10;
const BEAT_SCALE = 1.04;
const BEAT_IN_MS = 90;
const BEAT_OUT_MS = 180;
const SPARK_H = 32;
const CALL_WIDTH = 84;
const [UP, DOWN] = DUEL_SIDES;

/** A seat's person: the handle (or the short address) and the chosen portrait (R2.8; the web's `usePerson`). */
function usePerson(address: string | null): { name: string; avatar: string | null; address: string | undefined } {
  const profile = useProfile(address ?? undefined);
  if (!address) return { name: "—", avatar: null, address: undefined };
  const p = "value" in profile ? profile.value : undefined;
  return { name: p?.handle ? `@${p.handle}` : shortAddress(address), avatar: p?.avatar ?? null, address };
}

export function DuelMatch({ flow, onAgain }: { flow: DuelFlow; onAgain: () => void }) {
  const { color } = useTheme();
  const network = useNetwork();
  const m = flow.match;
  const now = useServerSeconds();
  const quotes = useDuelCardQuotes(m);
  const opponent = usePerson(m ? opponentOf(m, flow.owner) : null);
  const me = usePerson(flow.owner ?? null);
  const them = opponent.name;
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
  const tier = duelTierOf(network.chainId, m.tier);
  return (
    <View style={styles.wrap} accessibilityLabel="Your duel">
      <Heartbeat beat={picking && left > 0 && left <= HEARTBEAT_FROM_SEC ? left : null}>
        <View style={styles.flex}>
          <Avatar avatar={me.avatar} {...(me.address ? { address: me.address } : {})} size={PORTRAIT} />
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>You</Text>
          <Text style={[TYPE.numMd, { color: totalTone(mine) }]}>{mine === null ? "—" : signedUsd(mine)}</Text>
        </View>
        <View style={styles.middle}>
          <Animated.Text
            key={m.matchId}
            entering={ZoomIn.springify().damping(VS_SPRING.damping).stiffness(VS_SPRING.stiffness)}
            style={[styles.vs, { color: color.accent }]}
          >
            VS
          </Animated.Text>
          {tier ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{tierTitle(tier)}</Text> : null}
        </View>
        <View style={[styles.flex, styles.end]}>
          <Avatar
            avatar={opponent.avatar}
            {...(opponent.address ? { address: opponent.address } : {})}
            size={PORTRAIT}
          />
          <Text numberOfLines={1} style={[TYPE.caption, { color: color.inkMuted }]}>
            {them}
          </Text>
          <Text style={[TYPE.numMd, { color: totalTone(theirs) }]}>{theirs === null ? "—" : signedUsd(theirs)}</Text>
        </View>
      </Heartbeat>

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

/** The header beats once a second through the last ten before picks close (`beat` is the seconds left, or null). */
function Heartbeat({ beat, children }: { beat: number | null; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (beat === null) return;
    scale.value = withSequence(
      withTiming(BEAT_SCALE, { duration: BEAT_IN_MS }),
      withTiming(1, { duration: BEAT_OUT_MS }),
    );
  }, [beat, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.versus, style]}>{children}</Animated.View>;
}

function CardFace({ q, stake }: { q: DuelCardQuote; stake: bigint }) {
  const { color } = useTheme();
  const day = useDayLine(q.card.symbol);
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
      {day ? (
        <View style={styles.day}>
          <View style={styles.spark}>
            <Sparkline symbol={q.card.symbol} day={day} />
          </View>
          <ChangeChip symbol={q.card.symbol} day={day} />
        </View>
      ) : null}
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
  middle: { alignItems: "center" },
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
  vs: { fontFamily: FONT.display, fontSize: VS_SIZE, lineHeight: VS_SIZE },
  day: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  spark: { flex: 1, height: SPARK_H, justifyContent: "center" },
});
