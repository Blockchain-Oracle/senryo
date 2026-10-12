/**
 * The slip, open (P3, D-326; Codex's slip, Owarine's "Pays 4.12×" hero, Mitoshi's hold-to-place): each leg with its
 * lane's round and both sides' indicative odds (switch a side in place, ✕ to drop it), what the whole parlay pays —
 * priced by the chain's own quote, never the legs' odds multiplied — and how likely, the stake (presets, or any amount
 * in the stake sheet), the least it fills for, and a hold to place it. The button names whatever blocks it. A guest
 * picks and prices freely; placing is the passkey step, with the slip kept (value first, sign last).
 */
import {
  chanceText,
  indicativeOdds,
  legClock,
  PARLAY_SIDES,
  PARLAY_STAKES_USD,
  type ParlayPick,
  payoutMultiple,
  placeWords,
  TOLERANCE_BPS,
  unpricedLine,
} from "@senryo/calls";
import type { ParlayQuoteView } from "@senryo/calls/react";
import type { CadenceSec } from "@senryo/config";
import { lane, usd, usdTidy, withTolerance } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { HoldButton } from "~/components/kit/HoldButton";
import { X } from "~/components/kit/symbols";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { StakeSheet } from "~/components/sheet/StakeSheet";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MARK = 32;
const USD = 1_000_000n;
const ODDS_DECIMALS = 2;
const CHIP_HEIGHT = SIZE.touch - SPACE.sm;
const PRESETS = PARLAY_STAKES_USD.map((d) => BigInt(d) * USD);

interface SlipProps {
  quote: ParlayQuoteView;
  minHalfSpreadE6: number;
  stake: bigint;
  onStake: (stake: bigint) => void;
  onPick: (pick: ParlayPick) => void;
  onRemove: (symbol: string) => void;
  onPlace: () => void;
  pending: string | null;
  balance: bigint | undefined;
  signedIn: boolean;
  limits: { min: bigint; max: bigint };
}

function Slip(p: SlipProps) {
  const { color } = useTheme();
  const close = useSheetClose();
  const [custom, setCustom] = useState(false);
  const { legs, quote: q, now, trading } = p.quote;
  // Between rounds the legs' closing windows price nothing for the next: the price waits for it.
  const priced = trading && q !== null && !q.refusal;
  const multiple = priced ? payoutMultiple(p.stake, q.payout) : null;
  const first = legs[0];
  const place = placeWords({
    legs: legs.length,
    trading,
    nextOpensInSec: first ? Math.max(0, first.window.expiry - now) : 0,
    priced,
    refused: q?.refusal !== undefined && q.refusal !== null,
    short: p.signedIn && p.balance !== undefined && p.balance < p.stake,
    stake: p.stake,
  });
  const presetOn = PRESETS.includes(p.stake);
  return (
    <View style={styles.body}>
      <View style={styles.title}>
        <Text accessibilityRole="header" style={[TYPE.sheetHeading, { color: color.ink }]}>
          Your parlay
        </Text>
        <Pressable
          onPress={() => close()}
          hitSlop={SPACE.sm}
          accessibilityRole="button"
          accessibilityLabel="Close the slip"
          style={[styles.round, { backgroundColor: color.raised2 }]}
        >
          <X size={SIZE.iconSm} color={color.ink} />
        </Pressable>
      </View>
      {legs.map((l) => (
        <View key={l.pick.symbol} style={styles.leg}>
          <EntityMark id={marketId(l.pick.symbol)} size={MARK} decorative />
          <View style={styles.flex}>
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>
              {l.pick.symbol} · {lane(l.pick.cadenceSec)}
            </Text>
            <Text numberOfLines={1} style={[TYPE.caption, { color: color.inkMuted }]}>
              {legClock(l.window, now)}
            </Text>
          </View>
          {PARLAY_SIDES.map((side) => {
            const odds = l.window.trading
              ? indicativeOdds(l.sides[side.band] ?? null, p.minHalfSpreadE6, l.pick.cadenceSec as CadenceSec)
              : null;
            const on = l.pick.band === side.band;
            const tone = side.band === 0 ? color.up : color.down;
            return (
              <Pressable
                key={side.band}
                onPress={() => {
                  if (on) return;
                  fire("tick");
                  p.onPick({ ...l.pick, band: side.band });
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${l.pick.symbol} ${side.label}${odds === null ? "" : `, about ${odds.toFixed(ODDS_DECIMALS)} times`}`}
                style={[styles.side, { backgroundColor: on ? tone : color.raised2 }]}
              >
                <Text style={[TYPE.chipLabel, { color: on ? color.ground : color.ink }]}>
                  {odds === null ? side.label : `${side.label} ${odds.toFixed(ODDS_DECIMALS)}×`}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              fire("tick");
              if (legs.length === 1) close(() => p.onRemove(l.pick.symbol));
              else p.onRemove(l.pick.symbol);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${l.pick.symbol}`}
            hitSlop={SPACE.sm}
          >
            <X size={SIZE.iconSm} color={color.inkMuted} />
          </Pressable>
        </View>
      ))}
      <View style={styles.hero} accessibilityLiveRegion="polite">
        <Text style={[TYPE.numXl, { color: priced ? color.ink : color.text3 }]}>
          {multiple ? `Pays ${multiple}` : "—"}
        </Text>
        <Text style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>
          {priced
            ? `${usd(q.payout)} if all ${legs.length} land · ${chanceText(q.chanceE6)} chance`
            : unpricedLine(legs.length, trading)}
        </Text>
      </View>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Stake">
        {PRESETS.map((v) => {
          const on = p.stake === v;
          return (
            <Pressable
              key={String(v)}
              onPress={() => {
                fire("tick");
                p.onStake(v);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { backgroundColor: on ? color.ink : color.raised2 }]}
            >
              <Text style={[TYPE.chipLabel, { color: on ? color.ground : color.ink }]}>{usdTidy(v)}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setCustom(true)}
          accessibilityRole="button"
          accessibilityLabel={presetOn ? "Another amount" : `Stake ${usd(p.stake)}, change it`}
          style={[styles.chip, { backgroundColor: presetOn ? color.raised2 : color.ink }]}
        >
          <Text style={[TYPE.chipLabel, { color: presetOn ? color.ink : color.ground }]}>
            {presetOn ? "…" : usdTidy(p.stake)}
          </Text>
        </Pressable>
      </View>
      <Text style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>
        {p.pending ??
          (priced
            ? `Fills only if it still pays ${usd(withTolerance(q.payout, TOLERANCE_BPS))} or more. One miss and the stake is the pool's.`
            : "One miss and the stake is the pool's.")}
      </Text>
      <HoldButton
        label={place.label}
        holdingLabel="Keep holding to place…"
        ready={place.ready}
        busy={p.pending !== null}
        onConfirm={p.onPlace}
      />
      {custom ? (
        <StakeSheet
          current={p.stake}
          min={p.limits.min}
          max={p.limits.max}
          balance={p.signedIn ? p.balance : undefined}
          per="a parlay"
          onPick={p.onStake}
          onClose={() => setCustom(false)}
        />
      ) : null}
    </View>
  );
}

export function ParlaySlipSheet({ onClose, ...props }: SlipProps & { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} closeLabel="Close the slip">
      <Slip {...props} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md, paddingBottom: SPACE.sm },
  title: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round: {
    width: CHIP_HEIGHT,
    height: CHIP_HEIGHT,
    borderRadius: CHIP_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  leg: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  flex: { flex: 1 },
  side: {
    minHeight: CHIP_HEIGHT,
    borderRadius: CHIP_HEIGHT / 2,
    paddingHorizontal: SPACE.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { alignItems: "center", gap: SPACE.xxs, paddingVertical: SPACE.sm },
  center: { textAlign: "center" },
  chips: { flexDirection: "row", gap: SPACE.sm },
  chip: {
    flex: 1,
    minHeight: CHIP_HEIGHT,
    borderRadius: CHIP_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
