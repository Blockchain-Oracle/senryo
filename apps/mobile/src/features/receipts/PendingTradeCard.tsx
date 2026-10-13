/**
 * A trade between the tap and its fill on the phone (R5.11; the web's `PendingTradeCard`): the slip's paper in its
 * pending state — Senryo with "N° Pending", then the request once sent; the market and side; "Signing…" or "Waiting
 * for the fill"; what was quoted. Its booked row takes its place; the toast narrates.
 */
import type { PendingTrade } from "@senryo/calls/react";
import { marketId } from "@senryo/identity";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { HIDDEN_AMOUNT, useHideBalances } from "~/lib/hide-balances";
import { ELEVATION, FONT, NUMERIC_VARIANT, SLIP, SPACE, TYPE } from "~/theme";
import { usePaper } from "./paper";

const DIGEST_SHOWN = 8;
const HEX_PREFIX = 2;
const STATUS: Record<PendingTrade["stage"], string> = {
  signing: "Signing…",
  pending: "Waiting for the fill",
  booked: "Booked",
};

export function PendingTradeCard({ run }: { run: PendingTrade }) {
  const [hidden] = useHideBalances();
  const paper = usePaper();
  const status = STATUS[run.stage];
  const folio = run.digest
    ? `Request ${run.digest.slice(HEX_PREFIX, HEX_PREFIX + DIGEST_SHOWN).toUpperCase()}`
    : "N° Pending";
  return (
    <View
      style={[styles.paper, { backgroundColor: paper.paper }, ELEVATION.receipt]}
      accessible
      accessibilityLabel={`${run.title}, ${status}`}
      accessibilityState={{ busy: run.stage !== "booked" }}
    >
      <View style={styles.head}>
        <Text style={[styles.brand, { color: paper.ink }]}>SENRYO</Text>
        <Text style={[styles.muted, { color: paper.muted }]}>{folio}</Text>
      </View>
      <View style={styles.row}>
        <EntityMark id={marketId(run.symbol)} size={SLIP.mark} decorative />
        <Text style={[TYPE.rowTitle, { color: paper.ink }]}>{run.title}</Text>
      </View>
      <View style={styles.row}>
        {run.stage === "booked" ? null : <ActivityIndicator size="small" color={paper.ink} />}
        <Text style={[styles.status, { color: paper.ink }]}>{status}</Text>
      </View>
      {run.quoted.map((q) => (
        <View key={q.k} style={styles.fact}>
          <Text style={[styles.muted, { color: paper.muted }]}>{q.k} · quoted</Text>
          <Text style={[styles.value, { color: paper.ink }]}>{q.money && hidden ? HIDDEN_AMOUNT : q.v}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    width: "100%",
    maxWidth: SLIP.maxWidth,
    alignSelf: "center",
    gap: SPACE.sm,
    padding: SLIP.pad,
    borderRadius: SLIP.radius,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  brand: { fontFamily: FONT.display, fontSize: SLIP.label, lineHeight: SLIP.labelLine },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  status: { fontFamily: FONT.sansStrong, fontSize: SLIP.fact, lineHeight: SLIP.factLine },
  fact: { flexDirection: "row", justifyContent: "space-between", gap: SPACE.md },
  muted: { fontFamily: FONT.sans, fontSize: SLIP.fact, lineHeight: SLIP.factLine },
  value: {
    fontFamily: FONT.sansStrong,
    fontSize: SLIP.fact,
    lineHeight: SLIP.factLine,
    fontVariant: NUMERIC_VARIANT,
  },
});
