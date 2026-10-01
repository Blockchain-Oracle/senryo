import {
  INTERVALS_MS,
  PUSH_RECEIPT_DELAY_SEC,
  PUSH_RECEIPT_TTL_SEC,
  PUSH_RECEIPTS_PER_RUN,
  RETENTION_DAYS,
} from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import { DEVICE_NOT_REGISTERED, type ExpoReceipt, expoClient, redactTokens } from "../expo.ts";
import { disableToken } from "../notify.ts";
import type { Job } from "../runner.ts";

interface DueTicket {
  ticket_id: string;
  token: string;
  event_key: string;
  created_at: Date;
  expired: boolean;
}

/**
 * Expo push receipts (docs: check ≥ 15 min after sending; receipts are cleared after 24 h). Tickets this network's
 * keeper stored (`push_tickets`, event keys prefixed with its chain id) are checked once their receipt is due: the
 * status and error are recorded, `DeviceNotRegistered` disables the token, any other error is logged. A ticket with no
 * receipt by the time Expo would have cleared it is closed as `missing`. Checked rows go after RETENTION_DAYS.
 */
export function pushReceiptsJob(ctx: KeeperContext): Job {
  const expo = expoClient(ctx.env);
  const prefix = `${ctx.chainId}:%`;
  return {
    name: "receipts",
    intervalMs: INTERVALS_MS.receipts,
    async run() {
      if (!expo) return;
      const due = await ctx.db<DueTicket[]>`
        SELECT ticket_id, token, event_key, created_at,
               created_at < now() - make_interval(secs => ${PUSH_RECEIPT_TTL_SEC}) AS expired
          FROM push_tickets
         WHERE checked_at IS NULL AND event_key LIKE ${prefix}
           AND created_at < now() - make_interval(secs => ${PUSH_RECEIPT_DELAY_SEC})
         ORDER BY created_at LIMIT ${PUSH_RECEIPTS_PER_RUN}`;
      const receipts =
        due.length > 0 ? await expo.receipts(due.map((t) => t.ticket_id)) : new Map<string, ExpoReceipt>();
      const counts = { ok: 0, error: 0, missing: 0, pending: 0 };
      for (const ticket of due) {
        const receipt = receipts.get(ticket.ticket_id);
        if (!receipt) {
          if (!ticket.expired) {
            counts.pending += 1;
            continue;
          }
          counts.missing += 1;
          await ctx.db`UPDATE push_tickets SET checked_at = now(), status = 'missing'
                        WHERE ticket_id = ${ticket.ticket_id}`;
          continue;
        }
        const code = receipt.status === "error" ? (receipt.details?.error ?? "unknown") : null;
        counts[receipt.status] += 1;
        await ctx.db`UPDATE push_tickets SET checked_at = now(), status = ${receipt.status}, error = ${code}
                      WHERE ticket_id = ${ticket.ticket_id}`;
        if (code === DEVICE_NOT_REGISTERED) await disableToken(ctx.db, ticket.token, ticket.created_at);
        else if (code !== null)
          ctx.log.warn(
            { eventKey: ticket.event_key, error: code, message: redactTokens(receipt.message ?? "") },
            "push receipt error",
          );
      }
      const purged = await ctx.db`
        DELETE FROM push_tickets
         WHERE event_key LIKE ${prefix} AND checked_at < now() - make_interval(days => ${RETENTION_DAYS.pushTickets})`;
      if (due.length > 0 || purged.count > 0)
        ctx.log.info({ ...counts, purged: purged.count }, "push receipts checked");
    },
  };
}
