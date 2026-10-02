import { SUPPORT_EMAIL } from "@senryo/api-client";
import { API_ORIGIN, type ChainId, isChainId, RP_ID, WEB_ORIGIN } from "@senryo/config";
import { baseEnvSchema, csvSchema, parseEnv, portSchema, readSecret } from "@senryo/service-common";
import { z } from "zod";
import {
  API_PORT,
  COUNTRY_HEADERS,
  MIN_APP_VERSION,
  STARTER_PER_DEVICE_PER_DAY,
  STARTER_PER_NETWORK_PER_DAY,
} from "./constants.ts";

export const apiEnvSchema = baseEnvSchema.extend({
  PORT: portSchema.default(API_PORT),
  /** Every chain this api serves (practice 10143 now; mainnet 143 once S8 deploys). CHAIN_ID is the default. */
  CHAIN_IDS: csvSchema.transform((list, ctx) => {
    const ids = (list ?? []).map(Number);
    if (!ids.every(isChainId)) ctx.addIssue({ code: "custom", message: "unknown chain id in CHAIN_IDS" });
    return ids as ChainId[];
  }),
  SIWE_DOMAIN: z.string().default(RP_ID),
  SIWE_URI: z.url().default(API_ORIGIN),
  CORS_ORIGINS: csvSchema.transform((list) => list ?? [WEB_ORIGIN]),
  MIN_APP_VERSION: z.string().default(MIN_APP_VERSION),
  CARD_URL: z.url().optional(),
  INDEXER_GRAPHQL_URL: z.url().optional(),
  STARTER_PER_DEVICE_PER_DAY: z.coerce.number().int().positive().default(STARTER_PER_DEVICE_PER_DAY),
  STARTER_PER_NETWORK_PER_DAY: z.coerce.number().int().positive().default(STARTER_PER_NETWORK_PER_DAY),
  /** Trust this edge country header (only behind that CDN; S8.5b). Unset = DB-IP on the client IP only. */
  TRUSTED_COUNTRY_HEADER: z.enum(COUNTRY_HEADERS).optional(),
  /** The contact point /v1/config publishes for reports and safety questions (App Store 1.2, S12b.6). */
  SUPPORT_EMAIL: z.email().default(SUPPORT_EMAIL),
  SUPPORT_URL: z.url().optional(),
  /** Feature flags served by /v1/config, e.g. `card=1,perpl=0`. */
  FEATURES: csvSchema.transform((list) =>
    Object.fromEntries((list ?? []).map((pair) => [pair.split("=")[0] ?? pair, pair.split("=")[1] !== "0"])),
  ),
});

export type ApiEnv = z.output<typeof apiEnvSchema>;

export interface ApiSecrets {
  sessionSecret: string | undefined;
  turnstileSecret: string | undefined;
  /** Operator bearer secret for the moderation review queue (S12b.6); unset → those routes answer 503. */
  adminSecret: string | undefined;
  /** Envio HyperSync token for holdings discovery (D6); its own variable so it needn't share the indexer's budget. */
  hypersyncToken: string | undefined;
  /** Alchemy Portfolio API key — the holdings discovery fallback; unset → skipped. */
  alchemyKey: string | undefined;
  /** Aurora (NEAR Intents) Studio key — incident feed and, later, quotes; unset → Aurora reports `no_key`. */
  auroraKey: string | undefined;
  /** Relay API key — deposit addresses from Solana/Bitcoin origins and the `/requests/v3` read; unset → EVM origins only. */
  relayKey: string | undefined;
}

export function loadApiEnv(): { env: ApiEnv; secrets: ApiSecrets } {
  const env = parseEnv(apiEnvSchema);
  if (!env.CHAIN_IDS.includes(env.CHAIN_ID)) env.CHAIN_IDS.push(env.CHAIN_ID);
  return {
    env,
    secrets: {
      sessionSecret: readSecret("API_SESSION_SECRET"),
      turnstileSecret: readSecret("TURNSTILE_SECRET"),
      adminSecret: readSecret("API_ADMIN_SECRET"),
      hypersyncToken: readSecret("HYPERSYNC_API_TOKEN"),
      alchemyKey: readSecret("ALCHEMY_API_KEY"),
      auroraKey: readSecret("AURORA_API_KEY"),
      relayKey: readSecret("RELAY_API_KEY"),
    },
  };
}
