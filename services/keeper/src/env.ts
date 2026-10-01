import { baseEnvSchema, csvSchema, parseEnv, portSchema } from "@senryo/service-common";
import { z } from "zod";
import {
  INTERVALS_MS,
  KEEPER_PORT,
  KEEPER_STALE_SEC,
  MIRROR_DEVIATION_BPS,
  MIRROR_HEARTBEAT_SEC,
  WALLET_FLOOR_WEI,
} from "./constants.ts";

export const KEEPER_JOBS = [
  "liquidate",
  "observe",
  "mirror",
  "triggers",
  "holds",
  "alerts",
  "wallets",
  "retention",
] as const;
export type KeeperJob = (typeof KEEPER_JOBS)[number];

const bigintEnv = (fallback: bigint) =>
  z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform((text) => (text === undefined ? fallback : BigInt(text)));

/** Secrets (`KEEPER_PK` / `KEEPER_PK_FILE`) are read separately by `loadSigner`, never through this schema. */
export const keeperEnvSchema = baseEnvSchema.extend({
  PORT: portSchema.default(KEEPER_PORT),
  KEEPER_STALE_SEC: z.coerce.number().int().positive().default(KEEPER_STALE_SEC),
  /** Enabled jobs (default: everything except the mirror relay, which needs MIRROR_ROLE). Gas top-ups live in the api (D-171). */
  KEEPER_JOBS: csvSchema.transform((list) =>
    (list ?? ["liquidate", "observe", "triggers", "holds", "alerts", "wallets", "retention"]).filter(
      (j): j is KeeperJob => (KEEPER_JOBS as readonly string[]).includes(j),
    ),
  ),
  /** Extra accounts to scan for liquidation until the indexer source is live (S4). */
  KEEPER_WATCH_ACCOUNTS: csvSchema,
  /** Envio GraphQL endpoint (S4); unset → accounts come from the ledger + watch list only. */
  INDEXER_GRAPHQL_URL: z.url().optional(),
  /** Mainnet RPC(s) for Chainlink reads (mirror relay source). */
  SOURCE_RPC_HTTP: csvSchema,
  MIRROR_MARKETS: csvSchema.transform((list) => list ?? ["XAU"]),
  MIRROR_DEVIATION_BPS: z.coerce.number().int().positive().default(MIRROR_DEVIATION_BPS),
  MIRROR_HEARTBEAT_SEC: z.coerce.number().int().positive().default(MIRROR_HEARTBEAT_SEC),
  WALLET_FLOOR_WEI: bigintEnv(WALLET_FLOOR_WEI),
  OPS_WATCH_WALLETS: csvSchema,
  LIQUIDATE_MS: z.coerce.number().int().positive().default(INTERVALS_MS.liquidate),
  OBSERVE_MS: z.coerce.number().int().positive().default(INTERVALS_MS.observe),
  MIRROR_MS: z.coerce.number().int().positive().default(INTERVALS_MS.mirror),
});

export type KeeperEnv = z.output<typeof keeperEnvSchema>;

export function loadKeeperEnv(): KeeperEnv {
  return parseEnv(keeperEnvSchema);
}
