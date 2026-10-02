/**
 * The swap's two plates (Phantom P20; 21st.dev ssychui/swap-ticket #27122): "You pay" — the typed amount, the asset
 * chip ⌄, its value and balance with Max — over "You receive" — the estimate and the chip over verified tokens — with
 * the round flip between them. Flipping turns the disc 180° and the two plates really trade places (a layout spring
 * keyed by asset), as in the source. Under them: one line, rate · impact (amber over 1 %), and Details on request.
 */
import { ids } from "@senryo/identity";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { useGroupFill } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { ArrowDownUp, ChevronDown } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { AssetMark } from "~/features/money/AssetMark";
import type { MoneyAsset } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";
import { ReviewRow } from "~/features/money/Review";
import { tokenAmount } from "~/features/tokens/format";
import { fire } from "~/feedback/fire";
import { usd } from "~/lib/money";
import {
  BUTTON,
  CONTROL_FONT_SCALE,
  HERO_FONT_SCALE,
  RADIUS,
  SHEET_SHAPE,
  SIZE,
  SPACE,
  SPRING,
  TYPE,
  useTheme,
} from "~/theme";
import { hopsText, impactText, monFee, rateText, swapProviderName } from "./swap-format";
import type { SwapState } from "./useSwap";

const HALF_TURN = 180;
const SKELETON_AMOUNT = 120;

/** The asset chip: mark, symbol, ⌄ (opens the picker). */
function AssetChip({ asset, onPress, label }: { asset: MoneyAsset; onPress: () => void; label: string }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${asset.symbol}. Change`}
        style={[styles.chip, { backgroundColor: color.raised2 }]}
      >
        <AssetMark asset={asset} size={SIZE.markInline + SPACE.xs} />
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, { color: color.ink }]}>
          {asset.symbol}
        </Text>
        <ChevronDown size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text2} />
      </Pressable>
    </Animated.View>
  );
}

function Plate({ label, amount, chip, foot }: { label: string; amount: ReactNode; chip: ReactNode; foot: ReactNode }) {
  const { color } = useTheme();
  const fill = useGroupFill();
  return (
    <View style={[styles.plate, { backgroundColor: fill }]}>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
        {label}
      </Text>
      <View style={styles.line}>
        <View style={styles.amount}>{amount}</View>
        {chip}
      </View>
      <View style={styles.foot}>{foot}</View>
    </View>
  );
}

export function PayPlate({ s, onPick }: { s: SwapState; onPick: () => void }) {
  const { color } = useTheme();
  const { pay, input } = s;
  return (
    <Plate
      label="You pay"
      amount={
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`You pay ${input.text || "0"} ${pay.symbol}`}
          style={[TYPE.displayPrice, { color: input.text ? (input.over ? color.down : color.ink) : color.text3 }]}
        >
          {input.text || "0"}
        </Text>
      }
      chip={<AssetChip asset={pay} onPress={onPick} label="You pay" />}
      foot={
        <>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{input.usd6 !== null ? usd(input.usd6) : " "}</Text>
          <Pressable
            onPress={input.fillMax}
            disabled={s.available === 0n}
            accessibilityRole="button"
            hitSlop={SPACE.sm}
          >
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
              {amountOf(pay, s.available)} · <Text style={{ color: color.link }}>Max</Text>
            </Text>
          </Pressable>
        </>
      }
    />
  );
}

export function ReceivePlate({ s, onPick }: { s: SwapState; onPick: () => void }) {
  const { color } = useTheme();
  const receive = s.receive;
  const estimate = s.ok && receive ? tokenAmount(s.ok.quote.amountOut, receive.decimals) : undefined;
  return (
    <Plate
      label="You receive"
      amount={
        s.block === "quoting" ? (
          <Skeleton width={SKELETON_AMOUNT} height={SIZE.skeletonRow} />
        ) : (
          <Text
            maxFontSizeMultiplier={HERO_FONT_SCALE}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[TYPE.displayPrice, { color: estimate ? color.ink : color.text3 }]}
          >
            {estimate ?? "0"}
          </Text>
        )
      }
      chip={
        receive ? (
          <AssetChip asset={receive} onPress={onPick} label="You receive" />
        ) : (
          <Pressable
            onPress={onPick}
            accessibilityRole="button"
            style={[styles.chip, { backgroundColor: color.raised2 }]}
          >
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>Choose</Text>
          </Pressable>
        )
      }
      foot={
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          {receive && receive.total > 0n ? `You hold ${amountOf(receive, receive.total)}` : " "}
        </Text>
      }
    />
  );
}

/** Both plates with the flip disc on their seam; the plates trade places on a flip. */
export function SwapPlates({
  s,
  onPickPay,
  onPickReceive,
}: {
  s: SwapState;
  onPickPay: () => void;
  onPickReceive: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const turn = useSharedValue(0);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const plates = [
    { key: `${s.pay.key}:pay`, node: <PayPlate s={s} onPick={onPickPay} /> },
    { key: `${s.receive?.key ?? "none"}:receive`, node: <ReceivePlate s={s} onPick={onPickReceive} /> },
  ];
  return (
    <View>
      {plates.map((p, i) => (
        <Animated.View key={p.key} layout={LinearTransition.springify()} style={i === 0 ? styles.first : null}>
          {p.node}
        </Animated.View>
      ))}
      <View style={styles.flipSlot} pointerEvents="box-none">
        <Animated.View style={[press.style, spin]}>
          <Pressable
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            onPress={() => {
              fire("tick");
              turn.value = withSpring(turn.value + HALF_TURN, SPRING.compactSelector);
              s.flip();
            }}
            disabled={!s.receive}
            accessibilityRole="button"
            accessibilityLabel="Flip pair"
            style={[styles.flip, { backgroundColor: color.raised2, borderColor: color.ground }]}
          >
            <ArrowDownUp size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.ink} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

/** "1 USDC = 0.000204 XAUt0 · impact 0.40%", amber past 1 %; Details opens route, minimum, fee and steps. */
export function QuoteLine({ s }: { s: SwapState }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const q = s.ok;
  useEffect(() => {
    if (!q) setOpen(false);
  }, [q]);
  if (!q || !s.receive) return null;
  const tone = q.quote.impact === "ok" ? color.text2 : q.quote.impact === "warn" ? color.warn : color.down;
  const high = q.quote.impact !== "ok" ? `High ${impactText(q)}` : impactText(q);
  const steps = [
    ...(s.pay.collateral && s.input.amount > s.pay.wallet ? ["Pull from trades"] : []),
    ...(s.pay.native ? [] : [`Approve ${s.pay.symbol}`]),
    "Swap",
  ];
  return (
    <View style={styles.quote}>
      <Pressable
        onPress={() => {
          fire("tick");
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.quoteLine}
      >
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[TYPE.rowDetail, styles.grow, { color: tone }]}
        >
          {rateText(q)} · {high}
        </Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={SIZE.iconSm} color={color.text3} />
        </View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn}>
          <ReviewRow
            label="Route"
            value={`${swapProviderName(q.quote.provider)} · ${hopsText(q)}`}
            mark={
              <EntityMark
                id={ids.provider(q.quote.provider)}
                label={swapProviderName(q.quote.provider)}
                size={SIZE.markChip}
                decorative
              />
            }
          />
          <ReviewRow label="Minimum received" value={amountOf(s.receive, q.quote.minOut)} />
          <ReviewRow label="Network fee" value={`≈ ${monFee(s.feeWei)}`} />
          <ReviewRow label="Steps" value={steps.join(" · ")} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The flip disc's ring is the page ground, so it reads as cut into the seam between the plates. */
const FLIP_RING = SPACE.xs;

const styles = StyleSheet.create({
  plate: { borderRadius: SHEET_SHAPE.rowRadius, padding: SPACE.lg, gap: SPACE.xs },
  first: { marginBottom: SPACE.xs },
  line: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.skeletonRow },
  amount: { flex: 1 },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACE.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs + SPACE.xxs,
    paddingLeft: SPACE.xs + SPACE.xxs,
    paddingRight: SPACE.md,
    minHeight: SIZE.touch,
    borderRadius: BUTTON.radius.md,
  },
  flipSlot: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  flip: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: RADIUS.pill,
    borderWidth: FLIP_RING,
    alignItems: "center",
    justifyContent: "center",
  },
  quote: { gap: SPACE.xs },
  quoteLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.touch },
  grow: { flex: 1 },
});
