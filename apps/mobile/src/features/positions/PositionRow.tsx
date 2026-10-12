/**
 * One open position on the phone (Tradash's position row, R5.3): the market's mark, "BTC ↗" with its lane or leverage
 * and when it ends, then ROI over PnL rolling with the price (D-303: from the fill's fair price; red the moment PnL <
 * 0). A tap opens the facts — line or knock-out, entry, now, fees, what it pays — and Cash out (a call) or Close (a
 * ride) for the exact amount it returns now. A held state says why in words.
 */
import { type BookEntry, closeWord, dollars, leverageText, positionHold, positionSub, unitOf } from "@senryo/calls";
import { laneLabel, priceText } from "@senryo/core";
import { marketId } from "@senryo/identity";
import type { SkFont } from "@shopify/react-native-skia";
import { type ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { RollingFigure } from "~/components/kit/RollingFigure";
import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, Lock } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MARK = 32;
const FIGURE_H = 22;
const FIGURE_W = 104;
const BPS_PER_PERCENT = 100;
const PCT_DECIMALS = 1;

const signed = (v: bigint) => `${v < 0n ? "−" : "+"}${dollars(v)}`;
const pctText = (bps: number) => `${bps < 0 ? "−" : "+"}${Math.abs(bps / BPS_PER_PERCENT).toFixed(PCT_DECIMALS)}%`;

function Fact({ k, v, down }: { k: string; v: ReactNode; down?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{k}</Text>
      <Text style={[TYPE.rowAmount, { color: down ? color.down : color.ink }]}>{v}</Text>
    </View>
  );
}

function Facts({ e, hidden }: { e: BookEntry; hidden: boolean }) {
  const unit = unitOf(e.symbol);
  const price = (v: bigint | null | undefined) => (v === null || v === undefined ? "—" : priceText(v, unit));
  const money = (v: bigint | null) => (v === null ? "—" : masked(dollars(v), hidden));
  if (e.kind === "ride" && e.ride) {
    return (
      <View>
        <Fact k="Direction" v={`${e.label} · ${leverageText(e.ride.leverageBps)}`} />
        <Fact k="Entry" v={price(e.entryE8)} />
        <Fact k="Now" v={price(e.markE8)} />
        <Fact k="Knocked out at" v={price(e.ride.koE8)} down />
        <Fact k="Capped at" v={price(e.ride.capE8)} />
        <Fact k="Margin" v={money(e.cost)} />
        <Fact k="Fees" v={money(e.fees)} />
      </View>
    );
  }
  return (
    <View>
      <Fact k="Call" v={`${e.label} · ${e.call ? laneLabel(e.call.cadenceSec) : ""}`} />
      <Fact k="Line" v={price(e.call?.lineE8)} />
      <Fact k="Entry" v={price(e.entryE8)} />
      <Fact k="Now" v={price(e.markE8)} />
      <Fact k="Staked" v={money(e.cost)} />
      <Fact k="Pays if right" v={money(e.call?.shares ?? null)} />
      <Fact k="Fees" v={money(e.fees)} />
    </View>
  );
}

function Figures({ e, font, hidden }: { e: BookEntry; font: SkFont | null; hidden: boolean }) {
  const { color } = useTheme();
  if (e.state === "opening" || e.state === "closing") return <ActivityIndicator color={color.text3} />;
  if (e.pnl === null || e.roiBps === null) {
    return e.state === "locked" ? (
      <Lock size={SIZE.iconSm} color={color.text3} />
    ) : (
      <Text style={[TYPE.rowAmount, { color: color.text3 }]}>—</Text>
    );
  }
  const tone = e.pnl >= 0n ? color.up : color.down;
  return (
    <View style={styles.figures}>
      <Text style={[TYPE.rowPrice, { color: tone }]}>{pctText(e.roiBps)}</Text>
      {hidden ? (
        <Text style={[TYPE.moneyMeta, { color: tone }]}>{masked("", true)}</Text>
      ) : (
        <View style={styles.figure}>
          <RollingFigure
            text={signed(e.pnl)}
            value={e.pnl}
            font={font}
            color={tone}
            height={FIGURE_H}
            accessibilityLabel={`PnL ${signed(e.pnl)}`}
          />
        </View>
      )}
    </View>
  );
}

export function PositionRow({
  entry: e,
  closing,
  onClose,
  font,
}: {
  entry: BookEntry;
  closing: boolean;
  onClose: (e: BookEntry) => void;
  font: SkFont | null;
}) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const [open, setOpen] = useState(false);
  const hold = positionHold(e);
  const Dir = e.up === null ? ArrowLeftRight : e.up ? ArrowUp : ArrowDown;
  return (
    <Animated.View layout={LinearTransition} style={[styles.card, { backgroundColor: color.raised2 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${e.symbol} ${e.label}, ${hold ?? positionSub(e)}`}
        onPress={() => {
          fire("tick");
          setOpen((o) => !o);
        }}
        style={styles.head}
      >
        <EntityMark id={marketId(e.symbol)} size={MARK} decorative />
        <View style={styles.title}>
          <View style={styles.symbol}>
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>{e.symbol}</Text>
            <Dir size={SIZE.iconSm} color={e.up === null ? color.text3 : e.up ? color.up : color.down} />
          </View>
          <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
            {hold ?? positionSub(e)}
          </Text>
        </View>
        <Figures e={e} font={font} hidden={hidden} />
        <View style={open ? styles.flip : undefined}>
          <ChevronDown size={SIZE.iconSm} color={color.text3} />
        </View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.body}>
          <Facts e={e} hidden={hidden} />
          <Button
            label={e.closeValue === null ? closeWord(e) : `${closeWord(e)} ${masked(dollars(e.closeValue), hidden)}`}
            onPress={() => onClose(e)}
            disabled={e.closeValue === null}
            loading={closing}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHEET_SHAPE.rowRadius },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.md },
  title: { flex: 1, minWidth: 0 },
  symbol: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  figures: { alignItems: "flex-end" },
  figure: { width: FIGURE_W, height: FIGURE_H },
  flip: { transform: [{ rotate: "180deg" }] },
  body: { gap: SPACE.md, paddingHorizontal: SPACE.md, paddingBottom: SPACE.md },
  fact: { flexDirection: "row", justifyContent: "space-between", paddingVertical: SPACE.xs },
});
