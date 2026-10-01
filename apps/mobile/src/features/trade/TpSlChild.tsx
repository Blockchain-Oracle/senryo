import type { PositionView, TxRequest } from "@senryo/chain";
import { previewDecrease, RISK } from "@senryo/core";
import {
  cancelTriggerRequest,
  type LiveMarket,
  placeTriggerRequest,
  triggerOrder,
  useQueryEnv,
  useSendTrace,
  useTriggers,
} from "@senryo/query";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { usePosition } from "~/features/positions/usePosition";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { pct, price18, priceDecimalsOf, signedUsd } from "~/lib/money";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { TRIGGER_SUGGESTIONS_BPS } from "./constants";
import {
  bpsFromPrice,
  isAbove,
  parsePercent,
  parsePrice,
  percentText,
  priceFromBps,
  priceText,
  type TriggerKind,
  triggerProblem,
} from "./tpsl";
import { useEnsureGas } from "./useGasTopUp";

const TITLE = "Stop loss and take profit";
const SUBTITLE = "Auto close the position when it hits your price target.";

/**
 * The TP/SL child (FT110–FT112, C42, F44/F45/M15; Codex S1b.7 consult #2). It works on the position already held in
 * this market: the order being entered opens without SL/TP, and attaching levels to a not-yet-open order is a logic
 * change left to the lead. With no position it explains that and returns to the order; it never offers a pretend Save.
 */
export function TpSlChild({
  open,
  onClose,
  market,
  held,
}: {
  open: boolean;
  onClose: () => void;
  market: LiveMarket;
  held: PositionView | undefined;
}) {
  const { color } = useTheme();
  return (
    <ChildSheet open={open} onClose={onClose} title={TITLE} subtitle={SUBTITLE}>
      {held ? (
        <HeldTriggers market={market} position={held} onDone={onClose} />
      ) : (
        <>
          <Text style={[TYPE.rowStrong, { color: color.ink }]}>Open your position first</Text>
          <Text style={[TYPE.body, { color: color.text2 }]}>
            This order opens without SL/TP. After it opens, add stop loss or take profit here or from your position
            details.
          </Text>
          <Explainer kind="Stop loss" body="Closes the position if the price moves against you to your level." />
          <Explainer kind="Take profit" body="Closes the position when the price reaches your target." />
          <Button label="Back to order" variant="secondary" onPress={onClose} />
        </>
      )}
    </ChildSheet>
  );
}

function Explainer({ kind, body }: { kind: string; body: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.explainer, { borderColor: color.border }]}>
      <Text style={[TYPE.rowStrong, { color: color.ink }]}>{kind}</Text>
      <Text style={[TYPE.meta, { color: color.text2 }]}>{body}</Text>
    </View>
  );
}

type Field = { price: string; percent: string };
const EMPTY: Field = { price: "", percent: "" };

function HeldTriggers({
  market,
  position,
  onDone,
}: {
  market: LiveMarket;
  position: PositionView;
  onDone: () => void;
}) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const p = usePosition(market.marketId);
  const triggers = useTriggers(address);
  const trace = useSendTrace();
  const gas = useEnsureGas();
  const [fields, setFields] = useState<Record<TriggerKind, Field>>({ sl: EMPTY, tp: EMPTY });
  const [focus, setFocus] = useState<TriggerKind | undefined>();
  const mark = market.pv.price18;
  const decimals = priceDecimalsOf(market.marketId);
  const liq = p.health?.liqPrice18;
  const side = position.isLong ? "Long" : "Short";

  const priceOf = (kind: TriggerKind) => parsePrice(fields[kind].price);
  const problemOf = (kind: TriggerKind) => {
    const value = priceOf(kind);
    return value === undefined
      ? undefined
      : triggerProblem({ kind, isLong: position.isLong, price18: value, mark18: mark, liq18: liq });
  };
  const resultAt = (value: bigint) =>
    previewDecrease(
      market.risk,
      { ...market.pv, price18: value, status: "OPEN" },
      position,
      position.size,
      position.openedBlock + RISK.MIN_HOLD_BLOCKS,
    ).netUsd6;

  const setPrice = (kind: TriggerKind, text: string) => {
    const value = parsePrice(text);
    setFields((f) => ({ ...f, [kind]: { price: text, percent: value ? percentText(bpsFromPrice(mark, value)) : "" } }));
  };
  const setPercent = (kind: TriggerKind, text: string) => {
    const bps = parsePercent(text);
    const value = bps === undefined ? undefined : priceFromBps(mark, bps, kind, position.isLong);
    setFields((f) => ({
      ...f,
      [kind]: { percent: text, price: value !== undefined && value > 0n ? priceText(value, decimals) : "" },
    }));
  };
  const clear = (kind: TriggerKind) => setFields((f) => ({ ...f, [kind]: EMPTY }));

  const entered = (["sl", "tp"] as const).filter((k) => priceOf(k) !== undefined);
  const valid = entered.length > 0 && entered.every((k) => problemOf(k) === undefined);
  const busy = trace.running;
  const failed = trace.events.find((e) => e.stage === "failed" || e.stage === "reverted" || e.stage === "abandoned");
  const saved = !busy && !failed && trace.events.some((e) => e.stage === "finalized");

  const send = async (build: () => Promise<TxRequest>) => {
    const client = account.client;
    if (!client || !address) return;
    const sender = userSender(client, address, account.settings.faceId);
    const request = await build().catch(() => undefined);
    if (request) await trace.run(sender, request, { preflight: gas.preflight(request) });
  };
  const save = async () => {
    fire("press");
    for (const kind of entered) {
      const value = priceOf(kind);
      const client = account.client;
      if (value === undefined || !client || !address) continue;
      await send(async () =>
        placeTriggerRequest(
          userSender(client, address, account.settings.faceId),
          triggerOrder({
            user: address,
            marketId: market.marketId,
            isLong: position.isLong,
            takeProfit: kind === "tp",
            triggerPrice18: value,
            sizeDelta: position.size,
          }),
        ),
      );
    }
    setFields({ sl: EMPTY, tp: EMPTY });
  };

  const marketKey = `ours-${market.marketId}`;
  const active =
    triggers.status === "fresh" || triggers.status === "stale"
      ? triggers.value.filter((t) => t.market_id === marketKey)
      : [];
  const suggestions = focus
    ? TRIGGER_SUGGESTIONS_BPS.filter((bps) => {
        const value = priceFromBps(mark, bps, focus, position.isLong);
        return (
          triggerProblem({ kind: focus, isLong: position.isLong, price18: value, mark18: mark, liq18: liq }) ===
          undefined
        );
      })
    : [];

  return (
    <>
      <Text style={[TYPE.meta, { color: color.text2 }]}>
        Applies to your current {side} position. Size is fixed when signed; additional size is not included. Oracle
        price ${price18(mark, decimals)}.
      </Text>
      {active.map((t) => (
        <View key={t.id} style={[styles.active, { borderColor: color.border }]}>
          <Text style={[TYPE.rowAmount, styles.flex, { color: t.takeProfit ? color.up : color.down }]}>
            {t.takeProfit ? "Take profit" : "Stop loss"} · ${price18(t.triggerPrice, decimals)}
          </Text>
          <Button
            label="Remove"
            size="sm"
            variant="outline"
            block={false}
            disabled={busy}
            onPress={() => void send(async () => cancelTriggerRequest(env.chainId, t.id as `0x${string}`))}
          />
        </View>
      ))}
      {(["sl", "tp"] as const).map((kind) => {
        const value = priceOf(kind);
        const problem = problemOf(kind);
        const sign = isAbove(kind, position.isLong) ? "+" : "−";
        return (
          <View key={kind} style={styles.group}>
            <View style={styles.fieldRow}>
              <Text style={[TYPE.rowStrong, styles.kind, { color: color.ink }]}>
                {kind === "sl" ? "Stop loss" : "Take profit"}
              </Text>
              <Input
                value={fields[kind].price}
                placeholder={kind === "sl" ? "SL price" : "TP price"}
                prefix="$"
                onChange={(text) => setPrice(kind, text)}
                onFocus={() => setFocus(kind)}
                label={`${kind === "sl" ? "Stop loss" : "Take profit"} price`}
              />
              <Input
                value={fields[kind].percent}
                placeholder="0"
                prefix={sign}
                suffix="%"
                onChange={(text) => setPercent(kind, text)}
                onFocus={() => setFocus(kind)}
                label={`${kind === "sl" ? "Stop loss" : "Take profit"} percent from mark`}
              />
            </View>
            <View style={styles.resultRow}>
              <Text style={[TYPE.meta, styles.flex, { color: problem ? color.down : color.text3 }]}>
                {problem
                  ? problemText(problem, position.isLong, decimals)
                  : `${kind === "sl" ? "Potential loss" : "Potential profit"}: ${value === undefined ? "" : signedUsd(resultAt(value))}`}
              </Text>
              <Pressable onPress={() => clear(kind)} accessibilityRole="button" hitSlop={SPACE.sm} style={styles.clear}>
                <X size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
                <Text style={[TYPE.meta, { color: color.text3 }]}>Clear</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {liq === undefined || liq === null ? (
        <Text style={[TYPE.meta, { color: color.warn }]}>Liquidation check unavailable.</Text>
      ) : null}
      {failed ? (
        <Text style={[TYPE.meta, { color: color.down }]}>That didn’t go through; nothing changed.</Text>
      ) : saved ? (
        <Text style={[TYPE.meta, { color: color.up }]}>Saved onchain · finalized. Keepers watch the oracle.</Text>
      ) : null}
      <Button
        label={busy ? "Saving…" : "Save changes"}
        loading={busy}
        disabled={!valid || busy || !account.client}
        onPress={() => void save()}
      />
      {saved ? <Button label="Back to order" variant="ghost" onPress={onDone} /> : null}
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        Keepers close the position when the oracle price crosses your level. In fast markets the fill can be worse than
        your price, and a closed market waits for the open.
      </Text>
      {suggestions.length > 0 ? (
        <View style={styles.suggestions} accessibilityLabel="Suggested levels">
          {suggestions.map((bps) => (
            <Pressable
              key={String(bps)}
              onPress={() => {
                fire("tick");
                if (focus) setPercent(focus, percentText(bps));
              }}
              accessibilityRole="button"
              style={[styles.suggestion, { backgroundColor: color.raised2 }]}
            >
              <Text style={[TYPE.chipLabel, { color: color.ink }]}>
                {focus && isAbove(focus, position.isLong) ? "+" : "−"}
                {pct(bps)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

function problemText(problem: NonNullable<ReturnType<typeof triggerProblem>>, isLong: boolean, decimals: number) {
  const side = isLong ? "a long" : "a short";
  switch (problem.code) {
    case "NOT_POSITIVE":
      return "Enter a price above zero.";
    case "SIDE":
      return `For ${side}, this must be ${problem.above ? "above" : "below"} the oracle price.`;
    case "PAST_LIQUIDATION":
      return `Past the liquidation price ($${price18(problem.liq18, decimals)}): the position would liquidate first.`;
  }
}

function Input({
  value,
  placeholder,
  prefix,
  suffix,
  onChange,
  onFocus,
  label,
}: {
  value: string;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  onChange: (text: string) => void;
  onFocus: () => void;
  label: string;
}) {
  const { color } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.input, { backgroundColor: color.raised2, borderColor: focused ? color.ring : color.border }]}>
      {prefix ? <Text style={[TYPE.rowAmount, { color: color.text3 }]}>{prefix}</Text> : null}
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(",", "."))}
        placeholder={placeholder}
        placeholderTextColor={color.text3}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        onFocus={() => {
          setFocused(true);
          onFocus();
        }}
        onBlur={() => setFocused(false)}
        style={[TYPE.rowAmount, styles.text, { color: color.ink }]}
      />
      {suffix ? <Text style={[TYPE.rowAmount, { color: color.text3 }]}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  explainer: { gap: SPACE.xxs, paddingVertical: SPACE.sm, borderBottomWidth: HAIRLINE_PX },
  active: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderBottomWidth: HAIRLINE_PX,
  },
  flex: { flex: 1 },
  group: { gap: SPACE.xs },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  kind: { width: SIZE.avatarXl + SPACE.lg },
  input: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: SIZE.inputHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.sm,
    borderWidth: HAIRLINE_PX,
    gap: SPACE.xxs,
  },
  text: { flex: 1, paddingVertical: SPACE.xs },
  resultRow: { flexDirection: "row", alignItems: "center", paddingLeft: SIZE.avatarXl + SPACE.lg + SPACE.sm },
  clear: { flexDirection: "row", alignItems: "center", gap: SPACE.xxs, minHeight: SIZE.touch },
  suggestions: { flexDirection: "row", gap: SPACE.sm },
  suggestion: {
    flex: 1,
    minHeight: SIZE.touch,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
