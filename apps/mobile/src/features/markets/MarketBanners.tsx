/**
 * State banners (flow book C1/C2 states; Fomo F43/F45 borderless washes): one line each, never a paragraph — the
 * guardian pause with its countdown ("Trading paused · 3h 12m"), settle-only ("Closing only"), a market that isn't
 * open ("Closed · opens Sun 23:00 UTC", "Price paused", "Halted") and a holiday within a week ("Holiday · reopens …").
 * Closing always works; the ticket names the blocker. The calendar only words times; the onchain status decides.
 */
import { durationUntil, type MarketStatus, nextHoliday, nextTransition, utcSlotLabel } from "@senryo/core";
import { useCalendar, useProtocolState } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_SECOND = 1000n;
/** Show a holiday this far ahead. */
const HOLIDAY_LOOKAHEAD_SEC = 604_800n;

const nowSec = () => BigInt(Date.now()) / MS_PER_SECOND;

function Wash({ text, tone }: { text: string; tone: "warn" | "down" }) {
  const { color } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={text}
      style={[styles.wash, { backgroundColor: tone === "down" ? color.downWash : color.warnWash }]}
    >
      <View style={[styles.dot, { backgroundColor: tone === "down" ? color.down : color.warn }]} />
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} numberOfLines={1} style={[TYPE.row, { color: color.ink }]}>
        {text}
      </Text>
    </View>
  );
}

/** Protocol-wide: guardian pause (auto-expires) and settle-only. */
export function ProtocolBanner() {
  const state = useProtocolState();
  if (state.status !== "fresh" && state.status !== "stale") return null;
  const now = nowSec();
  if (state.value.settleOnly) return <Wash tone="down" text="Closing only" />;
  if (state.value.pausedUntil > now) {
    return (
      <Wash tone="warn" text={`Trading paused · ${durationUntil(state.value.pausedUntil, now).replace("in ", "")}`} />
    );
  }
  return null;
}

/** One market that isn't open: when it opens, or that its price is paused. */
export function SessionBanner({
  status,
  calendarId,
  symbol,
}: {
  status: MarketStatus;
  calendarId: number;
  symbol: string;
}) {
  const calendar = useCalendar(calendarId);
  if (status === "OPEN") return null;
  const week = calendar.status === "fresh" || calendar.status === "stale" ? calendar.value : undefined;
  const opens =
    week && (status === "CLOSED" || status === "REOPENING") ? nextTransition(week, nowSec(), true) : undefined;
  if (status === "CLOSED") {
    return <Wash tone="warn" text={opens ? `${symbol} closed · opens ${utcSlotLabel(opens)}` : `${symbol} closed`} />;
  }
  if (status === "REOPENING") return <Wash tone="warn" text={`${symbol} reopening · opens in a few minutes`} />;
  if (status === "HALTED") return <Wash tone="down" text={`${symbol} halted`} />;
  return <Wash tone="warn" text={`${symbol} price paused`} />;
}

/** One market: a holiday closure starting within the next week. */
export function HolidayBanner({ calendarId, name }: { calendarId: number; name: string }) {
  const calendar = useCalendar(calendarId);
  if (calendar.status !== "fresh" && calendar.status !== "stale") return null;
  const now = nowSec();
  const next = nextHoliday(calendar.value, now);
  if (!next || next.start > now + HOLIDAY_LOOKAHEAD_SEC) return null;
  return (
    <Wash
      tone="warn"
      text={
        next.start <= now
          ? `Holiday · reopens ${utcSlotLabel(next.end)}`
          : `${name} holiday · ${utcSlotLabel(next.start)}`
      }
    />
  );
}

const styles = StyleSheet.create({
  wash: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
  },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
});
