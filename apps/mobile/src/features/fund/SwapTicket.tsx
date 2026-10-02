/**
 * The swap ticket (Phantom P20 anatomy, F26): You pay — token mark, symbol, what you hold — over You receive, with a
 * round flip control between them, the share of the balance as chips, the quote and the minimum received, and the route
 * named with its own mark. Confirming sends `swapCollateral` through the scoped signer; the result is said only once
 * the transaction is finalized. Mainnet only: there is no AUSD/USDC pool on the test network.
 */
import type { AccountSnapshot } from "@senryo/chain";
import { RISK } from "@senryo/core";
import { collateralId, ids } from "@senryo/identity";
import { useQueryEnv } from "@senryo/query";
import { ArrowDownUp } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel, useGroupFill } from "~/components/kit/Surface";
import { usePressScale } from "~/components/kit/usePressScale";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { COLLATERAL_STEPS_BPS } from "~/features/portfolio/constants";
import { OutcomeNote, useOutcome } from "~/features/trade/OutcomeNote";
import { fire } from "~/feedback/fire";
import { pct, usd } from "~/lib/money";
import { BUTTON, RADIUS, SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useCollateralSwap } from "./useCollateralSwap";

const SYMBOL = { usdc: "USDC", ausd: "AUSD" } as const;
const FLIP = SIZE.touch;

export function SwapTicket({ snapshot }: { snapshot: AccountSnapshot }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const s = useCollateralSwap(snapshot);
  // A signed swap that isn't confirmed yet keeps the button locked: a second one could swap twice.
  const { outcome, unresolved } = useOutcome(s.trace.events);
  const to = s.from === "usdc" ? "ausd" : "usdc";
  const held = s.from === "usdc" ? snapshot.usdc : snapshot.ausd;
  const heldTo = to === "usdc" ? snapshot.usdc : snapshot.ausd;
  return (
    <View style={styles.stack}>
      <View>
        <SwapSide
          label="You pay"
          mark={collateralId(env.chainId, SYMBOL[s.from])}
          symbol={SYMBOL[s.from]}
          amount={usd(s.amountIn)}
          note={`You hold ${usd(held)}`}
        />
        <SwapFlip onPress={() => s.setFrom(to)} />
        <SwapSide
          label="You receive ≈"
          mark={collateralId(env.chainId, SYMBOL[to])}
          symbol={SYMBOL[to]}
          amount={s.q ? usd(s.q.amountOut) : "—"}
          note={`You hold ${usd(heldTo)}`}
        />
      </View>
      <Segmented
        options={COLLATERAL_STEPS_BPS.map((b) => ({ value: String(b), label: b >= RISK.BPS ? "All" : pct(b) }))}
        value={String(s.shareBps)}
        onChange={(v) => s.setShareBps(BigInt(v))}
        label="How much to swap"
      />
      <Panel style={styles.rows}>
        <KeyValue label="At least" value={s.q ? usd(s.q.minOut) : "—"} />
        <MarkedLine id={ids.provider("uniswap")} label="Uniswap v4 on Monad" variant="symbol" />
      </Panel>
      {s.quote.status === "failed" ? (
        <Text style={[TYPE.rowDetail, { color: color.down }]}>
          No quote right now. The pool may be busy; try again.
        </Text>
      ) : null}
      {s.busy ? null : (
        <OutcomeNote outcome={outcome} thing="swap" success="Swapped · finalized. Your balances update in a moment." />
      )}
      <HoldToConfirm
        label={s.busy ? "Swapping…" : `Swap ${SYMBOL[s.from]} for ${SYMBOL[to]}`}
        disabled={s.busy || unresolved || !s.q || s.amountIn === 0n || !s.ready}
        resetKey={[env.chainId, s.from, s.amountIn, s.q?.minOut].join(":")}
        onConfirm={() => void s.swap()}
      />
    </View>
  );
}

export function SwapSide({
  label,
  mark,
  symbol,
  amount,
  note,
}: {
  label: string;
  mark: string;
  symbol: string;
  amount: string;
  note: string;
}) {
  const { color } = useTheme();
  const fill = useGroupFill();
  return (
    <View
      style={[styles.side, { backgroundColor: fill }]}
      accessible
      accessibilityLabel={`${label} ${amount} ${symbol}`}
    >
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{label}</Text>
      <View style={styles.sideLine}>
        <Text style={[TYPE.displayPrice, styles.amount, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
          {amount}
        </Text>
        <View style={[styles.token, { backgroundColor: color.raised2 }]}>
          <EntityMark id={mark} size={SIZE.markInline + SPACE.xs} decorative />
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{symbol}</Text>
        </View>
      </View>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{note}</Text>
    </View>
  );
}

export function SwapFlip({ onPress }: { onPress: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <View style={styles.flipSlot} pointerEvents="box-none">
      <Animated.View style={press.style}>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            fire("tick");
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel="Swap direction"
          style={[styles.flip, { backgroundColor: color.raised2, borderColor: color.ground }]}
        >
          <ArrowDownUp size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** The flip disc's ring is the page ground, so it reads as cut into the gap between the two plates. */
const FLIP_RING = SPACE.xs;

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  side: { borderRadius: SHEET_SHAPE.rowRadius, padding: SPACE.lg, gap: SPACE.xs, marginVertical: SPACE.xxs },
  sideLine: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  amount: { flex: 1 },
  token: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs + SPACE.xxs,
    paddingLeft: SPACE.xs + SPACE.xxs,
    paddingRight: SPACE.md,
    paddingVertical: SPACE.xs + SPACE.xxs,
    borderRadius: BUTTON.radius.md,
  },
  flipSlot: { height: 0, alignItems: "center", justifyContent: "center", zIndex: 1 },
  flip: {
    width: FLIP,
    height: FLIP,
    borderRadius: RADIUS.pill,
    borderWidth: FLIP_RING,
    alignItems: "center",
    justifyContent: "center",
  },
  rows: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.xs },
});
