/**
 * Call settings on the phone (Q1, Codex direction 16 §2): the call type, the stake as the hero (the keypad opens on a
 * tap), what it pays drawn under it, the one rule worth a sentence, then the trail and the fees each one line that
 * opens. The old summary rows (stake again, pays if right, fees per side, settles at, after this) are gone.
 */
import {
  CALL_MODES,
  type CallMode,
  callPayoff,
  dollars,
  feeDollars,
  type Offer,
  type Quotes,
  TRAIL_CENTS,
} from "@senryo/calls";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AmountPad } from "~/components/kit/AmountPad";
import { DisclosureRow } from "~/components/kit/DisclosureRow";
import { FactList } from "~/components/kit/FactList";
import { MarksSlider } from "~/components/kit/MarksSlider";
import { Segmented } from "~/components/kit/Segmented";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { HERO_FONT_SCALE, TYPE, useTheme } from "~/theme";
import { STAKE_PRESETS_USD } from "./constants";
import { chipsOf, useTyped } from "./order-parts";
import { PayoffDrawing } from "./PayoffDrawing";

const USD = 1_000_000n;

export interface CallOrder {
  symbol: string;
  mode: CallMode;
  offer: Offer;
  quotes: Quotes;
  lineE8: bigint | undefined;
  /** The window the call goes into: the drawing's ring drains to its settlement. */
  window: { start: number; expiry: number };
  stake: bigint;
  min: bigint;
  max: bigint;
  trailCents: number;
  onMode: (m: CallMode) => void;
  onStake: (v: bigint) => void;
  onTrail: (cents: number) => void;
}

export function CallSettingsBody({ o, available }: { o: CallOrder; available: bigint | undefined }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const [editing, setEditing] = useState(false);
  const money = (v: bigint) => masked(dollars(v), hidden);
  const fine = (v: bigint) => masked(feeDollars(v), hidden);
  const amount = useTyped(o.stake, o.min, o.max, available, o.onStake);
  const top = BigInt(STAKE_PRESETS_USD.at(-1) ?? 1) * USD;
  const payoff = callPayoff(o.offer, o.quotes, o.stake, top < o.max ? top : o.max);
  const fees = payoff.zones.flatMap((z) => (z.fee === null ? [] : [z.fee]));
  const low = fees.reduce((m, f) => (f < m ? f : m), fees[0] ?? 0n);
  const high = fees.reduce((m, f) => (f > m ? f : m), 0n);
  return (
    <>
      <Segmented options={CALL_MODES} value={o.mode} onChange={o.onMode} label="Call type" />
      <View>
        <Text style={[TYPE.rowDetail, { color: color.inkMuted }]}>Stake</Text>
        <Pressable
          onPress={() => {
            fire("tick");
            setEditing((e) => !e);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: editing }}
          accessibilityLabel={`Stake ${money(o.stake)}. Edit`}
          style={styles.hero}
        >
          <Text maxFontSizeMultiplier={HERO_FONT_SCALE} style={[TYPE.displayBalance, { color: color.ink }]}>
            {money(o.stake)}
          </Text>
        </Pressable>
      </View>
      {editing ? (
        <AmountPad
          label="Stake"
          value={amount.typed}
          chips={chipsOf(STAKE_PRESETS_USD, o.max, available)}
          {...(available === undefined ? {} : { note: `Available ${money(available)}` })}
          problem={amount.problem}
          onChange={amount.change}
        />
      ) : null}
      <PayoffDrawing payoff={payoff} lineE8={o.lineE8} symbol={o.symbol} window={o.window} hidden={hidden} />
      {o.mode === "updown" ? (
        <Text style={[TYPE.rowDetail, { color: color.inkMuted }]}>On the line refunds.</Text>
      ) : null}
      <DisclosureRow title="Trail" value={`${o.trailCents}¢`}>
        <MarksSlider
          marks={TRAIL_CENTS}
          value={o.trailCents}
          onChange={o.onTrail}
          format={(c) => `${c}¢`}
          label="Trail, bid cents"
        />
      </DisclosureRow>
      {fees.length > 0 ? (
        <DisclosureRow title="Fees" value={low === high ? fine(low) : `${fine(low)}–${fine(high)}`}>
          <FactList
            facts={payoff.zones.flatMap((z) =>
              z.fee === null ? [] : [{ label: `In ${z.band.label}'s price`, value: feeDollars(z.fee), money: true }],
            )}
          />
        </DisclosureRow>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignSelf: "flex-start" },
  grow: { flex: 1 },
});
