import {
  createReadClient,
  createSender,
  createWsClient,
  HeadTracker,
  isDeployed,
  MemoryJournal,
  type ReadClient,
  type Sender,
} from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import {
  type Db,
  HTTP_STATUS,
  HttpError,
  type Logger,
  loadOptionalSigner,
  type SessionKeys,
} from "@senryo/service-common";
import type { ApiEnv, ApiSecrets } from "./env.ts";
import type { IndexerBridge } from "./indexer.ts";

/** One served network: reads, commit-state heads, and the sponsor (RELAYER_ROLE) that relays starter claims. */
export interface ChainContext {
  chainId: ChainId;
  deployed: boolean;
  read: ReadClient;
  heads: HeadTracker;
  sponsor: Sender | undefined;
}

export interface ApiContext {
  env: ApiEnv;
  secrets: ApiSecrets;
  db: Db;
  log: Logger;
  chains: Map<ChainId, ChainContext>;
  sessions: SessionKeys | undefined;
  indexer: IndexerBridge;
}

export async function openChains(env: ApiEnv, log: Logger): Promise<Map<ChainId, ChainContext>> {
  const chains = new Map<ChainId, ChainContext>();
  const sponsorKey = loadOptionalSigner("SPONSOR");
  for (const chainId of env.CHAIN_IDS) {
    const rpc = chainId === env.CHAIN_ID ? { http: env.RPC_HTTP, ws: env.RPC_WS } : undefined;
    const read = createReadClient(chainId, rpc);
    const heads = new HeadTracker(read, createWsClient(chainId, rpc));
    await heads.start();
    const deployed = isDeployed(chainId, "SenryoCore");
    const sponsor = sponsorKey
      ? createSender({ chainId, account: sponsorKey, rpc, read, heads, journal: new MemoryJournal() })
      : undefined;
    chains.set(chainId, { chainId, deployed, read, heads, sponsor });
    log.info({ chainId, deployed, sponsor: sponsorKey?.address ?? null }, "chain ready");
  }
  return chains;
}

export function chainOf(ctx: ApiContext, chainId: ChainId): ChainContext {
  const chain = ctx.chains.get(chainId);
  if (!chain) throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", `chain ${chainId} is not served here`);
  if (!chain.deployed) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `not deployed on ${chainId} yet`);
  return chain;
}
