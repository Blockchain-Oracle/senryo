import { baseEnvSchema, csvSchema, parseEnv, portSchema } from "@senryo/service-common";
import { z } from "zod";
import { KEEPER_PORT, KEEPER_STALE_SEC } from "./constants.ts";

/**
 * Jobs: the ticket book's sync with the chain, settlement with automatic payouts and backup fills for the markets
 * (D-264, D-278), parlays' fills and legs (D-293), duels from lock to pot (D-294), yes/no events from listing to payout
 * (D-296), the market calendars (D-289), Earn's hourly roll and deliveries (D-287), push delivery, push receipts and
 * retention.
 */
export const KEEPER_JOBS = [
  "sync",
  "settle",
  "fills",
  "parlays",
  "duels",
  "events",
  "calendars",
  "earn",
  "retention",
  "receipts",
  "pushes",
] as const;
export type KeeperJob = (typeof KEEPER_JOBS)[number];

/**
 * Secrets (`KEEPER_PK` / `KEEPER_PK_FILE`, the optional `EXPO_ACCESS_TOKEN` / `EXPO_ACCESS_TOKEN_FILE`) are read
 * separately (`loadSigner`, `expoClient`), never through this schema.
 */
export const keeperEnvSchema = baseEnvSchema.extend({
  PORT: portSchema.default(KEEPER_PORT),
  KEEPER_STALE_SEC: z.coerce.number().int().positive().default(KEEPER_STALE_SEC),
  /** Enabled jobs (default: all). */
  KEEPER_JOBS: csvSchema.transform((list) =>
    (list ?? [...KEEPER_JOBS]).filter((j): j is KeeperJob => (KEEPER_JOBS as readonly string[]).includes(j)),
  ),
  /**
   * User push delivery through Expo; `off` only records the `push_sends` row (the inbox still lists it) and logs
   * (local runs, checks).
   */
  PUSH_DELIVERY: z.enum(["on", "off"]).default("on"),
});

export type KeeperEnv = z.output<typeof keeperEnvSchema>;

export function loadKeeperEnv(): KeeperEnv {
  return parseEnv(keeperEnvSchema);
}
