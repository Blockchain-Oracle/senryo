/**
 * Lithic sandbox setup for services/card (D3) — idempotent; run once the sandbox API key exists and the card service
 * is reachable over HTTPS at `CARD_PUBLIC_URL` (api.<domain>, which routes /v1/card/* to senryo-card):
 *   LITHIC_API_KEY_FILE=~/.config/senryo/lithic-api-key CARD_PUBLIC_URL=https://api.<domain> \
 *     pnpm --filter @senryo/card lithic:setup
 * 1. Enrolls the ASA responder   POST /v1/responder_endpoints {type: AUTH_STREAM_ACCESS, url: …/v1/card/lithic/asa}
 * 2. Fetches the ASA HMAC secret GET  /v1/auth_stream/secret (calling it also switches on the webhook-* headers)
 * 3. Subscribes the events hook  POST /v1/event_subscriptions {url: …/v1/card/lithic/events, card_transaction.updated}
 *    and fetches its secret      GET  /v1/event_subscriptions/{token}/secret
 * Secrets are written to `SECRETS_DIR` (default ~/.config/senryo) as 0600 files and never printed; set them in
 * Coolify as LITHIC_ASA_SECRET / LITHIC_WEBHOOK_SECRET (or mount them as *_FILE).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readSecret, requireSecret } from "@senryo/service-common";
import { LITHIC_SANDBOX_API } from "../src/constants.ts";
import { LithicApi } from "../src/lithic/api.ts";

const ASA_PATH = "/v1/card/lithic/asa";
const EVENTS_PATH = "/v1/card/lithic/events";
const EVENT_TYPES = ["card_transaction.updated"];
const PAGE_SIZE = 100;
const SECRET_FILE_MODE = 0o600;

interface ResponderStatus {
  enrolled?: boolean;
  url?: string | null;
}
interface Subscription {
  token: string;
  url: string;
  disabled: boolean;
  event_types?: string[];
}

const base = (process.env.LITHIC_API_BASE ?? LITHIC_SANDBOX_API).replace(/\/+$/, "");
const publicUrl = (process.env.CARD_PUBLIC_URL ?? "").replace(/\/+$/, "");
if (!publicUrl.startsWith("https://")) throw new Error("CARD_PUBLIC_URL must be the service's public https origin");
const secretsDir = (readSecret("SECRETS_DIR") ?? "~/.config/senryo").replace(/^~(?=\/)/, homedir());
const api = new LithicApi(requireSecret("LITHIC_API_KEY"), base);
if (!api.isSandbox && process.env.LITHIC_ALLOW_PRODUCTION !== "true")
  throw new Error(`refusing to configure ${base}: not the Lithic sandbox (set LITHIC_ALLOW_PRODUCTION=true)`);

function save(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Lithic returned no ${name}`);
  mkdirSync(secretsDir, { recursive: true });
  const path = join(secretsDir, name);
  writeFileSync(path, `${value}\n`, { mode: SECRET_FILE_MODE });
  return path;
}

// 1 · ASA responder
const asaUrl = `${publicUrl}${ASA_PATH}`;
const asa = await api.request<ResponderStatus>("GET", "/v1/responder_endpoints?type=AUTH_STREAM_ACCESS");
if (asa.enrolled && asa.url === asaUrl) {
  console.log(`ASA responder already enrolled: ${asaUrl}`);
} else {
  if (asa.enrolled) await api.request("DELETE", "/v1/responder_endpoints?type=AUTH_STREAM_ACCESS");
  await api.request("POST", "/v1/responder_endpoints", { type: "AUTH_STREAM_ACCESS", url: asaUrl });
  console.log(`ASA responder enrolled: ${asaUrl}${asa.url ? ` (was ${asa.url})` : ""}`);
}

// 2 · ASA HMAC secret
const asaSecret = await api.request<{ secret?: string }>("GET", "/v1/auth_stream/secret");
console.log(`ASA secret → ${save("lithic-asa-secret", asaSecret.secret)}  (LITHIC_ASA_SECRET)`);

// 3 · Events subscription + its secret
const eventsUrl = `${publicUrl}${EVENTS_PATH}`;
const page = await api.request<{ data: Subscription[] }>("GET", `/v1/event_subscriptions?page_size=${PAGE_SIZE}`);
let subscription = page.data.find((s) => s.url === eventsUrl);
if (subscription?.disabled || (subscription && !EVENT_TYPES.every((t) => subscription?.event_types?.includes(t)))) {
  await api.request("PATCH", `/v1/event_subscriptions/${subscription.token}`, {
    url: eventsUrl,
    disabled: false,
    event_types: EVENT_TYPES,
  });
  console.log(`events subscription re-enabled: ${subscription.token}`);
}
if (!subscription) {
  subscription = await api.request<Subscription>("POST", "/v1/event_subscriptions", {
    url: eventsUrl,
    description: "Senryo Kinpaku card lifecycle (services/card)",
    event_types: EVENT_TYPES,
  });
  console.log(`events subscription created: ${subscription.token} → ${eventsUrl}`);
} else {
  console.log(`events subscription present: ${subscription.token} → ${eventsUrl}`);
}
const hookSecret = await api.request<{ secret?: string }>(
  "GET",
  `/v1/event_subscriptions/${subscription.token}/secret`,
);
console.log(`events secret → ${save("lithic-webhook-secret", hookSecret.secret)}  (LITHIC_WEBHOOK_SECRET)`);
console.log("Done. Set both secrets on senryo-card in Coolify (Runtime only) and redeploy it.");
