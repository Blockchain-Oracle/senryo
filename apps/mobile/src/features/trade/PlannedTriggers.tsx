/**
 * SL/TP for the order being entered (S1b.8a): the same price / % fields as for a held position, measured from the
 * oracle price and checked against the liquidation price this order would have (the ticket's preview). Setting them
 * signs nothing: they are placed, each as its own transaction, right after the order opens — the receipt shows each
 * outcome, and a level that doesn't land leaves the position open without it, said plainly.
 */
import type { LiveMarket } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { price18, priceDecimalsOf } from "~/lib/money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { usePlannedTriggers } from "./planned-triggers";
import { TriggerInput } from "./TriggerInput";
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

const KINDS: readonly TriggerKind[] = ["sl", "tp"];
const NAME: Record<TriggerKind, string> = { sl: "Stop loss", tp: "Take profit" };

export function PlannedTriggers({
  market,
  isLong,
  liq18,
  planKey,
  onDone,
}: {
  market: LiveMarket;
  isLong: boolean;
  /** The liquidation price the order would have, from the ticket's preview; undefined before an amount is entered. */
  liq18: bigint | null | undefined;
  planKey: string;
  onDone: () => void;
}) {
  const { color } = useTheme();
  const plan = usePlannedTriggers(planKey);
  const mark = market.pv.price18;
  const decimals = priceDecimalsOf(market.marketId);
  const problemOf = (kind: TriggerKind) => {
    const value = parsePrice(plan.fields[kind].price);
    return value === undefined ? undefined : triggerProblem({ kind, isLong, price18: value, mark18: mark, liq18 });
  };
  const setPrice = (kind: TriggerKind, text: string) => {
    const value = parsePrice(text);
    plan.setField(kind, { price: text, percent: value ? percentText(bpsFromPrice(mark, value)) : "" });
  };
  const setPercent = (kind: TriggerKind, text: string) => {
    const bps = parsePercent(text);
    const value = bps === undefined ? undefined : priceFromBps(mark, bps, kind, isLong);
    plan.setField(kind, { percent: text, price: value !== undefined && value > 0n ? priceText(value, decimals) : "" });
  };
  const valid = plan.levels.every((l) => problemOf(l.kind) === undefined);
  return (
    <>
      <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
        For the {isLong ? "long" : "short"} you are entering. Nothing is signed now: each level is placed right after
        the order opens, for its full size. Oracle price ${price18(mark, decimals)}.
      </Text>
      {KINDS.map((kind) => {
        const problem = problemOf(kind);
        const sign = isAbove(kind, isLong) ? "+" : "−";
        return (
          <View key={kind} style={styles.group}>
            <View style={styles.fieldRow}>
              <Text style={[TYPE.rowStrong, styles.kind, { color: color.ink }]}>{NAME[kind]}</Text>
              <TriggerInput
                value={plan.fields[kind].price}
                placeholder={kind === "sl" ? "SL price" : "TP price"}
                prefix="$"
                onChange={(text) => setPrice(kind, text)}
                onFocus={() => undefined}
                label={`${NAME[kind]} price`}
              />
              <TriggerInput
                value={plan.fields[kind].percent}
                placeholder="0"
                prefix={sign}
                suffix="%"
                onChange={(text) => setPercent(kind, text)}
                onFocus={() => undefined}
                label={`${NAME[kind]} percent from the oracle price`}
              />
            </View>
            {problem ? (
              <Text style={[TYPE.meta, styles.note, { color: color.down }]}>
                {problem.code === "SIDE"
                  ? `For a ${isLong ? "long" : "short"}, this must be ${problem.above ? "above" : "below"} the oracle price.`
                  : problem.code === "PAST_LIQUIDATION"
                    ? `Past this order's liquidation price ($${price18(problem.liq18, decimals)}).`
                    : "Enter a price above zero."}
              </Text>
            ) : null}
          </View>
        );
      })}
      {liq18 === undefined ? (
        <Text style={[TYPE.meta, { color: color.text3 }]}>
          Enter an amount to check a stop loss against the liquidation price.
        </Text>
      ) : null}
      <Button
        label={plan.levels.length > 0 ? "Set for this order" : "Back to order"}
        disabled={!valid}
        onPress={() => {
          fire("tick");
          onDone();
        }}
      />
      {plan.levels.length > 0 ? (
        <Button
          label="Clear both"
          variant="ghost"
          size="sm"
          onPress={() => {
            fire("tick");
            plan.clearAll();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: SPACE.xs },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  kind: { width: SIZE.avatarXl + SPACE.lg },
  note: { paddingLeft: SIZE.avatarXl + SPACE.lg + SPACE.sm },
});
