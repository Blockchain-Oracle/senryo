/**
 * Parlay as a chain (P3, D-326; Codex's "Parlay builds a chain", Mitoshi's board and slip, Owarine's hero): the four
 * leg sockets stay pinned at the top; under them the lane, one round strip for the whole board (never a countdown per
 * row), the search and the kind chips, then a card per market taking calls — live price, 24 h line, and each side's
 * indicative odds for the lane. A pick's mark flies into its socket. Markets that take no calls now sit in one closed
 * group at the end. The slip is always there as a bar at the bottom and opens over the board; your parlays settle
 * below, leg by leg. Picking, pricing and placing are `@senryo/calls` (`useParlayFlow`, `useParlayQuote`), the web's
 * own.
 */
import {
  boardLanes,
  chanceText,
  MARKET_FILTERS,
  type MarketFilter,
  payoutMultiple,
  roundLine,
  windowFor,
} from "@senryo/calls";
import { useParlayBoard, useParlayFlow, useParlayQuote } from "@senryo/calls/react";
import { type CadenceSec, PARLAY } from "@senryo/config";
import { laneLabel } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useCatalog } from "@senryo/query";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilterChips } from "~/components/kit/FilterChips";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { SearchField } from "~/components/kit/SearchField";
import { Segmented } from "~/components/kit/Segmented";
import { ChevronRight } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { type Flight, FlyLayer } from "./FlyLayer";
import { LegSockets, SOCKET_MARK } from "./LegSockets";
import { type MarkBox, ParlayCard } from "./ParlayCard";
import { ParlayList } from "./ParlayList";
import { ParlaySlipSheet } from "./ParlaySlipSheet";
import { SlipBar, slipBarSpace } from "./SlipBar";

const DEFAULT_STAKE = 5_000_000n;
const FALLBACK_SYMBOL = "BTC";

export function ParlayScreen() {
  // Pull down refreshes the page (D4: the owner's iPhone review — every screen with data refreshes).
  const refresh = usePullRefresh();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const catalog = useCatalog();
  const now = useServerSeconds();
  const markets = "value" in catalog ? catalog.value.markets : [];
  const lanes = boardLanes(markets);
  const [laneChoice, setLane] = useState<CadenceSec | null>(null);
  const lane = laneChoice ?? lanes[0] ?? (60 as CadenceSec);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [slip, setSlip] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const root = useRef<View>(null);
  const sockets = useRef<(View | null)[]>([]);
  const flow = useParlayFlow(account, {
    cue: (c) =>
      c === "filled" ? fire("filled", { cue: "open" }) : c === "fail" ? fire("fail", { cue: "error" }) : fire(c),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () => router.push(accountRequiredRoute("place a parlay")),
  });
  const quote = useParlayQuote(flow.picks, stake);
  const board = useParlayBoard(markets, query, filter);
  const terms = "value" in catalog ? catalog.value.terms : undefined;
  const q = quote.quote;
  // Between rounds the legs' closing windows price nothing for the next: the price waits for it.
  const multiple = quote.trading && q && !q.refusal ? payoutMultiple(stake, q.payout) : null;
  const round = windowFor(markets[0]?.symbol ?? FALLBACK_SYMBOL, lane, now);
  const landed = useCallback(() => setFlight(null), []);

  const pick = (symbol: string, band: number, from: MarkBox | null) => {
    const existing = flow.picks.find((p) => p.symbol === symbol);
    if (!existing && flow.picks.length >= PARLAY.maxLegs) {
      fire("warn");
      notify({ title: `${PARLAY.maxLegs} legs is the most`, description: "Drop one to add another.", tone: "warning" });
      return;
    }
    fire("tick");
    flow.pick({ symbol, cadenceSec: (existing?.cadenceSec as CadenceSec | undefined) ?? lane, band });
    if (existing || !from) return;
    const target = sockets.current[flow.picks.length];
    const layer = root.current;
    if (!target || !layer) return;
    layer.measureInWindow((lx, ly) =>
      target.measureInWindow((tx, ty, tw) => {
        const inset = (tw - SOCKET_MARK) / 2;
        setFlight({
          id: Date.now(),
          symbol,
          from: { x: from.x - lx, y: from.y - ly, size: from.size },
          to: { x: tx - lx + inset, y: ty - ly + inset, size: SOCKET_MARK },
        });
      }),
    );
  };

  const card = (m: { symbol: string; name: string }) => (
    <ParlayCard
      key={m.symbol}
      symbol={m.symbol}
      name={m.name}
      cadenceSec={(flow.picks.find((p) => p.symbol === m.symbol)?.cadenceSec as CadenceSec | undefined) ?? lane}
      minHalfSpreadE6={terms?.minHalfSpreadE6 ?? 0}
      pickedBand={flow.picks.find((p) => p.symbol === m.symbol)?.band}
      onPick={(band, from) => pick(m.symbol, band, from)}
    />
  );

  return (
    <View ref={root} collapsable={false} style={[styles.fill, { backgroundColor: color.ground }]}>
      <ScrollView
        refreshControl={refresh}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: slipBarSpace(insets.bottom) + SPACE.lg }}
      >
        <View style={[styles.sockets, { backgroundColor: color.ground }]}>
          <LegSockets picks={flow.picks} socketRefs={sockets} onOpen={() => setSlip(true)} />
        </View>
        <View style={styles.controls}>
          {lanes.length > 1 ? (
            <Segmented
              options={lanes.map((c) => ({ value: String(c), label: laneLabel(c) }))}
              value={String(lane)}
              onChange={(v) => setLane(Number(v) as CadenceSec)}
              label="Lane for new legs"
            />
          ) : null}
          <Text
            accessibilityLiveRegion="polite"
            style={[TYPE.caption, styles.center, { color: round.trading ? color.inkMuted : color.warn }]}
          >
            {roundLine(round, now)}
          </Text>
          <SearchField value={query} onChange={setQuery} />
          <FilterChips
            options={MARKET_FILTERS}
            value={filter}
            onChange={setFilter}
            label="Show markets"
            bleed={SIZE.gutter}
          />
        </View>
        {board.groups.length === 0 && board.closed.length === 0 ? (
          <Text style={[TYPE.body, styles.center, styles.empty, { color: color.inkMuted }]}>
            {query ? "No markets match that search." : "Markets are loading."}
          </Text>
        ) : null}
        {board.groups.map((g) => (
          <View key={g.label} style={styles.group} accessibilityLabel={g.label}>
            <Text style={[TYPE.sectionTitle, { color: color.inkMuted }]}>{g.label}</Text>
            {g.markets.map(card)}
          </View>
        ))}
        {board.closed.length > 0 ? (
          <View style={styles.group}>
            <Pressable
              onPress={() => {
                fire("tick");
                setShowClosed((s) => !s);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: showClosed }}
              style={styles.closedHead}
            >
              <Text style={[TYPE.sectionTitle, styles.flex, { color: color.inkMuted }]}>
                Closed markets · {board.closed.length}
              </Text>
              <View style={{ transform: [{ rotate: showClosed ? "90deg" : "0deg" }] }}>
                <ChevronRight size={SIZE.iconSm} color={color.inkMuted} />
              </View>
            </Pressable>
            {showClosed ? board.closed.map(card) : null}
          </View>
        ) : null}
        <ParlayList owner={account.hint?.address} />
      </ScrollView>
      <FlyLayer flight={flight} onLand={landed} />
      <SlipBar
        picks={flow.picks}
        price={multiple && q ? `Pays ${multiple} · ${chanceText(q.chanceE6)}` : null}
        trading={quote.trading}
        onOpen={() => {
          fire("tick");
          setSlip(true);
        }}
      />
      {slip ? (
        <ParlaySlipSheet
          quote={quote}
          minHalfSpreadE6={terms?.minHalfSpreadE6 ?? 0}
          stake={stake}
          onStake={setStake}
          onPick={flow.pick}
          onRemove={flow.remove}
          onPlace={() => void flow.place(quote, stake)}
          pending={flow.pending}
          balance={flow.balance}
          signedIn={account.hint?.address !== undefined}
          limits={{ min: terms?.minStake ?? DEFAULT_STAKE, max: terms?.maxStake ?? DEFAULT_STAKE }}
          onClose={() => setSlip(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  sockets: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, paddingBottom: SPACE.md },
  controls: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm, paddingBottom: SPACE.sm },
  center: { textAlign: "center" },
  empty: { paddingVertical: SPACE.xl },
  group: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm, paddingBottom: SPACE.md },
  closedHead: { flexDirection: "row", alignItems: "center", minHeight: SIZE.touch },
});
