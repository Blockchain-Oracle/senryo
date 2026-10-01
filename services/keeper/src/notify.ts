import { describeError } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Db, Logger } from "@senryo/service-common";
import { DEVICE_NOT_REGISTERED, type ExpoMessage, type ExpoPush, type ExpoTicket, redactTokens } from "./expo.ts";

/**
 * User pushes (fills, liquidations, health warnings, deposits, price alerts) and ops alerts. Pushes are idempotent on
 * an event key (`push_sends`) and only sent for finalized triggers, then delivered through Expo to the user's
 * registered devices that keep that channel on. The ops channel (Telegram/email) needs credentials and an [OK?] —
 * until then it logs.
 */
export interface Notifier {
  /**
   * Returns false when this event was already sent. The key is stored chain-prefixed and the row carries `chainId`
   * (S8.22): keepers of both networks share one ledger, and a push must open the app in its own mode.
   */
  push(chainId: ChainId, eventKey: string, user: string, channel: PushChannel, message: PushMessage): Promise<boolean>;
  ops(level: "warn" | "error", message: string, detail?: Record<string, unknown>): void;
}

/** The app's channel names (api-client `PUSH_CHANNELS`, what `PUT /v1/push/token` stores per device). */
export type PushChannel = "fills" | "liquidation" | "deposits" | "card" | "priceAlerts";

const CHANNEL_COLUMN: Record<PushChannel, string> = {
  fills: "ch_fills",
  liquidation: "ch_liquidation",
  deposits: "ch_deposits",
  card: "ch_card",
  priceAlerts: "ch_price_alerts",
};

export interface PushMessage {
  title: string;
  body: string;
  /** senryo:// screen the tap opens, with `?chainId=`. */
  url: string;
  /** A newer push with the same key replaces the one on screen (iOS collapseId, Android tag). */
  collapseKey?: string | undefined;
}

interface DeviceToken {
  token: string;
  platform: string;
}

export class LedgerNotifier implements Notifier {
  /** Without `expo` (PUSH_DELIVERY=off) a push is recorded and logged only. */
  constructor(
    private readonly db: Db,
    private readonly log: Logger,
    private readonly expo?: ExpoPush | undefined,
  ) {}

  async push(
    chainId: ChainId,
    eventKey: string,
    user: string,
    channel: PushChannel,
    message: PushMessage,
  ): Promise<boolean> {
    const key = `${chainId}:${eventKey}`;
    const inserted = await this.db`
      INSERT INTO push_sends (event_key, user_address, channel, chain_id)
      VALUES (${key}, ${user.toLowerCase()}, ${channel}, ${chainId})
      ON CONFLICT (event_key) DO NOTHING RETURNING event_key`;
    if (inserted.length === 0) return false;
    if (!this.expo) {
      this.log.info({ eventKey: key, chainId, user, channel, title: message.title }, "push recorded (delivery off)");
      return true;
    }
    await this.deliver(this.expo, chainId, key, user, channel, message);
    return true;
  }

  ops(level: "warn" | "error", message: string, detail?: Record<string, unknown>): void {
    this.log[level]({ ops: true, ...detail }, message);
  }

  /**
   * Best effort, never throws: the `push_sends` row is already written, so an event whose delivery failed (network,
   * Expo down, bad credentials) is not sent again — the idempotency contract keeps a job from re-pushing an event on
   * every tick; one missed notification is the cost of an outage.
   */
  private async deliver(
    expo: ExpoPush,
    chainId: ChainId,
    key: string,
    user: string,
    channel: PushChannel,
    message: PushMessage,
  ): Promise<void> {
    try {
      const devices = await this.db<DeviceToken[]>`
        SELECT token, platform FROM push_tokens
         WHERE user_address = ${user.toLowerCase()} AND kind = 'expo' AND disabled_at IS NULL
           AND ${this.db(CHANNEL_COLUMN[channel])} = true`;
      if (devices.length === 0) {
        this.log.info({ eventKey: key, channel }, "push recorded (no device on this channel)");
        return;
      }
      const data = { url: message.url, chainId, channel, eventKey: key };
      const tickets = await expo.send(devices.map((d) => expoMessage(d, channel, message, data)));
      const accepted = await recordTickets(this.db, this.log, key, devices, tickets);
      this.log.info({ eventKey: key, channel, devices: devices.length, accepted }, "push sent");
    } catch (error) {
      this.log.warn({ eventKey: key, channel, err: redactTokens(describeError(error)) }, "push delivery failed");
    }
  }
}

function expoMessage(
  device: DeviceToken,
  channel: PushChannel,
  message: PushMessage,
  data: ExpoMessage["data"],
): ExpoMessage {
  const out: ExpoMessage = { to: device.token, title: message.title, body: message.body, sound: "default", data };
  // Android shows a push only on a channel the app created; the app creates one per push channel (same ids).
  if (device.platform === "android") out.channelId = channel;
  if (message.collapseKey) {
    out.collapseId = message.collapseKey;
    out.tag = message.collapseKey;
  }
  return out;
}

/** Stores accepted tickets for the receipts check, disables dead tokens; returns how many Expo accepted. */
async function recordTickets(
  db: Db,
  log: Logger,
  key: string,
  devices: readonly DeviceToken[],
  tickets: readonly ExpoTicket[],
): Promise<number> {
  let accepted = 0;
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
    if (code === DEVICE_NOT_REGISTERED) await disableToken(db, device.token);
    else log.warn({ eventKey: key, error: code, message: redactTokens(ticket.message) }, "push ticket error");
  }
  return accepted;
}

/**
 * Expo says this device can't receive pushes: stop sending until the app registers it again (`PUT /v1/push/token`
 * clears `disabled_at`). A late receipt (`sentAt`) never disables a token re-registered after that push went out.
 */
export async function disableToken(db: Db, token: string, sentAt?: Date): Promise<void> {
  await db`UPDATE push_tokens SET disabled_at = now(), updated_at = now()
            WHERE token = ${token} AND disabled_at IS NULL ${sentAt ? db`AND updated_at < ${sentAt}` : db``}`;
}
