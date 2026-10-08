import { SUPPORT_EMAIL } from "@senryo/api-client";
import { API_ORIGIN, type ChainId, isChainId, RP_ID, WEB_ORIGIN } from "@senryo/config";
import { baseEnvSchema, csvSchema, parseEnv, portSchema, readSecret } from "@senryo/service-common";
import { z } from "zod";
import { API_PORT, COUNTRY_HEADERS, MIN_APP_VERSION } from "./constants.ts";

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
  /** Trust this edge country header (only behind that CDN; S8.5b). Unset = DB-IP on the client IP only. */
  TRUSTED_COUNTRY_HEADER: z.enum(COUNTRY_HEADERS).optional(),
  /** The contact point /v1/config publishes for reports and safety questions (App Store 1.2, S12b.6). */
  SUPPORT_EMAIL: z.email().default(SUPPORT_EMAIL),
  SUPPORT_URL: z.url().optional(),
  /** Feature flags served by /v1/config, e.g. `earn=1,games=0`. */
  FEATURES: csvSchema.transform((list) =>
    Object.fromEntries((list ?? []).map((pair) => [pair.split("=")[0] ?? pair, pair.split("=")[1] !== "0"])),
  ),
});

export type ApiEnv = z.output<typeof apiEnvSchema>;

export interface ApiSecrets {
  sessionSecret: string | undefined;
  /** Alchemy key for the services' Monad RPC (D-272: services only, clients make no RPC calls). */
  alchemyKey: string | undefined;
  /** Aurora (NEAR Intents) Studio key — incident feed, quotes and deposit addresses (S9); unset → `no_key`. */
  auroraKey: string | undefined;
}

export function loadApiEnv(): { env: ApiEnv; secrets: ApiSecrets } {
  const env = parseEnv(apiEnvSchema);
  if (!env.CHAIN_IDS.includes(env.CHAIN_ID)) env.CHAIN_IDS.push(env.CHAIN_ID);
  return {
    env,
    secrets: {
      sessionSecret: readSecret("API_SESSION_SECRET"),
      alchemyKey: readSecret("ALCHEMY_API_KEY"),
      auroraKey: readSecret("AURORA_API_KEY"),
    },
  };
}
