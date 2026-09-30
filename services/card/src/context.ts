import { type Address, type Hex, keccak256, type ReadClient, type Sender, stringToBytes } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Db, Logger, SessionKeys } from "@senryo/service-common";
import type { CardEnv, CardSecrets } from "./env.ts";
import type { LithicApi } from "./lithic/api.ts";

export interface CardContext {
  env: CardEnv;
  secrets: CardSecrets;
  chainId: ChainId;
  read: ReadClient;
  db: Db;
  log: Logger;
  /** One sender per operator key (CARD_OPERATOR_ROLE), sharing the read client, fee cache and head tracker. */
  operators: readonly Sender[];
  /** `bytes32` issuer = keccak256(CARD_ISSUER_LABEL). */
  issuer: Hex;
  lithic: LithicApi | undefined;
  sessions: SessionKeys | undefined;
}

/** Operator shard for an account: `hash(account) mod K` (specs/services.md §card 4) — per-account ordering. */
export function operatorFor(ctx: CardContext, account: Address): Sender {
  const digest = BigInt(keccak256(stringToBytes(account.toLowerCase())));
  const index = Number(digest % BigInt(ctx.operators.length));
  const operator = ctx.operators[index];
  if (!operator) throw new Error("no card operator configured");
  return operator;
}
