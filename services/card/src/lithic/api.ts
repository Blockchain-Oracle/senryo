import { createHmac } from "node:crypto";
import { MS_PER_SECOND } from "@senryo/service-common";
import { LITHIC_SANDBOX_HOST, LITHIC_TIMEOUT_MS } from "../constants.ts";

/**
 * The few Lithic REST calls the card service makes, per the official Node SDK (lithic-node main, read 2 Oct):
 * `Authorization: <api key>` (raw key), JSON bodies, cents. No SDK dependency — the ASA hot path never calls Lithic.
 *  - POST  /v1/cards {type: VIRTUAL}      issue (E1); sandbox programs 00000000-0000-0000-{1000,2000}-000000000000
 *  - GET   /v1/cards/{token}              sandbox returns the PAN — only used to drive simulate; never stored/logged
 *  - PATCH /v1/cards/{token} {state}      freeze = PAUSED, unfreeze = OPEN (D-039)
 *  - POST  /v1/simulate/{authorize, clearing, void, return}   D-042 practice payments; sandbox only
 *  - GET   /v1/transactions/{token}       the issuer's own result when it decided without asking us
 *  - embed URL: base64(JSON params) + HMAC-SHA256(api key) — `cards.getEmbedURL` (PAN reveal in an iframe)
 *  - setup (scripts/lithic-setup.ts): /v1/responder_endpoints (ASA), /v1/auth_stream/secret, /v1/event_subscriptions
 */

export interface LithicCard {
  token: string;
  state: string;
  type?: string;
  pan?: string;
  last_four?: string;
  memo?: string;
}

/** The fields we read from `GET /v1/transactions/{token}` (cardholder amounts in cents). */
export interface LithicTransaction {
  token: string;
  card_token: string;
  /** DECLINED · EXPIRED · PENDING · SETTLED · VOIDED */
  status: string;
  result: string;
  amounts?: { cardholder?: { amount: number; currency?: string } };
  merchant?: { descriptor?: string; mcc?: string };
}

export interface SimulateAuthorize {
  pan: string;
  amount: number;
  descriptor: string;
  mcc?: string | undefined;
}

type Simulated = { token?: string; debugging_request_id?: string };

export class LithicApi {
  private readonly base: string;

  constructor(
    private readonly apiKey: string,
    base: string,
  ) {
    this.base = base.replace(/\/+$/, "");
  }

  get isSandbox(): boolean {
    return new URL(this.base).host === LITHIC_SANDBOX_HOST;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { authorization: this.apiKey, "content-type": "application/json", accept: "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(LITHIC_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Lithic error bodies are `{ message, debugging_request_id }` — never card data.
      const detail = (await res.json().catch(() => ({}))) as { message?: string; debugging_request_id?: string };
      throw new LithicError(res.status, `${method} ${path} → HTTP ${res.status}`, detail);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  createCard(params: { memo: string; cardProgramToken?: string | undefined }): Promise<LithicCard> {
    return this.request("POST", "/v1/cards", {
      type: "VIRTUAL",
      state: "OPEN",
      memo: params.memo,
      ...(params.cardProgramToken ? { card_program_token: params.cardProgramToken } : {}),
    });
  }

  card(token: string): Promise<LithicCard> {
    return this.request("GET", `/v1/cards/${encodeURIComponent(token)}`);
  }

  setState(token: string, state: "OPEN" | "PAUSED" | "CLOSED"): Promise<LithicCard> {
    return this.request("PATCH", `/v1/cards/${encodeURIComponent(token)}`, { state });
  }

  transaction(token: string): Promise<LithicTransaction> {
    return this.request("GET", `/v1/transactions/${encodeURIComponent(token)}`);
  }

  simulateAuthorize(params: SimulateAuthorize): Promise<Simulated> {
    return this.request("POST", "/v1/simulate/authorize", params);
  }

  /** Clears (captures) a pending authorisation; an amount above the authorised one is an over-capture. */
  simulateClearing(token: string, amount?: number): Promise<Simulated> {
    return this.request("POST", "/v1/simulate/clearing", { token, ...(amount ? { amount } : {}) });
  }

  simulateVoid(token: string, type: "AUTHORIZATION_REVERSAL" | "AUTHORIZATION_EXPIRY", amount?: number) {
    return this.request<Simulated>("POST", "/v1/simulate/void", { token, type, ...(amount ? { amount } : {}) });
  }

  /** A refund to the card: a new, immediately settled credit transaction (RETURN event). */
  simulateReturn(params: { pan: string; amount: number; descriptor: string }): Promise<Simulated> {
    return this.request("POST", "/v1/simulate/return", params);
  }

  /** Signed iframe URL for the PAN/CVV reveal (expires in `expiresInSec`). */
  embedUrl(cardToken: string, expiresInSec: number, targetOrigin?: string): string {
    const params = {
      token: cardToken,
      expiration: new Date(Date.now() + expiresInSec * MS_PER_SECOND).toISOString(),
      ...(targetOrigin ? { target_origin: targetOrigin } : {}),
    };
    const serialized = JSON.stringify(params);
    const hmac = createHmac("sha256", this.apiKey).update(serialized).digest("base64");
    const embedRequest = Buffer.from(serialized).toString("base64");
    const url = new URL("/v1/embed/card", this.base);
    url.searchParams.set("hmac", hmac);
    url.searchParams.set("embed_request", embedRequest);
    return url.toString();
  }
}

export class LithicError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail: { message?: string; debugging_request_id?: string } = {},
  ) {
    super(detail.message ? `${message}: ${detail.message}` : message);
    this.name = "LithicError";
  }
}
