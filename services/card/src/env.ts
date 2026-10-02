import { baseEnvSchema, parseEnv, portSchema, readSecret } from "@senryo/service-common";
import { z } from "zod";
import {
  CARD_PORT,
  DEFAULT_ISSUER_LABEL,
  FX_BUFFER_BPS,
  INTERNAL_DEADLINE_MS,
  LITHIC_SANDBOX_API,
  TIP_BUFFER_BPS,
  WEBHOOK_TOLERANCE_S,
} from "./constants.ts";

export const cardEnvSchema = baseEnvSchema.extend({
  PORT: portSchema.default(CARD_PORT),
  INTERNAL_DEADLINE_MS: z.coerce.number().int().positive().default(INTERNAL_DEADLINE_MS),
  WEBHOOK_TOLERANCE_S: z.coerce.number().int().positive().default(WEBHOOK_TOLERANCE_S),
  FX_BUFFER_BPS: z.coerce.number().int().nonnegative().default(FX_BUFFER_BPS),
  TIP_BUFFER_BPS: z.coerce.number().int().nonnegative().default(TIP_BUFFER_BPS),
  CARD_ISSUER_LABEL: z.string().min(1).default(DEFAULT_ISSUER_LABEL),
  /** Mainnet Lithic sandbox = release-only (D-036): the contract releases on capture; refunds are skipped. */
  CARD_RELEASE_ONLY: z.stringbool().default(false),
  /** Sandbox API for card/simulate and freeze (D-042); simulate is refused when this is not the sandbox. */
  LITHIC_API_BASE: z.url().default(LITHIC_SANDBOX_API),
  /**
   * Card program (BIN range) for issued cards; empty → the program's default. Sandbox test programs:
   * 00000000-0000-0000-1000-000000000000 and 00000000-0000-0000-2000-000000000000.
   */
  // z.guid, not z.uuid: the sandbox program tokens are not RFC 4122 v1–v8 UUIDs.
  LITHIC_CARD_PROGRAM_TOKEN: z
    .guid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type CardEnv = z.output<typeof cardEnvSchema>;

/** Secrets are read by name only (never through the schema, never logged). */
export interface CardSecrets {
  asaSecret: string | undefined;
  webhookSecret: string | undefined;
  apiKey: string | undefined;
  sessionSecret: string | undefined;
}

export function loadCardEnv(): { env: CardEnv; secrets: CardSecrets } {
  return {
    env: parseEnv(cardEnvSchema),
    secrets: {
      asaSecret: readSecret("LITHIC_ASA_SECRET"),
      webhookSecret: readSecret("LITHIC_WEBHOOK_SECRET"),
      apiKey: readSecret("LITHIC_API_KEY"),
      sessionSecret: readSecret("API_SESSION_SECRET"),
    },
  };
}
