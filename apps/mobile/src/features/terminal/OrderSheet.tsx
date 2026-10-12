/**
 * The order's settings on the phone (Tradash's settings sheet, Codex direction 11 §2, R5.4/R5.7), from the order stack:
 * - a call: its type (Up/Down · Range · Moonshot) and how each side wins, the stake on the keypad with presets and Max,
 *   the trail TRAIL arms at (cents behind the best bid), and the summary;
 * - a ride: the margin on the keypad, the leverage chips to the market's cap with the knock-out on each side in words,
 *   the trail (a share of the price), and the summary — trade size, fees, the most it can win, its 4-hour life.
 * Every amount is exact; presets are conveniences. It rests at 62 / 88 / 100 % (D-321).
 */
import {
  CALL_MODES,
  type CallMode,
  capWords,
  dollars,
  knockOutWords,
  leverageChips,
  type Offer,
  type Quotes,
  RIDE_MARGIN_USD,
  RIDE_TRAIL_STEPS_BPS,
  type RideTermsLike,
  rideQuote,
  TRAIL_CENTS,
  trailText,
  unitOf,
} from "@senryo/calls";
import { P_ONE, priceText } from "@senryo/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AmountPad } from "~/components/kit/AmountPad";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { LIST_DETENTS } from "~/components/sheet/constants";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { STAKE_PRESETS_USD } from "./constants";

const USD = 1_000_000n;
const ONE_X = 10_000;
const MS = 1_000;
const SECONDS_PER_HOUR = 3_600;

const at = (sec: number) => new Date(sec * MS).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Chips({
  items,
  chosen,
  onPick,
}: {
  items: readonly { key: string; label: string }[];
  chosen: string;
  onPick: (key: string) => void;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.chips}>
      {items.map((c) => {
        const on = c.key === chosen;
        return (
          <Pressable
            key={c.key}
            onPress={() => {
              fire("tick");
              onPick(c.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? color.ink : color.raised2 }]}
          >
            <Text style={[TYPE.chipLabel, { color: on ? color.ground : color.ink }]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{k}</Text>
      <Text style={[TYPE.rowAmount, { color: color.ink }]}>{v}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[TYPE.micro, styles.title, { color: color.text3 }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const chipsOf = (presets: readonly number[], max: bigint, available: bigint | undefined) => [
  ...presets.filter((d) => BigInt(d) * USD <= max).map((d) => ({ label: `$${d}`, value: BigInt(d) * USD })),
  ...(available !== undefined && available > 0n ? [{ label: "Max", value: available < max ? available : max }] : []),
];

const problemOf = (v: bigint, min: bigint, max: bigint, available: bigint | undefined): string | null =>
  v === 0n
    ? null
    : v < min
      ? `At least ${dollars(min)}`
      : available !== undefined && v > available
        ? `You have ${dollars(available)}`
        : v > max
          ? `At most ${dollars(max)}`
          : null;

/** What's typed on the keypad, its problem said as it's typed, and only a valid amount kept. */
function useTyped(value: bigint, min: bigint, max: bigint, available: bigint | undefined, keep: (v: bigint) => void) {
  const [typed, setTyped] = useState(value);
  const problem = problemOf(typed, min, max, available);
  const change = (v: bigint) => {
    setTyped(v);
    if (v > 0n && !problemOf(v, min, max, available)) keep(v);
  };
  return { typed, problem, change };
}

export interface RideOrder {
  symbol: string;
  markE8: bigint | null;
  margin: bigint;
  leverageBps: number;
  maxLeverageBps: number;
  trailBps: number;
  terms: RideTermsLike & { minMargin: bigint; maxMargin: bigint; maxLifeSec: number };
  onMargin: (v: bigint) => void;
  onLeverage: (x: number) => void;
  onTrail: (bps: number) => void;
}

export interface CallOrder {
  mode: CallMode;
  offer: Offer;
  quotes: Quotes;
  lineE8: bigint | undefined;
  expiry: number;
  stake: bigint;
  min: bigint;
  max: bigint;
  trailCents: number;
  onMode: (m: CallMode) => void;
  onStake: (v: bigint) => void;
  onTrail: (cents: number) => void;
}

function RideBody({ o, available }: { o: RideOrder; available: bigint | undefined }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const unit = unitOf(o.symbol);
  const up = o.markE8 ? rideQuote(true, o.margin, o.leverageBps, o.markE8, o.terms) : null;
  const down = o.markE8 ? rideQuote(false, o.margin, o.leverageBps, o.markE8, o.terms) : null;
  const money = (v: bigint) => masked(dollars(v), hidden);
  const amount = useTyped(o.margin, o.terms.minMargin, o.terms.maxMargin, available, o.onMargin);
  return (
    <>
      <AmountPad
        label="Margin"
        value={amount.typed}
        chips={chipsOf(RIDE_MARGIN_USD, o.terms.maxMargin, available)}
        {...(available === undefined ? {} : { note: `Available ${money(available)}` })}
        problem={amount.problem}
        onChange={amount.change}
      />
      <Section title={`Leverage · up to ${o.maxLeverageBps / ONE_X}×`}>
        <Text style={[TYPE.displayPrice, { color: color.ink }]}>{o.leverageBps / ONE_X}×</Text>
        <Chips
          items={leverageChips(o.maxLeverageBps).map((x) => ({ key: String(x), label: `${x}×` }))}
          chosen={String(o.leverageBps / ONE_X)}
          onPick={(k) => o.onLeverage(Number(k))}
        />
        {up && down ? (
          <>
            <Text style={[TYPE.row, { color: color.ink }]}>
              <Text style={{ color: color.up }}>UP</Text> · {knockOutWords(up, unit)}
            </Text>
            <Text style={[TYPE.row, { color: color.ink }]}>
              <Text style={{ color: color.down }}>DOWN</Text> · {knockOutWords(down, unit)}
            </Text>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Knocked out when 90% of the margin is lost.</Text>
          </>
        ) : null}
      </Section>
      <Section title="Trailing stop">
        <Chips
          items={RIDE_TRAIL_STEPS_BPS.map((b) => ({ key: String(b), label: trailText(b) }))}
          chosen={String(o.trailBps)}
          onPick={(k) => o.onTrail(Number(k))}
        />
      </Section>
      {up && down ? (
        <View>
          <Row k="Trade size" v={money(up.notional)} />
          <Row k="Opening fee" v={money(up.fee)} />
          <Row k="Estimated closing fee" v={`about ${money(up.fee)}`} />
          <Row k="Max profit" v={money(up.reserve)} />
          <Row k="Up · Down" v={`${capWords(up, unit)} · ${priceText(down.capE8, unit)}`} />
          <Row k="Closes after" v={`${o.terms.maxLifeSec / SECONDS_PER_HOUR} h at most`} />
          {available !== undefined ? <Row k="After this" v={money(available - up.cost)} /> : null}
        </View>
      ) : null}
    </>
  );
}

function CallBody({ o, available }: { o: CallOrder; available: bigint | undefined }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const money = (v: bigint) => masked(dollars(v), hidden);
  const amount = useTyped(o.stake, o.min, o.max, available, o.onStake);
  const [a, b] = o.offer;
  const wins =
    o.mode === "updown" && o.lineE8 !== undefined
      ? `Up wins above ${priceText(o.lineE8)} at ${at(o.expiry)}; Down wins below. Exactly on the line refunds.`
      : `${[a, b].flatMap((x) => (x ? [`${x.label} wins ${x.where}`] : [])).join("; ")} at ${at(o.expiry)}.`;
  const sides = [
    [a, o.quotes.first],
    [b, o.quotes.second],
  ] as const;
  return (
    <>
      <Section title="Call type">
        <Segmented options={CALL_MODES} value={o.mode} onChange={o.onMode} label="Call type" />
        <Text style={[TYPE.rowDetail, { color: color.inkMuted }]}>{wins}</Text>
      </Section>
      <AmountPad
        label="Stake"
        value={amount.typed}
        chips={chipsOf(STAKE_PRESETS_USD, o.max, available)}
        {...(available === undefined ? {} : { note: `Available ${money(available)}` })}
        problem={amount.problem}
        onChange={amount.change}
      />
      <Section title="Trailing stop">
        <Chips
          items={TRAIL_CENTS.map((c) => ({ key: String(c), label: `${c}¢` }))}
          chosen={String(o.trailCents)}
          onPick={(k) => o.onTrail(Number(k))}
        />
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Behind the best bid per share, past break-even.</Text>
      </Section>
      <View>
        <Row k="Stake" v={money(o.stake)} />
        {sides.map(([side, q]) =>
          side && q && !q.refusal ? (
            <Row key={side.label} k={`${side.label} pays if right`} v={money(q.payout)} />
          ) : null,
        )}
        {sides.map(([side, q]) =>
          side && q && !q.refusal ? (
            <Row
              key={`${side.label}-fee`}
              k={`Fees in ${side.label}'s price`}
              v={money(o.stake - (q.payout * q.probE6) / P_ONE)}
            />
          ) : null,
        )}
        <Row k="Settles at" v={at(o.expiry)} />
        {available !== undefined ? <Row k="After this" v={money(available - o.stake)} /> : null}
      </View>
    </>
  );
}

function Done() {
  const close = useSheetClose();
  return <Button label="Done" onPress={() => close()} />;
}

export function OrderSheet({
  symbol,
  ride,
  call,
  available,
  onClose,
}: {
  symbol: string;
  ride: RideOrder | null;
  call: CallOrder;
  available: bigint | undefined;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} closeLabel="Close the order settings" detents={LIST_DETENTS}>
      <SheetHeading title={`${symbol} · ${ride ? "Ride" : "Call"} settings`} />
      <View style={styles.body}>
        {ride ? <RideBody o={ride} available={available} /> : <CallBody o={call} available={available} />}
        <Done />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.lg, paddingBottom: SPACE.lg },
  section: { gap: SPACE.sm },
  title: { letterSpacing: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  chip: {
    minHeight: SIZE.chipHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: SIZE.chipHeight / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: SPACE.xs },
});
