/**
 * The dealt deck as three shared market lanes (P4, D-322; Codex: "Duel and Warm-up stop looking alike"): both seats
 * call the same three windows. Each lane shows the real mark, the window, the live price with its 24 h line, the
 * window's clock and the two sides with what the card's stake pays. Your call locks into your side of the lane; the
 * opponent's side says only that they've called until the protocol lets it show (you've called that card, or picks
 * closed). Once a window settles, each side's call shows its result.
 */

import type { DuelView } from "@senryo/api-client";
import { cardLine, cardResultText, DUEL_SIDES, pickOn, sideLabel, unitOf } from "@senryo/calls";
import { type DuelCardQuote, type DuelFlow, useDayLine } from "@senryo/calls/react";
import { clockText } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Sparkline } from "~/components/kit/Sparkline";
import { ArrowDown, ArrowUp } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { DISABLED_OPACITY, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { formatValue, priceDecimals } from "../terminal/chart/engine";

const MARK = 32;
const E8 = 1e8;
const E2 = 100;
const ARROW = 14;
const MULTIPLE_DECIMALS = 2;

export function DuelLanes({
  m,
  seat,
  quotes,
  flow,
  opponentName,
}: {
  m: DuelView;
  seat: 0 | 1;
  quotes: readonly DuelCardQuote[];
  flow: DuelFlow;
  opponentName: string;
}) {
  const other = seat === 0 ? 1 : 0;
  const picking = m.state === "picking";
  return (
    <View style={styles.lanes} accessibilityLabel="The three cards">
      {quotes.map((q) => {
        const own = pickOn(m, seat, q.index);
        const their = pickOn(m, other, q.index);
        return (
          <Lane
            key={q.card.windowId}
            q={q}
            stake={m.cardStake}
            own={own}
            their={their}
            showTheirs={!picking || own !== null}
            canPick={picking && own === null && !flow.placing.has(q.index)}
            placing={flow.placing.has(q.index)}
            opponentName={opponentName}
            onPick={(band) => {
              const side = DUEL_SIDES.find((s) => s.band === band);
              if (side) void flow.pick(q, side);
            }}
          />
        );
      })}
    </View>
  );
}

type Pick = { band: number; returned: bigint | null; result: bigint | null } | null;

function Lane(p: {
  q: DuelCardQuote;
  stake: bigint;
  own: Pick;
  their: Pick;
  showTheirs: boolean;
  canPick: boolean;
  placing: boolean;
  opponentName: string;
  onPick: (band: number) => void;
}) {
  const { color } = useTheme();
  const { q } = p;
  const priceE8 = useLivePrice(q.card.symbol);
  const day = useDayLine(q.card.symbol);
  const points = unitOf(q.card.symbol) === "points";
  const price = priceE8 ? formatValue(priceE8 / E8, priceDecimals(priceE8 / E8), points) : "—";
  const theirWord =
    p.their === null
      ? "Deciding…"
      : p.showTheirs
        ? `${sideLabel(p.their.band)}${resultOf(p.their, p.stake)}`
        : "Called";
  const ownWord = p.placing ? "Placing…" : p.own ? `${sideLabel(p.own.band)}${resultOf(p.own, p.stake)}` : "Your call";
  return (
    <View style={[styles.lane, { backgroundColor: color.card }]}>
      <View style={styles.head}>
        <EntityMark id={marketId(q.card.symbol)} size={MARK} decorative />
        <View style={styles.flex}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{cardLine(q.card)}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {q.closesIn > 0 ? `Closes in ${clockText(q.closesIn)}` : "Closed · settling"}
          </Text>
        </View>
        {day ? <Sparkline symbol={q.card.symbol} day={day} /> : null}
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{price}</Text>
      </View>
      <View style={styles.sides}>
        {q.sides.map((s) => (
          <Side
            key={s.band}
            symbol={q.card.symbol}
            band={s.band}
            label={s.label}
            multipleE2={s.multipleE2}
            on={p.own?.band === s.band}
            enabled={p.canPick && s.multipleE2 !== null}
            locked={p.own !== null}
            onPress={() => p.onPick(s.band)}
          />
        ))}
      </View>
      <View style={styles.calls}>
        <Text style={[TYPE.caption, { color: p.own ? color.ink : color.inkMuted }]}>You · {ownWord}</Text>
        <Text numberOfLines={1} style={[TYPE.caption, styles.right, { color: color.inkMuted }]}>
          {p.opponentName} · {theirWord}
        </Text>
      </View>
    </View>
  );
}

const resultOf = (pick: NonNullable<Pick>, stake: bigint) =>
  pick.returned === null ? "" : ` · ${cardResultText(pick, stake)}`;

function Side(p: {
  symbol: string;
  band: number;
  label: string;
  multipleE2: bigint | null;
  on: boolean;
  enabled: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const up = p.band === 0;
  const tone = up ? color.up : color.down;
  const ink = p.on ? (up ? color.upForeground : color.downForeground) : color.ink;
  const Arrow = up ? ArrowUp : ArrowDown;
  const multiple = p.multipleE2 === null ? "—" : `${(Number(p.multipleE2) / E2).toFixed(MULTIPLE_DECIMALS)}×`;
  return (
    <Pressable
      disabled={!p.enabled}
      onPress={p.onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: p.on, disabled: !p.enabled }}
      accessibilityLabel={`Call ${p.symbol} ${p.label}, pays ${multiple}`}
      style={styles.flex}
    >
      <View
        style={[
          styles.side,
          {
            backgroundColor: p.on ? tone : color.raised2,
            opacity: !p.on && (p.locked || !p.enabled) ? DISABLED_OPACITY : 1,
          },
        ]}
      >
        <Arrow size={ARROW} color={p.on ? ink : tone} strokeWidth={2.5} />
        <Text style={[TYPE.buttonCompact, { color: ink }]}>
          {p.label} · {multiple}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lanes: { gap: SPACE.sm },
  lane: { borderRadius: RADIUS.lg, padding: SPACE.md, gap: SPACE.sm },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  flex: { flex: 1 },
  sides: { flexDirection: "row", gap: SPACE.sm },
  side: {
    minHeight: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
  },
  calls: { flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm },
  right: { flexShrink: 1, textAlign: "right" },
});
