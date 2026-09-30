import { createHmac } from "node:crypto";
import { MS_PER_SECOND } from "@senryo/service-common";
import { LITHIC_SANDBOX_API, LITHIC_TIMEOUT_MS } from "../constants.ts";

/**
 * The few Lithic REST calls the card service makes, per the official Node SDK (lithic-node main, 30 Sep):
 * `Authorization: <api key>` (raw key), JSON bodies, cents. No SDK dependency — the ASA hot path never calls Lithic.
 *  - GET  /v1/cards/{token}            (sandbox returns the PAN — only used to drive simulate; never stored/logged)
 *  - PATCH /v1/cards/{token} {state}   (freeze = PAUSED, D-039)
 *  - POST /v1/simulate/authorize       (D-042 demo swipe; sandbox only)
 *  - embed URL: base64(JSON params) + HMAC-SHA256(api key) — `cards.getEmbedURL` (PAN reveal in an iframe)
 */
export class LithicApi {
  constructor(
    private readonly apiKey: string,
    private readonly base: string,
  ) {}

  get isSandbox(): boolean {
    return this.base === LITHIC_SANDBOX_API;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { authorization: this.apiKey, "content-type": "application/json", accept: "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(LITHIC_TIMEOUT_MS),
    });
    if (!res.ok) throw new LithicError(res.status, `${method} ${path} → HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  async card(token: string): Promise<{ token: string; state: string; pan?: string; last_four?: string }> {
    return this.request("GET", `/v1/cards/${encodeURIComponent(token)}`);
  }

  async setState(token: string, state: "OPEN" | "PAUSED"): Promise<{ token: string; state: string }> {
    return this.request("PATCH", `/v1/cards/${encodeURIComponent(token)}`, { state });
  }

  async simulateAuthorize(params: {
    pan: string;
    amount: number;
    descriptor: string;
    mcc?: string | undefined;
  }): Promise<{ token: string; debugging_request_id?: string }> {
    return this.request("POST", "/v1/simulate/authorize", params);
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
  ) {
    super(message);
    this.name = "LithicError";
  }
}
