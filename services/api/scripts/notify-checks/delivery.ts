import { randomUUID } from "node:crypto";
import { type ChainId, TESTNET_CHAIN_ID } from "@senryo/config";
import {
  createLogger,
  DEVICE_NOT_REGISTERED,
  type ExpoMessage,
  ExpoRequestError,
  type ExpoTicket,
  PUSH_DELIVERY,
  type PushChannel,
  PushDelivery,
  type PushTransport,
  recordNotification,
} from "@senryo/service-common";
import type { Checks, Harness, User } from "../social-harness.ts";
import { addToken } from "./tokens.ts";

const T: ChainId = TESTNET_CHAIN_ID;
const HTTP_UNAVAILABLE = 503;
const STALE_MINUTES = 20;

type Behaviour = "ok" | "throw" | "rateLimited" | "unregistered";

/** Expo stand-in: answers per event key from a script (default "ok") and records every message it was given. */
class FakeExpo implements PushTransport {
  readonly messages: ExpoMessage[] = [];
  private readonly plan = new Map<string, Behaviour[]>();

  script(key: string, ...steps: Behaviour[]): void {
    this.plan.set(key, steps);
  }

  sends(key: string): number {
    return new Set(this.messages.filter((m) => m.data.eventKey === key).map((m) => m.data.attempt)).size;
  }

  async send(messages: readonly ExpoMessage[]): Promise<ExpoTicket[]> {
    const key = String(messages[0]?.data.eventKey);
    const attempt = randomUUID();
    this.messages.push(...messages.map((m) => ({ ...m, data: { ...m.data, attempt } })));
    const step = this.plan.get(key)?.shift() ?? "ok";
    if (step === "throw") throw new ExpoRequestError(HTTP_UNAVAILABLE, []);
    return messages.map(() =>
      step === "ok"
        ? { status: "ok" as const, id: `chk-${randomUUID()}` }
        : {
            status: "error" as const,
            message: "check",
            details: { error: step === "unregistered" ? DEVICE_NOT_REGISTERED : "MessageRateExceeded" },
          },
    );
  }
}

interface LedgerRow {
  delivered: boolean | null;
  attempts: number;
  next_attempt_at: Date | null;
}

/** The keeper's delivery path with Expo faked: retry once, claim once, close stale, respect channels and dead tokens. */
export async function deliveryChecks(h: Harness, c: Checks): Promise<void> {
  const expo = new FakeExpo();
  // No wait between attempts, so the retry is due on the next pass.
  const delivery = new PushDelivery(h.db, createLogger("notify-check", "silent"), expo, {
    ...PUSH_DELIVERY,
    retryDelaySec: 0,
  });
  await delivery.deliverDue(T); // whatever the inbox suite queued
  const record = async (u: User, channel: PushChannel = "fills"): Promise<string> => {
    const eventKey = `check:push:${randomUUID()}`;
    const title = "Practice · Check";
    await recordNotification(h.db, {
      chainId: T,
      eventKey,
      user: u.lower,
      channel,
      title,
      body: "",
      url: "",
      subject: null,
    });
    return `${T}:${eventKey}`;
  };
  const ledger = async (key: string): Promise<LedgerRow | undefined> =>
    (await h.db<LedgerRow[]>`SELECT delivered, attempts, next_attempt_at FROM push_sends WHERE event_key = ${key}`)[0];

  const phone = h.user();
  await addToken(h, phone, "ios");
  await addToken(h, phone, "android");

  const flaky = await record(phone);
  expo.script(flaky, "throw");
  const firstTry = await delivery.deliverNow(flaky);
  const queued = await ledger(flaky);
  c.record(
    "retry: a failed first attempt is recorded and queued once more",
    firstTry === "failed" && queued?.attempts === 1 && queued.delivered === false && queued.next_attempt_at !== null,
    { firstTry, queued },
  );
  await delivery.deliverDue(T);
  const recovered = await ledger(flaky);
  c.record(
    "retry: the second attempt delivers and closes the row (2 attempts, delivered)",
    recovered?.attempts === 2 &&
      recovered.delivered === true &&
      recovered.next_attempt_at === null &&
      expo.sends(flaky) === 2,
    { recovered, sends: expo.sends(flaky) },
  );

  const broken = await record(phone);
  expo.script(broken, "throw", "rateLimited", "ok");
  await delivery.deliverNow(broken);
  await delivery.deliverDue(T);
  await delivery.deliverDue(T);
  const gaveUp = await ledger(broken);
  c.record(
    "retry: exactly one retry — after two failures the push is final and never sent again",
    gaveUp?.attempts === 2 && gaveUp.delivered === false && gaveUp.next_attempt_at === null && expo.sends(broken) === 2,
    { gaveUp, sends: expo.sends(broken) },
  );

  const raced = await record(phone);
  await Promise.all([delivery.deliverNow(raced), delivery.deliverNow(raced), delivery.deliverDue(T)]);
  const again = await recordNotification(h.db, {
    chainId: T,
    eventKey: raced.slice(`${T}:`.length),
    user: phone.lower,
    channel: "fills",
    title: "Practice · Check",
    body: "",
    url: "",
    subject: null,
  });
  const once = await ledger(raced);
  const [ios, android] = expo.messages.filter((m) => m.data.eventKey === raced);
  c.record(
    "claim: racing senders send a push once, to every device; recording it again queues nothing",
    expo.sends(raced) === 1 &&
      once?.attempts === 1 &&
      once.delivered === true &&
      !again &&
      ios?.channelId === undefined &&
      android?.channelId === "fills",
    { sends: expo.sends(raced), once, again },
  );
  const [tickets] = await h.db<{ n: number }[]>`SELECT count(*)::int AS n FROM push_tickets WHERE event_key = ${raced}`;
  c.record("claim: each accepted message leaves a ticket for the receipts job", tickets?.n === 2, tickets);

  const nobody = h.user();
  const unheard = await record(nobody);
  const muted = h.user();
  await addToken(h, muted, "ios", { ch_social: false });
  const off = await record(muted, "social");
  const outcomes = [await delivery.deliverNow(unheard), await delivery.deliverNow(off)];
  const [noDevice, channelOff] = [await ledger(unheard), await ledger(off)];
  c.record(
    "devices: no device, or the channel switched off, is final without a send (the inbox keeps it)",
    outcomes.join() === "no_device,no_device" &&
      noDevice?.next_attempt_at === null &&
      channelOff?.next_attempt_at === null &&
      expo.sends(unheard) + expo.sends(off) === 0,
    { outcomes, noDevice, channelOff },
  );

  const gone = h.user();
  const token = await addToken(h, gone, "ios");
  const dead = await record(gone);
  expo.script(dead, "unregistered");
  const deadOutcome = await delivery.deliverNow(dead);
  const [disabled] = await h.db<{ off: boolean }[]>`
    SELECT disabled_at IS NOT NULL AS off FROM push_tokens WHERE token = ${token}`;
  const deadRow = await ledger(dead);
  c.record(
    "devices: DeviceNotRegistered disables the token and is never retried",
    deadOutcome === "unregistered" && disabled?.off === true && deadRow?.next_attempt_at === null,
    { deadOutcome, disabled, deadRow },
  );

  const late = await record(phone);
  await h.db`UPDATE push_sends SET sent_at = now() - make_interval(mins => ${STALE_MINUTES}) WHERE event_key = ${late}`;
  const pass = await delivery.deliverDue(T);
  const closed = await ledger(late);
  c.record(
    "freshness: a push queued past the window is closed unsent (no flood after an outage)",
    pass.stale >= 1 &&
      closed?.delivered === false &&
      closed.attempts === 0 &&
      closed.next_attempt_at === null &&
      expo.sends(late) === 0,
    { pass, closed },
  );
}
