import { readSecret } from "@senryo/service-common";
import { z } from "zod";
import { EXPO_PUSH } from "./constants.ts";
import type { KeeperEnv } from "./env.ts";

/**
 * Expo Push Service over plain `fetch` (docs.expo.dev/push-notifications/sending-notifications, read 2026-10-01).
 * `send` answers one ticket per message, in order; `getReceipts` answers a map that omits ids with no receipt yet.
 * A per-message problem is `status: "error"` with `details.error` (DeviceNotRegistered, MessageTooBig,
 * MessageRateExceeded, MismatchSenderId, InvalidCredentials); a whole-request failure is HTTP 4xx/5xx with
 * `errors[]`. Measured 2026-10-01 with a fake token: HTTP 200, a ticket `{ status: "error", details: { error:
 * "DeviceNotRegistered", expoPushToken } }`. The access token is only needed once enhanced push security is on.
 */

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data: Record<string, string | number>;
  /** Android only: the app-created notification channel. */
  channelId?: string;
  /** iOS collapse / Android tag: a newer message with the same key replaces the shown one. */
  collapseId?: string;
  tag?: string;
}

/** Expo's error code for a token that can no longer receive pushes — the token is disabled, never retried. */
export const DEVICE_NOT_REGISTERED = "DeviceNotRegistered";

const detailsSchema = z.object({ error: z.string().optional() }).loose().optional();
const ticketSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), id: z.string() }),
  z.object({ status: z.literal("error"), message: z.string(), details: detailsSchema }),
]);
const receiptSchema = z.object({
  status: z.enum(["ok", "error"]),
  message: z.string().optional(),
  details: detailsSchema,
});
const sendSchema = z.object({ data: z.array(ticketSchema) });
const receiptsSchema = z.object({ data: z.record(z.string(), receiptSchema) });
const requestErrorsSchema = z.object({ errors: z.array(z.object({ code: z.string() }).loose()) });

export type ExpoTicket = z.output<typeof ticketSchema>;
export type ExpoReceipt = z.output<typeof receiptSchema>;

const TOKEN_PATTERN = /Expo(?:nent)?PushToken\[[^\]]*\]/g;

/** Expo error text names the token; a token is enough to push to that device, so logs never carry it. */
export function redactTokens(text: string): string {
  return text.replace(TOKEN_PATTERN, "<token>");
}

export class ExpoRequestError extends Error {
  constructor(
    readonly status: number,
    readonly codes: readonly string[],
  ) {
    super(`expo push request failed: HTTP ${status}${codes.length > 0 ? ` ${codes.join(",")}` : ""}`);
    this.name = "ExpoRequestError";
  }
}

export class ExpoPush {
  constructor(private readonly accessToken: string | undefined) {}

  /** One ticket per message, in order (batched by EXPO_PUSH.sendBatch). Throws on a request or network failure. */
  async send(messages: readonly ExpoMessage[]): Promise<ExpoTicket[]> {
    const tickets: ExpoTicket[] = [];
    for (let i = 0; i < messages.length; i += EXPO_PUSH.sendBatch) {
      const batch = messages.slice(i, i + EXPO_PUSH.sendBatch);
      const { data } = sendSchema.parse(await this.post(EXPO_PUSH.sendUrl, batch));
      if (data.length !== batch.length) throw new Error(`expo push: ${data.length} tickets for ${batch.length}`);
      tickets.push(...data);
    }
    return tickets;
  }

  /** Receipts by ticket id (batched by EXPO_PUSH.receiptsBatch); an id with no receipt yet is absent. */
  async receipts(ids: readonly string[]): Promise<Map<string, ExpoReceipt>> {
    const out = new Map<string, ExpoReceipt>();
    for (let i = 0; i < ids.length; i += EXPO_PUSH.receiptsBatch) {
      const batch = ids.slice(i, i + EXPO_PUSH.receiptsBatch);
      const { data } = receiptsSchema.parse(await this.post(EXPO_PUSH.receiptsUrl, { ids: batch }));
      for (const [id, receipt] of Object.entries(data)) out.set(id, receipt);
    }
    return out;
  }

  private async post(url: string, body: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "accept-encoding": "gzip, deflate",
      "content-type": "application/json",
    };
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(EXPO_PUSH.timeoutMs),
    });
    const json: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const parsed = requestErrorsSchema.safeParse(json);
      throw new ExpoRequestError(res.status, parsed.success ? parsed.data.errors.map((e) => e.code) : []);
    }
    return json;
  }
}

/** The Expo client, or undefined when `PUSH_DELIVERY=off` (record and log only). */
export function expoClient(env: Pick<KeeperEnv, "PUSH_DELIVERY">): ExpoPush | undefined {
  return env.PUSH_DELIVERY === "on" ? new ExpoPush(readSecret("EXPO_ACCESS_TOKEN")) : undefined;
}
