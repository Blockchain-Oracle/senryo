import type { Db, Logger } from "@senryo/service-common";

/**
 * User pushes (health warnings, price alerts) and ops alerts. Pushes are idempotent on an event key (`push_sends`)
 * and only sent for finalized triggers. Delivery (Expo push / APNs Live Activity) and the ops channel
 * (Telegram/email) need credentials and an [OK?] — until then the notifier records and logs.
 */
export interface Notifier {
  /** Returns false when this event key was already sent. */
  push(eventKey: string, user: string, channel: string, message: string): Promise<boolean>;
  ops(level: "warn" | "error", message: string, detail?: Record<string, unknown>): void;
}

export class LedgerNotifier implements Notifier {
  constructor(
    private readonly db: Db,
    private readonly log: Logger,
  ) {}

  async push(eventKey: string, user: string, channel: string, message: string): Promise<boolean> {
    const inserted = await this.db`
      INSERT INTO push_sends (event_key, user_address, channel) VALUES (${eventKey}, ${user.toLowerCase()}, ${channel})
      ON CONFLICT (event_key) DO NOTHING RETURNING event_key`;
    if (inserted.length === 0) return false;
    this.log.info({ eventKey, user, channel, message }, "push recorded (delivery pending credentials)");
    return true;
  }

  ops(level: "warn" | "error", message: string, detail?: Record<string, unknown>): void {
    this.log[level]({ ops: true, ...detail }, message);
  }
}
