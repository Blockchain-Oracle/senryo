/**
 * The phone's search rows (R6.9, Codex direction 13 — the web's contracts arranged for a phone): a market with its
 * mark, symbol over name · kind, the four lanes in plain cells (its session in words while it doesn't trade), the
 * price, plain signed change and a small 24 h graph, and a trailing chevron to its page; a position's live value and
 * PnL (masked while balances are hidden); an event's two crests and score or start; places, actions, help and
 * receipts as a glyph and two lines. The whole row taps; nothing moves money.
 */
import { dayChange, positionHold, unitOf } from "@senryo/calls";
import { useBookEntry, useDayLine, useMarketLanes } from "@senryo/calls/react";
import { MARKETS } from "@senryo/config";
import { clockText, signedUsd, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice, useSampledPrice, useServerSeconds } from "@senryo/live/react";
import { useEventBoard } from "@senryo/query";
import { KIND_WORDS, type SearchEntry } from "@senryo/search";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Sparkline } from "~/components/kit/Sparkline";
import {
  ChevronRight,
  Eye,
  Gamepad,
  Info,
  Receipt,
  ScrollText,
  Search,
  type SymbolIcon,
  Volume,
  VolumeX,
  Wallet,
} from "~/components/kit/symbols";
import { TeamMark } from "~/features/events/TeamMark";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { FONT, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { formatValue, priceDecimals } from "../terminal/chart/engine";

const MARK = 36;
const E8 = 1e8;
const SPARK_W = 56;
const SPARK_H = 20;
const FIGURES_MIN = 96;
const BPS_PER_PERCENT = 100;
const MS = 1_000;
/** Two 28 pt crests side by side. */
const CRESTS = 56;

function useLivePriceText(symbol: string): string {
  const price = useLivePrice(symbol);
  if (price === undefined) return "—";
  return formatValue(price / E8, priceDecimals(price / E8), unitOf(symbol) === "points");
}

function ChangeText({ symbol }: { symbol: string }) {
  const { color } = useTheme();
  const day = useDayLine(symbol);
  const now = useSampledPrice(symbol, MS);
  if (!day || now === undefined) return null;
  const c = dayChange(day.openE8, now);
  return (
    <Text
      style={[TYPE.rowChange, { color: c.tone === "up" ? color.up : c.tone === "down" ? color.down : color.inkMuted }]}
    >
      {c.text}
    </Text>
  );
}

function Lanes({ symbol }: { symbol: string }) {
  const { color } = useTheme();
  const { line, lanes } = useMarketLanes(symbol);
  if (!lanes) {
    return (
      <Text style={[TYPE.micro, { color: color.inkMuted }]} numberOfLines={1}>
        {line.text}
      </Text>
    );
  }
  return (
    <View style={styles.lanes}>
      {lanes.map((l, i) => (
        <Text key={l.cadence} style={[TYPE.micro, { color: l.open ? color.ink : color.inkMuted }]}>
          <Text style={styles.laneLabel}>{l.label}</Text>{" "}
          {i === 0 && l.open ? `closes in ${l.clock}` : l.open ? l.clock : `opens ${l.clock}`}
        </Text>
      ))}
    </View>
  );
}

function MarketBody({ symbol, onOptions }: { symbol: string; onOptions: () => void }) {
  const { color } = useTheme();
  const m = MARKETS.find((x) => x.symbol === symbol);
  const day = useDayLine(symbol);
  const price = useLivePriceText(symbol);
  return (
    <>
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <View style={styles.copy}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{symbol}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={1}>
          {m?.name}
          {m ? ` · ${KIND_WORDS[m.kind].label}` : ""}
        </Text>
        <Lanes symbol={symbol} />
      </View>
      <View style={styles.figures}>
        <Text style={[TYPE.rowPrice, { color: color.ink }]}>{price}</Text>
        <ChangeText symbol={symbol} />
        {day ? <Sparkline symbol={symbol} day={day} width={SPARK_W} height={SPARK_H} /> : null}
      </View>
      <Pressable
        onPress={onOptions}
        hitSlop={SPACE.xs}
        accessibilityRole="button"
        accessibilityLabel={`${symbol} options`}
        style={styles.options}
      >
        <ChevronRight size={SIZE.iconSm} color={color.inkMuted} />
      </Pressable>
    </>
  );
}

function CompactMarketBody({ entry }: { entry: SearchEntry }) {
  const { color } = useTheme();
  const symbol = entry.symbol ?? "";
  const lane = entry.target.kind === "terminal" ? entry.target.intent.lane : undefined;
  const { line, lanes } = useMarketLanes(symbol);
  const cell = lanes?.find((l) => l.cadence === lane);
  const state = cell
    ? cell.open
      ? `Closes in ${cell.clock}`
      : `Opens in ${cell.clock}`
    : lanes
      ? entry.subtitle
      : line.text;
  return (
    <>
      <EntityMark id={marketId(symbol)} size={SIZE.avatarSm} decorative />
      <View style={styles.copy}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{entry.title}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{state}</Text>
      </View>
      <Text style={[TYPE.rowPrice, { color: color.ink }]}>{useLivePriceText(symbol)}</Text>
    </>
  );
}

function PositionBody({ entry }: { entry: SearchEntry }) {
  const { color } = useTheme();
  const key = entry.target.kind === "terminal" ? entry.target.intent.position : undefined;
  const e = useBookEntry(key);
  const now = useServerSeconds();
  const [hidden] = useHideBalances();
  if (!e) return <Plain entry={entry} sub="Closed" />;
  const hold = positionHold(e);
  const left = e.endsAt === null ? null : Math.max(0, e.endsAt - now);
  const pnl = e.pnl;
  return (
    <>
      <EntityMark id={marketId(e.symbol)} size={MARK} decorative />
      <View style={styles.copy}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{entry.title}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{entry.subtitle}</Text>
        <Text style={[TYPE.micro, { color: color.inkMuted }]}>
          {hold ?? (left === null ? "" : `Ends in ${clockText(left)}`)}
        </Text>
      </View>
      <View style={styles.figures}>
        <Text style={[TYPE.rowPrice, { color: color.ink }]}>{masked(usd(e.closeValue ?? e.worth), hidden)}</Text>
        {pnl !== null ? (
          <Text style={[TYPE.rowChange, { color: pnl > 0n ? color.up : pnl < 0n ? color.down : color.inkMuted }]}>
            {masked(
              `${signedUsd(pnl)}${e.roiBps === null ? "" : ` · ${(e.roiBps / BPS_PER_PERCENT).toFixed(1)}%`}`,
              hidden,
            )}
          </Text>
        ) : null}
      </View>
    </>
  );
}

function EventBody({ entry }: { entry: SearchEntry }) {
  const { color } = useTheme();
  const board = useEventBoard();
  const id = entry.target.kind === "event" ? entry.target.eventId.toLowerCase() : "";
  const ev = "value" in board ? board.value.events.find((x) => x.eventId.toLowerCase() === id) : undefined;
  if (!ev) return <Plain entry={entry} />;
  const live = ev.live && ev.live.state !== "pre" && ev.live.home !== null && ev.live.away !== null ? ev.live : null;
  return (
    <>
      <View style={styles.crests}>
        <TeamMark league={ev.league} team={ev.away} size="sm" />
        <TeamMark league={ev.league} team={ev.home} size="sm" />
      </View>
      <View style={styles.copy}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={2}>
          {ev.question}
        </Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {ev.away.abbr} @ {ev.home.abbr} · {ev.league}
        </Text>
      </View>
      <View style={styles.figures}>
        {live ? (
          <>
            <Text style={[TYPE.rowPrice, { color: color.ink }]}>
              {live.away}–{live.home}
            </Text>
            <Text style={[TYPE.micro, { color: color.inkMuted }]}>{live.detail}</Text>
          </>
        ) : (
          <Text style={[TYPE.micro, { color: color.inkMuted }]}>
            {ev.state === "open"
              ? new Date(ev.startsAt * MS).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })
              : ev.state === "decided"
                ? "Decided"
                : "Void"}
          </Text>
        )}
      </View>
    </>
  );
}

function glyphOf(entry: SearchEntry): SymbolIcon {
  const t = entry.target;
  if (t.kind === "help") return Info;
  if (t.kind === "receipt" || t.kind === "explorer") return Receipt;
  if (t.kind === "window") return ScrollText;
  if (t.kind === "action") {
    if (t.action === "balances") return Eye;
    if (t.action === "sound") return entry.title.endsWith("off") ? VolumeX : Volume;
    if (t.action === "add-money" || t.action === "receive" || t.action === "withdraw") return Wallet;
    return Search;
  }
  return Gamepad;
}

function Plain({ entry, sub, trailing }: { entry: SearchEntry; sub?: string; trailing?: ReactNode }) {
  const { color } = useTheme();
  const Glyph = glyphOf(entry);
  const two = entry.group === "help";
  return (
    <>
      {entry.symbol && entry.group === "receipts" ? (
        <EntityMark id={marketId(entry.symbol)} size={MARK} decorative />
      ) : (
        <View style={styles.glyph}>
          <Glyph size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.inkMuted} />
        </View>
      )}
      <View style={styles.copy}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={two ? 2 : 1}>
          {entry.title}
        </Text>
        {(sub ?? entry.subtitle) ? (
          <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={two ? 2 : 1}>
            {sub ?? entry.subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? <ChevronRight size={SIZE.iconSm} color={color.inkMuted} />}
    </>
  );
}

export function SearchRow({
  entry,
  onOpen,
  onOptions,
}: {
  entry: SearchEntry;
  onOpen: () => void;
  onOptions: (symbol: string) => void;
}) {
  const { color } = useTheme();
  const t = entry.target;
  const market = entry.id.startsWith("market:") && t.kind === "terminal";
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}${entry.subtitle ? `, ${entry.subtitle}` : ""}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.rowPressed }]}
    >
      {market ? (
        <MarketBody symbol={t.intent.symbol} onOptions={() => onOptions(t.intent.symbol)} />
      ) : entry.group === "markets" || entry.group === "lanes" ? (
        <CompactMarketBody entry={entry} />
      ) : entry.group === "positions" ? (
        <PositionBody entry={entry} />
      ) : entry.group === "events" && t.kind === "event" ? (
        <EventBody entry={entry} />
      ) : (
        <Plain entry={entry} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.sm,
  },
  copy: { flex: 1, gap: SPACE.xxs },
  figures: { alignItems: "flex-end", gap: SPACE.xxs, minWidth: FIGURES_MIN },
  lanes: { flexDirection: "row", flexWrap: "wrap", columnGap: SPACE.md, rowGap: SPACE.xxs },
  laneLabel: { fontFamily: FONT.sansStrong },
  options: {
    width: SIZE.touch,
    height: SIZE.touch,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -SPACE.md,
  },
  crests: { flexDirection: "row", width: CRESTS },
  glyph: { width: MARK, alignItems: "center" },
});
