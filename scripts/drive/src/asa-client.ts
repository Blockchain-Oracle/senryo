import { createHmac, randomUUID } from "node:crypto";
import { MS_PER_SECOND } from "./constants.ts";

/**
 * Plays Lithic's side of ASA locally: builds a `card_authorization.approval_request`-shaped body (lithic-node
 * `CardAuthorization`) and signs it Standard-Webhooks style (`webhook-id.webhook-timestamp.body`, HMAC-SHA256 with the
 * base64 part of a local `whsec_` secret). Retries reuse the exact same bytes and headers, like Lithic's.
 */
export interface AsaCall {
  token: string;
  body: string;
  headers: Record<string, string>;
}

function signed(secret: string, token: string, body: string): AsaCall {
  const id = `msg_${randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / MS_PER_SECOND));
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return {
    token,
    body,
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
    },
  };
}

/** `card_transaction.updated` with one lifecycle event (CLEARING, AUTHORIZATION_REVERSAL, …) for `txnToken`. */
export function buildEvent(secret: string, txnToken: string, cardToken: string, type: string, cents: number): AsaCall {
  const body = JSON.stringify({
    event_type: "card_transaction.updated",
    token: txnToken,
    card_token: cardToken,
    events: [
      {
        token: randomUUID(),
        type,
        amounts: { cardholder: { amount: cents, currency: "USD" }, settlement: null },
        result: "APPROVED",
        created: new Date().toISOString(),
      },
    ],
  });
  return signed(secret, txnToken, body);
}

export async function sendEvent(url: string, call: AsaCall): Promise<{ status: number; queued: number | undefined }> {
  const res = await fetch(`${url}/v1/card/lithic/events`, { method: "POST", headers: call.headers, body: call.body });
  const json = (await res.json().catch(() => ({}))) as { queued?: number };
  return { status: res.status, queued: json.queued };
}

export function buildAsa(secret: string, cardToken: string, cents: number, mcc = "5411"): AsaCall {
  const token = randomUUID();
  const usd = { amount: cents, currency: "USD" };
  const body = JSON.stringify({
    token,
    status: "AUTHORIZATION",
    amount: cents,
    amounts: { cardholder: { ...usd, conversion_rate: "1.000000" }, hold: usd, merchant: usd, settlement: null },
    card: { token: cardToken, last_four: "4242" },
    merchant: { mcc, descriptor: "SENRYO DRIVE", acceptor_id: "drive" },
    created: new Date().toISOString(),
  });
  return signed(secret, token, body);
}

export interface AsaReply {
  token: string;
  status: number;
  result: string | undefined;
  ms: number;
}

export async function sendAsa(url: string, call: AsaCall): Promise<AsaReply> {
  const started = performance.now();
  const res = await fetch(`${url}/v1/card/lithic/asa`, { method: "POST", headers: call.headers, body: call.body });
  const json = (await res.json().catch(() => ({}))) as { result?: string };
  return { token: call.token, status: res.status, result: json.result, ms: Math.round(performance.now() - started) };
}
