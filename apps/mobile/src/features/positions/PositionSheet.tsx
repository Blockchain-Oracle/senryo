/**
 * A position's long-press (D-343, Codex direction 15 §2, §4): "Position details" and "View receipt" — never a way to
 * close money. Details opens in place as plain key/value rows (the facts the row no longer carries: entry, the levels,
 * what went in, fees, when it ends), money masked with balances hidden.
 */
import {
  type BookEntry,
  type DetailValue,
  datedText,
  dollars,
  positionDetails,
  positionHead,
  unitOf,
} from "@senryo/calls";
import { priceText } from "@senryo/core";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ListRow } from "~/components/kit/ListRow";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SPACE, TYPE, useTheme } from "~/theme";

const ROW = 44;

function Menu({ e, onDetails }: { e: BookEntry; onDetails: () => void }) {
  const close = useSheetClose();
  return (
    <View>
      <ListRow
        title="Position details"
        onPress={() => {
          fire("tick");
          onDetails();
        }}
      />
      <ListRow
        title="View receipt"
        onPress={() => {
          fire("tick", { cue: "sheetOpen" });
          close(() => router.push((e.kind === "ride" ? `/calls/rides/${e.id}` : `/calls/${e.id}`) as Href));
        }}
      />
    </View>
  );
}

function Details({ e }: { e: BookEntry }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const unit = unitOf(e.symbol);
  const text = (v: DetailValue) =>
    v.kind === "price"
      ? v.e8 === null
        ? "—"
        : priceText(v.e8, unit)
      : v.kind === "money"
        ? v.v === null
          ? "—"
          : masked(dollars(v.v), hidden)
        : v.at === null
          ? "—"
          : datedText(v.at);
  return (
    <View>
      {positionDetails(e).map((d) => (
        <View key={d.label} style={styles.fact}>
          <Text style={[TYPE.row, styles.grow, { color: color.inkMuted }]}>{d.label}</Text>
          <Text style={[TYPE.rowAmount, { color: color.ink }]}>{text(d.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export function PositionSheet({ e, onClose }: { e: BookEntry; onClose: () => void }) {
  const [details, setDetails] = useState(false);
  return (
    <Sheet onClose={onClose} closeLabel="Close position actions">
      <SheetHeading title={details ? "Position details" : positionHead(e)} />
      {details ? <Details e={e} /> : <Menu e={e} onDetails={() => setDetails(true)} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fact: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: ROW },
  grow: { flex: 1 },
});
