/**
 * F43 / F45 banners (borderless status washes): the guardian pause with its auto-expiry countdown, settle-only mode, and a market
 * holiday coming up within a week ("Gold closed Thu 21:00 UTC → Fri 23:00 UTC · holiday"). Closing always works;
 * the copy says so. The calendar is display only — the onchain status decides.
 */
import { durationUntil, nextHoliday, utcSlotLabel } from "@senryo/core";
import { useCalendar, useProtocolState } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { BUTTON, SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_SECOND = 1000n;
/** Show a holiday this far ahead. */
const HOLIDAY_LOOKAHEAD_SEC = 604_800n;

function Plate({ title, body, tone }: { title: string; body: string; tone: "warn" | "down" }) {
  const { color } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: tone === "down" ? color.downWash : color.warnWash }]}
    >
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{body}</Text>
    </View>
  );
}

/** Protocol-wide: guardian pause (auto-expires) and settle-only. */
export function ProtocolBanner() {
  const state = useProtocolState();
  if (state.status !== "fresh" && state.status !== "stale") return null;
  const now = BigInt(Date.now()) / MS_PER_SECOND;
  if (state.value.settleOnly) {
    return (
      <Plate
        tone="down"
        title="Settle-only mode"
        body="The engine is winding down: new positions are off; closing and withdrawing work."
      />
    );
  }
  if (state.value.pausedUntil > now) {
    return (
      <Plate
        tone="warn"
        title={`Trading paused by the guardian · resumes ${durationUntil(state.value.pausedUntil, now)}`}
        body="Pauses expire on their own. Closing still works."
      />
    );
  }
  return null;
}

/** One market: a holiday closure starting within the next week. */
export function HolidayBanner({ calendarId, name }: { calendarId: number; name: string }) {
  const calendar = useCalendar(calendarId);
  if (calendar.status !== "fresh" && calendar.status !== "stale") return null;
  const now = BigInt(Date.now()) / MS_PER_SECOND;
  const next = nextHoliday(calendar.value, now);
  if (!next || next.start > now + HOLIDAY_LOOKAHEAD_SEC) return null;
  const active = next.start <= now;
  return (
    <Plate
      tone="warn"
      title={
        active
          ? `${name} closed for a holiday · reopens ${utcSlotLabel(next.end)}`
          : `${name} closes ${utcSlotLabel(next.start)} for a holiday`
      }
      body={`Reopens ${utcSlotLabel(next.end)} (${durationUntil(next.end, now)}). Closing and reducing still work.`}
    />
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: BUTTON.radius.md, padding: SPACE.md, gap: SPACE.xxs },
});
