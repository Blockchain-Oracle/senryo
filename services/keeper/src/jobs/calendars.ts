import { addHolidayCallData, addressOf, describeError, type Hex, sendTx, setWeekCallData } from "@senryo/chain";
import { CALENDARS, type CalendarId, marketsOn } from "@senryo/config";
import { marketCalendarAbi } from "@senryo/contracts/abis";
import { easternOffsetSec, holidayWindows, parseSchedule, weekBits } from "@senryo/core";
import { nowSec } from "@senryo/service-common";
import { CALENDAR_HOLIDAY_DAYS, CALENDARS_INTERVAL_MS } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Market calendars stay true on chain (D-289): each calendar's week is the feed's schedule at the US Eastern offset in
 * effect now (so the daylight-saving change on a Sunday 02:00 ET — every market is closed then — swaps it), and the
 * holidays and early closes of the next 60 days are added as old ones lapse. The keeper holds CALENDAR_ROLE for just
 * these two calls; a calendar already right costs one read.
 */
export function calendarsJob(ctx: KeeperContext): Job {
  return {
    name: "calendars",
    intervalMs: CALENDARS_INTERVAL_MS,
    run: async () => {
      const ids = [...new Set(marketsOn(ctx.chainId).map((m) => m.calendarId))].filter((id) => id !== 0);
      for (const id of ids) {
        try {
          await keepCalendar(ctx, id, nowSec());
        } catch (error) {
          ctx.log.warn({ calendarId: id, err: describeError(error) }, "calendar update failed; retrying next tick");
        }
      }
    },
  };
}

async function keepCalendar(ctx: KeeperContext, id: CalendarId, now: number): Promise<void> {
  const calendar = addressOf(ctx.chainId, "MarketCalendar");
  const schedule = parseSchedule(CALENDARS[id].schedule);
  const want = weekBits(schedule, easternOffsetSec(now));
  const read = { address: calendar, abi: marketCalendarAbi } as const;
  const [week, holidays] = await Promise.all([
    ctx.read.readContract({ ...read, functionName: "week", args: [id] }),
    ctx.read.readContract({ ...read, functionName: "holidays", args: [id] }),
  ]);
  if (want.some((w, i) => w !== week[i])) await send(ctx, calendar, setWeekCallData(id, want), id, "week");
  const known = new Set(holidays.map((h) => `${h.start}:${h.end}`));
  for (const h of holidayWindows(schedule, now, CALENDAR_HOLIDAY_DAYS)) {
    if (h.end <= now || known.has(`${h.start}:${h.end}`)) continue;
    await send(ctx, calendar, addHolidayCallData(id, h.start, h.end), id, "holiday");
  }
}

async function send(ctx: KeeperContext, to: Hex, data: Hex, id: number, what: string): Promise<void> {
  const sent = await sendTx(ctx.sender, {
    to,
    data,
    action: "calendarUpdate",
    meta: { job: "calendars", id: String(id), what },
  });
  ctx.recent.add({ job: "calendars", subject: `${id}:${what}`, tx: sent.hash, stage: sent.stage });
  ctx.log.info({ actor: "keeper", why: "calendar", calendarId: id, what, tx: sent.hash }, "market calendar updated");
  if (sent.stage === "reverted") throw new Error(`calendar ${what} reverted in ${sent.hash}`);
}
