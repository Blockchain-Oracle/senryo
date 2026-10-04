import type { PushChannel } from "@senryo/api-client";
import { describeError } from "@senryo/chain";
import { isChainId } from "@senryo/config";
import { PUSH_DELIVERY } from "./constants.ts";
import type { Db } from "./db.ts";
import { DEVICE_NOT_REGISTERED, type ExpoMessage, type ExpoTicket, redactTokens } from "./expo.ts";
import type { Logger } from "./logger.ts";
import { followedTradeVisible } from "./social-visibility.ts";

/**
 * Push delivery from the `push_sends` outbox (G1, D7). A recorded notification waits with `next_attempt_at`; a sender
 * claims it by its event key in one UPDATE (attempts + 1, `next_attempt_at` cleared), so two senders never both send
 * it. The claimed push goes to every registered device of the user that keeps that channel on:
 * - `delivered`: Expo accepted it for at least one device;
 * - `no_device` / `unregistered`: nobody to send to (dead tokens are disabled) — final, the inbox still has it;
 * - `failed`: the request failed or every ticket errored — re-queued once after `retryDelaySec`, then final.
 * A push older than `freshSec` is closed unsent (an outage or a delivery switch-on never floods a phone with old
 * news). A process dying mid-send leaves the row claimed and unsent: at most once, never twice.
 */

export const PUSH_CHANNEL_COLUMNS: Readonly<Record<PushChannel, string>> = {
  fills: "ch_fills",
  liquidation: "ch_liquidation",
  deposits: "ch_deposits",
  card: "ch_card",
  priceAlerts: "ch_price_alerts",
  social: "ch_social",
  followedTrades: "ch_followed_trades",
};

/** What sends the messages: `ExpoPush` in production, a stand-in in checks. */
export interface PushTransport {
  send(messages: readonly ExpoMessage[]): Promise<ExpoTicket[]>;
}

export type DeliveryOutcome = "delivered" | "no_device" | "unregistered" | "failed";
export type DeliveryPolicy = { [K in keyof typeof PUSH_DELIVERY]: number };

interface ClaimedPush {
  event_key: string;
  user_address: string;
  channel: PushChannel;
  chain_id: number;
  title: string;
  body: string;
  url: string | null;
  collapse_key: string | null;
  attempts: number;
}

interface DeviceToken {
  token: string;
  platform: string;
}

export class PushDelivery {
  constructor(
    private readonly db: Db,
    private readonly log: Logger,
    private readonly transport: PushTransport,
    private readonly policy: DeliveryPolicy = PUSH_DELIVERY,
  ) {}

  /** Sends one recorded push now if it is still waiting (the keeper's inline attempt right after recording it). */
  async deliverNow(key: string): Promise<DeliveryOutcome | undefined> {
    const [row] = await this.db<ClaimedPush[]>`
      UPDATE push_sends p SET attempts = p.attempts + 1, next_attempt_at = NULL
       WHERE p.event_key = ${key} AND p.next_attempt_at <= now()
         AND p.sent_at > now() - make_interval(secs => ${this.policy.freshSec})
      RETURNING ${this.claimed()}`;
    return row ? this.attempt(row) : undefined;
  }

  /** The outbox pass for one network: close stale pushes, then claim and send what is due. Outcome counts. */
  async deliverDue(chainId: number): Promise<Record<DeliveryOutcome | "stale", number>> {
    const counts = { delivered: 0, no_device: 0, unregistered: 0, failed: 0, stale: 0 };
    const stale = await this.db`
      UPDATE push_sends SET next_attempt_at = NULL, delivered = false
       WHERE chain_id = ${chainId} AND next_attempt_at IS NOT NULL
         AND sent_at <= now() - make_interval(secs => ${this.policy.freshSec})`;
    counts.stale = stale.count;
    const due = await this.db<ClaimedPush[]>`
      UPDATE push_sends p SET attempts = p.attempts + 1, next_attempt_at = NULL
        FROM (SELECT event_key FROM push_sends
               WHERE chain_id = ${chainId} AND next_attempt_at <= now()
               ORDER BY next_attempt_at LIMIT ${this.policy.batch} FOR UPDATE SKIP LOCKED) due
       WHERE p.event_key = due.event_key
      RETURNING ${this.claimed()}`;
    for (const row of due) counts[await this.attempt(row)] += 1;
    return counts;
  }

  /** The claimed row (`push_sends p`) as `ClaimedPush`. */
  private claimed() {
    return this.db`p.event_key, p.user_address, p.channel, p.chain_id, p.title, p.body, p.url, p.collapse_key,
                   p.attempts`;
  }

  /** Sends a claimed push and records the outcome; a failed first attempt is queued once more. Never throws. */
  private async attempt(row: ClaimedPush): Promise<DeliveryOutcome> {
    const outcome = await this.send(row);
    const retry = outcome === "failed" && row.attempts < this.policy.maxAttempts;
    try {
      await this.db`
        UPDATE push_sends SET delivered = ${outcome === "delivered"},
               next_attempt_at = ${retry ? this.db`now() + make_interval(secs => ${this.policy.retryDelaySec})` : null}
         WHERE event_key = ${row.event_key}`;
    } catch (error) {
      this.log.warn({ eventKey: row.event_key, err: describeError(error) }, "push outcome not recorded");
    }
    const level = outcome === "failed" ? "warn" : "info";
    this.log[level]({ eventKey: row.event_key, channel: row.channel, attempt: row.attempts, outcome, retry }, "push");
    return outcome;
  }

  private async send(row: ClaimedPush): Promise<DeliveryOutcome> {
    const column = PUSH_CHANNEL_COLUMNS[row.channel];
    if (!column) return "no_device";
    try {
      if (!isChainId(row.chain_id)) return "no_device";
      const [eligible] = await this.db`
        SELECT 1 FROM push_sends p WHERE p.event_key = ${row.event_key}
          AND ${followedTradeVisible(this.db, row.chain_id, "p")}`;
      if (!eligible) return "no_device";
      const devices = await this.db<DeviceToken[]>`
        SELECT token, platform FROM push_tokens
         WHERE user_address = ${row.user_address} AND kind = 'expo' AND disabled_at IS NULL
           AND ${this.db(column)} = true`;
      if (devices.length === 0) return "no_device";
      const data = { url: row.url ?? "", chainId: row.chain_id, channel: row.channel, eventKey: row.event_key };
      const tickets = await this.transport.send(devices.map((d) => expoMessage(d, row, data)));
      const { accepted, unregistered } = await recordTickets(this.db, this.log, row.event_key, devices, tickets);
      if (accepted > 0) return "delivered";
      return unregistered === devices.length ? "unregistered" : "failed";
    } catch (error) {
      this.log.warn({ eventKey: row.event_key, err: redactTokens(describeError(error)) }, "push delivery failed");
      return "failed";
    }
  }
}

function expoMessage(device: DeviceToken, row: ClaimedPush, data: ExpoMessage["data"]): ExpoMessage {
  const out: ExpoMessage = { to: device.token, title: row.title, body: row.body, sound: "default", data };
  // Android shows a push only on a channel the app created; the app creates one per push channel (same ids).
  if (device.platform === "android") out.channelId = row.channel;
  if (row.collapse_key) {
    out.collapseId = row.collapse_key;
    out.tag = row.collapse_key;
  }
  return out;
}

/** Stores accepted tickets for the receipts check and disables dead tokens. */
async function recordTickets(
  db: Db,
  log: Logger,
  key: string,
  devices: readonly DeviceToken[],
  tickets: readonly ExpoTicket[],
): Promise<{ accepted: number; unregistered: number }> {
  let accepted = 0;
  let unregistered = 0;
  for (const [i, ticket] of tickets.entries()) {
    const device = devices[i];
    if (!device) continue;
    if (ticket.status === "ok") {
      accepted += 1;
      await db`INSERT INTO push_tickets (ticket_id, token, event_key) VALUES (${ticket.id}, ${device.token}, ${key})
               ON CONFLICT (ticket_id) DO NOTHING`;
      continue;
    }
    const code = ticket.details?.error;
    if (code === DEVICE_NOT_REGISTERED) {
      unregistered += 1;
      await disableToken(db, device.token);
    } else log.warn({ eventKey: key, error: code, message: redactTokens(ticket.message) }, "push ticket error");
  }
  return { accepted, unregistered };
}

/**
 * Expo says this device can't receive pushes: stop sending until the app registers it again (`PUT /v1/push/token`
 * clears `disabled_at`). A late receipt (`sentAt`) never disables a token re-registered after that push went out.
 */
export async function disableToken(db: Db, token: string, sentAt?: Date): Promise<void> {
  await db`UPDATE push_tokens SET disabled_at = now(), updated_at = now()
            WHERE token = ${token} AND disabled_at IS NULL ${sentAt ? db`AND updated_at < ${sentAt}` : db``}`;
}
