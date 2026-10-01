/**
 * The small filled plate after a name that says what kind of event a row is (Fomo F13/F15's "Thesis" and trade verbs):
 * 8 pt corners, no outline. An authored thesis takes the accent wash so it never reads as a trade; a trade verb is a
 * neutral plate (the side and the result carry the direction colours); a liquidation takes the down wash.
 */
import type { FeedItem } from "@senryo/api-client";
import { StyleSheet, Text } from "react-native";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { TRADE_VERB } from "./format";

export type VerbTone = "thesis" | "trade" | "loss";

export function verbOf(item: Pick<FeedItem, "kind" | "trade">): { label: string; tone: VerbTone } {
  if (!item.trade) return { label: "Thesis", tone: "thesis" };
  return { label: TRADE_VERB[item.trade.fillKind], tone: item.trade.fillKind === "LIQUIDATE" ? "loss" : "trade" };
}

export function VerbPlate({ label, tone }: { label: string; tone: VerbTone }) {
  const { color } = useTheme();
  const ink = tone === "thesis" ? color.accentForeground : tone === "loss" ? color.down : color.text2;
  const fill = tone === "thesis" ? color.accent : tone === "loss" ? color.downWash : color.raised2;
  return <Text style={[TYPE.modeLabel, styles.plate, { color: ink, backgroundColor: fill }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  plate: { borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, overflow: "hidden" },
});
