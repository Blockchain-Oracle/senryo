import { describeError } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import {
  type Db,
  type Logger,
  type NotificationMessage,
  notificationKey,
  type PushChannel,
  type PushDelivery,
  recordNotification,
} from "@senryo/service-common";

/**
 * User pushes (fills, liquidations, health warnings, deposits, price alerts) and ops alerts. A push is a
 * notification (`recordNotification`): the inbox row and its queued push, idempotent on an event key and only
 * recorded for finalized triggers. The keeper then tries to deliver it at once; the `pushes` job delivers what the
 * api and card service recorded and the one retry of a failed attempt. The ops channel (Telegram/email) needs
 * credentials and an [OK?] — until then it logs.
 */
export interface Notifier {
  /**
   * Returns false when this event was already recorded. The key is stored chain-prefixed and the row carries
   * `chainId` (S8.22): keepers of both networks share one ledger, and a push must open the app in its own mode.
   */
  push(chainId: ChainId, eventKey: string, user: string, channel: PushChannel, message: PushMessage): Promise<boolean>;
  ops(level: "warn" | "error", message: string, detail?: Record<string, unknown>): void;
}

export type { PushChannel };
export type PushMessage = NotificationMessage;

export class LedgerNotifier implements Notifier {
  /** Without `delivery` (PUSH_DELIVERY=off) a push is recorded and logged only. */
  constructor(
    private readonly db: Db,
    private readonly log: Logger,
    private readonly delivery?: PushDelivery | undefined,
  ) {}

  async push(
    chainId: ChainId,
    eventKey: string,
    user: string,
    channel: PushChannel,
    message: PushMessage,
  ): Promise<boolean> {
    const inserted = await recordNotification(this.db, { chainId, eventKey, user, channel, ...message });
    if (!inserted) return false;
    const key = notificationKey(chainId, eventKey);
    if (!this.delivery) {
      this.log.info({ eventKey: key, chainId, user, channel, title: message.title }, "push recorded (delivery off)");
      return true;
    }
    // Best effort: the row is written, so a failure here is the `pushes` job's retry, never a second record.
    await this.delivery
      .deliverNow(key)
      .catch((error) => this.log.warn({ eventKey: key, err: describeError(error) }, "push not attempted"));
    return true;
  }

  ops(level: "warn" | "error", message: string, detail?: Record<string, unknown>): void {
    this.log[level]({ ops: true, ...detail }, message);
  }
}
