import { createReadClient, createWsClient, HeadTracker, isDeployed, type ReadClient } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { type Db, HTTP_STATUS, HttpError, type Logger, type SessionKeys } from "@senryo/service-common";
import type { ApiEnv, ApiSecrets } from "./env.ts";
import type { GeoDb } from "./geo-db.ts";

/**
 * One served network: reads and commit-state heads. The sponsor (relayer) and the Pyth gateway arrive with S3
 * (D-266/D-272); `deployed` turns true once the prediction-market contracts are in the address book (S2).
 */
export interface ChainContext {
  chainId: ChainId;
  deployed: boolean;
  read: ReadClient;
  heads: HeadTracker;
}

export interface ApiContext {
  env: ApiEnv;
  secrets: ApiSecrets;
  db: Db;
  log: Logger;
  chains: Map<ChainId, ChainContext>;
  sessions: SessionKeys | undefined;
  /** DB-IP Lite country lookup (S8.15); null country until loaded. */
  geo: GeoDb;
}

/** The market contracts on a network (S2); until then every network reads as not deployed. */
const MARKETS_CONTRACT = "PythBoundaryOracle";

export async function openChains(env: ApiEnv, log: Logger): Promise<Map<ChainId, ChainContext>> {
  const chains = new Map<ChainId, ChainContext>();
  for (const chainId of env.CHAIN_IDS) {
    const rpc = chainId === env.CHAIN_ID ? { http: env.RPC_HTTP, ws: env.RPC_WS } : undefined;
    const read = createReadClient(chainId, rpc);
    const heads = new HeadTracker(read, createWsClient(chainId, rpc));
    await heads.start();
    const deployed = isDeployed(chainId, MARKETS_CONTRACT);
    chains.set(chainId, { chainId, deployed, read, heads });
    log.info({ chainId, deployed }, "chain ready");
  }
  return chains;
}

export function chainOf(ctx: Pick<ApiContext, "chains">, chainId: ChainId): ChainContext {
  const chain = ctx.chains.get(chainId);
  if (!chain) throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", `chain ${chainId} is not served here`);
  if (!chain.deployed) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `not deployed on ${chainId} yet`);
  return chain;
}
