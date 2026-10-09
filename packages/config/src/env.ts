import * as z from "zod";
import { API_ORIGIN, INDEXER_ORIGIN } from "./hosts.ts";

/**
 * Client-side public env (EXPO_PUBLIC_* / NEXT_PUBLIC_* — never secrets; invariant `public-env-hygiene`).
 * Each app maps its prefixed variables onto these names; unset values fall back to the production hosts, so a build
 * with no env talks to production. Service env schemas live with each service (S3), not here.
 */
export const publicEnvSchema = z.object({
  API_ORIGIN: z.url().default(API_ORIGIN),
  INDEXER_ORIGIN: z.url().default(INDEXER_ORIGIN),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Throws a readable error naming the bad variable — fail at startup, never mid-flow. */
export function parsePublicEnv(raw: Partial<Record<keyof PublicEnv, string | undefined>>): PublicEnv {
  return publicEnvSchema.parse(raw);
}
