import { type Hex, seriesOf, type TicketChange } from "@senryo/chain";
import { BAND_INDEX, type ChainId } from "@senryo/config";
import { appLink, type Db, dollarsText, pushTitle } from "@senryo/service-common";
import type { Notifier } from "./notify.ts";

/**
 * "You won $9.60 · BTC 5m Up" (the plan's notifications): a push for every win and refund the moment its payout lands,
 * idempotent on the ticket. A loss is shown in the app, never pushed.
 */
const OUTCOME_WIN = 1;
const OUTCOME_REFUND = 2;
const BAND_NAMES = Object.fromEntries(Object.entries(BAND_INDEX).map(([name, i]) => [i, name])) as Record<
  number,
  string
>;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

function cadenceLabel(sec: number): string {
  const min = sec / SECONDS_PER_MINUTE;
  return min >= MINUTES_PER_HOUR ? `${min / MINUTES_PER_HOUR}h` : `${min}m`;
}

export async function notifyResults(db: Db, notifier: Notifier, chainId: ChainId, changes: readonly TicketChange[]) {
  for (const c of changes) {
    if (c.kind !== "claimed" || (c.outcome !== OUTCOME_WIN && c.outcome !== OUTCOME_REFUND) || c.amount === 0n)
      continue;
    const [row] = await db<{ owner: string; series_id: string; band: number }[]>`
      SELECT owner, series_id, band FROM market_tickets WHERE chain_id = ${chainId} AND ticket_id = ${c.ticketId}`;
    if (!row) continue;
    const series = seriesOf(chainId, row.series_id as Hex);
    if (!series) continue;
    const symbol = series.market.symbol;
    const band = BAND_NAMES[row.band] ?? "call";
    const what = `${symbol} ${cadenceLabel(series.cadenceSec)} · ${band.charAt(0).toUpperCase()}${band.slice(1)}`;
    const won = c.outcome === OUTCOME_WIN;
    await notifier.push(chainId, `result:${c.ticketId}`, row.owner, "results", {
      title: pushTitle(
        chainId,
        won ? `You won ${dollarsText(chainId, c.amount)}` : `Refunded ${dollarsText(chainId, c.amount)}`,
      ),
      body: won ? what : `${what} — the price closed exactly on the line`,
      url: appLink(chainId, `/calls/${c.ticketId}`),
      subject: { kind: "market", marketId: symbol },
      collapseKey: `result:${c.ticketId}`,
    });
  }
}
