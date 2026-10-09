/**
 * Parlay (S8.5, D-293; the web's `ParlayScreen`): the lane for new picks, a search and every market with Up and Down;
 * once something is picked a bar over the bottom says how many legs and what they pay and opens the slip. Your parlays
 * follow below, each leg to its result. Picking, pricing and placing are `@senryo/calls` `useParlayFlow` /
 * `useParlayQuote`, the web's own.
 */
import { chanceText, groupMarkets, multiplierText, PARLAY_SIDES, type ParlayPick } from "@senryo/calls";
import { useMarketLine, useParlayFlow, useParlayQuote } from "@senryo/calls/react";
import { CADENCES_SEC, type CadenceSec } from "@senryo/config";
import { laneLabel } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useCatalog } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { Search } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { DISABLED_OPACITY, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { ParlayList } from "./ParlayList";
import { ParlaySlipSheet } from "./ParlaySlipSheet";

const MARK = 32;
const SEARCH_ICON = 18;
const DEFAULT_STAKE = 5_000_000n;
const LANES = CADENCES_SEC.map((c) => ({ value: String(c), label: laneLabel(c) }));
const BAR_SPACE = 96;

function PickRow(p: { symbol: string; name: string; picked: ParlayPick | undefined; onPick: (band: number) => void }) {
  const { color } = useTheme();
  const line = useMarketLine(p.symbol);
  return (
    <View style={styles.row}>
      <EntityMark id={marketId(p.symbol)} size={MARK} decorative />
      <View style={styles.flex}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{p.symbol}</Text>
        <Text numberOfLines={1} style={[TYPE.caption, { color: color.inkMuted }]}>
          {p.name} · {line.text}
        </Text>
      </View>
      {PARLAY_SIDES.map((side) => {
        const on = p.picked?.band === side.band;
        return (
          <Pressable
            key={side.band}
            disabled={!line.trading}
            onPress={() => {
              fire("tick");
              p.onPick(side.band);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: !line.trading }}
            accessibilityLabel={`${on ? "Remove" : "Add"} ${p.symbol} ${side.label}`}
            style={[
              styles.side,
              { backgroundColor: on ? color.ink : color.raised2, opacity: line.trading ? 1 : DISABLED_OPACITY },
            ]}
          >
            <Text style={[TYPE.rowTitle, { color: on ? color.ground : color.ink }]}>{side.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ParlayScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const catalog = useCatalog();
  const [lane, setLane] = useState<CadenceSec>(CADENCES_SEC[0]);
  const [query, setQuery] = useState("");
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [slip, setSlip] = useState(false);
  const flow = useParlayFlow(account, {
    cue: (c) => (c === "filled" ? fire("filled", { cue: "open" }) : fire(c)),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () => router.push(accountRequiredRoute("place a parlay")),
  });
  const quote = useParlayQuote(flow.picks, stake);
  const markets = "value" in catalog ? catalog.value.markets : [];
  const halfSpreadE6 = "value" in catalog ? catalog.value.terms.halfSpreadE6 : 0;
  const q = quote.quote;
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: BAR_SPACE + insets.bottom, gap: SPACE.md }}>
        <View style={styles.controls}>
          <Segmented
            options={LANES}
            value={String(lane)}
            onChange={(v) => setLane(Number(v) as CadenceSec)}
            label="Window for new picks"
          />
          <View style={[styles.search, { backgroundColor: color.muted }]}>
            <Search size={SEARCH_ICON} color={color.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search markets"
              placeholderTextColor={color.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search markets"
              style={[TYPE.body, styles.flex, { color: color.ink }]}
            />
          </View>
        </View>
        {groupMarkets(markets, query).map((g) => (
          <View key={g.label} accessibilityLabel={g.label}>
            <Text style={[TYPE.sectionTitle, styles.group, { color: color.inkMuted }]}>{g.label}</Text>
            {g.markets.map((m) => {
              const picked = flow.picks.find((x) => x.symbol === m.symbol);
              return (
                <PickRow
                  key={m.symbol}
                  symbol={m.symbol}
                  name={m.name}
                  picked={picked}
                  onPick={(band) => flow.pick({ symbol: m.symbol, cadenceSec: picked?.cadenceSec ?? lane, band })}
                />
              );
            })}
          </View>
        ))}
        <ParlayList owner={account.hint?.address} />
      </ScrollView>
      {flow.picks.length > 0 ? (
        <View style={[styles.bar, { backgroundColor: color.card, paddingBottom: insets.bottom + SPACE.sm }]}>
          <View style={styles.flex}>
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>
              {flow.picks.length} {flow.picks.length === 1 ? "leg" : "legs"}
            </Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {q && !q.refusal ? `${multiplierText(stake, q.payout)} · ${chanceText(q.chanceE6)}` : "Pick 2 to 4"}
            </Text>
          </View>
          <Button label="Review" block={false} onPress={() => setSlip(true)} />
        </View>
      ) : null}
      {slip ? (
        <ParlaySlipSheet
          quote={quote}
          halfSpreadE6={halfSpreadE6}
          stake={stake}
          onStake={setStake}
          onPick={flow.pick}
          onRemove={flow.remove}
          onPlace={() => void flow.place(quote, stake)}
          pending={flow.pending}
          balance={flow.balance}
          onClose={() => setSlip(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  controls: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm, paddingTop: SPACE.sm },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    paddingHorizontal: SPACE.md,
  },
  group: { paddingHorizontal: SIZE.gutter, paddingBottom: SPACE.xs },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingHorizontal: SIZE.gutter, minHeight: 56 },
  side: {
    minWidth: 56,
    height: SIZE.touch - SPACE.xs,
    borderRadius: (SIZE.touch - SPACE.xs) / 2,
    paddingHorizontal: SPACE.md,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SIZE.gutter,
    paddingTop: SPACE.sm,
  },
});
