/**
 * `/v1/activity/wallet` (B12, D8): an address's wallet movements as Activity items. Each call first lets the HyperSync
 * scan catch up (the same scan, budget and rescan pace as holdings — a fresh scan costs nothing), then reads a page of
 * stored movements and folds them per transaction (wallet-fold.ts). A scan that can't run (rate-limited, no token)
 * never hides what is stored: the page is served with the reason in `scan.note`. Tokens are named like holdings:
 * verified = on the token list by address; anything else is read onchain and marked unverified (and `lookalike` when
 * it copies a verified symbol).
 */
import type { WalletActivity, WalletActivityItem, WalletToken } from "@senryo/api-client";
import { type Address, addressOf, type ContractName, getAddress, isDeployed, type ReadClient } from "@senryo/chain";
import { type ChainId, NATIVE_TOKEN, networkOf, PERPL_EXCHANGE } from "@senryo/config";
import type { Logger } from "@senryo/service-common";
import type { HyperSyncScanner } from "./hypersync.ts";
import type { TokenListService } from "./token-list.ts";
import type { TokenMetadataCache } from "./token-meta.ts";
import { errorText } from "./upstream.ts";
import { type FoldedTx, foldMovements } from "./wallet-fold.ts";
import type { TxPosition, WalletTransferStore } from "./wallet-store.ts";

/** Senryo's own contracts: a movement with one of them is the indexer's (or the journal's) story. */
const SENRYO_CONTRACTS: readonly ContractName[] = [
  "SenryoCore",
  "LpVault",
  "StarterDrip",
  "IntentRouter",
  "InboxFactory",
  "CollateralSwapper",
];

export interface WalletActivityDeps {
  log: Logger;
  read: (chainId: ChainId) => ReadClient;
  store: WalletTransferStore;
  scanner: HyperSyncScanner;
  tokenList: TokenListService;
  metadata: TokenMetadataCache;
}

export function senryoContracts(chainId: ChainId): Set<string> {
  const own = SENRYO_CONTRACTS.filter((name) => isDeployed(chainId, name)).map((name) => addressOf(chainId, name));
  return new Set([...own, PERPL_EXCHANGE[chainId]].map((a) => a.toLowerCase()));
}

const cursorOf = (p: TxPosition): string => `${p.blockNumber}:${p.txIndex}`;
function positionOf(cursor: string | undefined): TxPosition | undefined {
  const [block, index] = cursor?.split(":") ?? [];
  return block && index ? { blockNumber: BigInt(block), txIndex: Number.parseInt(index, 10) } : undefined;
}

export class WalletActivityService {
  private readonly senryo = new Map<ChainId, Set<string>>();

  constructor(private readonly deps: WalletActivityDeps) {}

  async page(chainId: ChainId, owner: Address, before: string | undefined, limit: number): Promise<WalletActivity> {
    const { scan, settledBelow } = await this.catchUp(chainId, owner);
    const stored = await this.deps.store.page(chainId, owner, positionOf(before), limit, settledBelow);
    const tokens = await this.tokensOf(
      chainId,
      stored.movements.map((m) => m.token),
    );
    let senryo = this.senryo.get(chainId);
    if (!senryo) {
      senryo = senryoContracts(chainId);
      this.senryo.set(chainId, senryo);
    }
    const folded = foldMovements(owner, stored.movements, {
      verified: (token) => tokens.get(token)?.verified,
      senryo,
    });
    return {
      chainId,
      address: getAddress(owner),
      items: folded.map((tx) => this.itemOf(tx, tokens)),
      next: stored.full && stored.last ? cursorOf(stored.last) : null,
      scan,
    };
  }

  /** Runs (or joins) the address's scan; its failure becomes a note, never an error. */
  private async catchUp(
    chainId: ChainId,
    owner: Address,
  ): Promise<{ scan: WalletActivity["scan"]; settledBelow: bigint | undefined }> {
    const { scanner, log } = this.deps;
    if (!scanner.configured) {
      return {
        scan: { complete: false, scannedToBlock: null, note: "HyperSync token not configured" },
        settledBelow: undefined,
      };
    }
    try {
      const d = await scanner.discover(chainId, owner);
      const note = d.note ?? (d.movementsComplete ? null : "history scan still running");
      return {
        scan: { complete: d.movementsComplete, scannedToBlock: d.scannedToBlock, note },
        settledBelow: d.settledBelow ?? undefined,
      };
    } catch (error) {
      log.warn({ chainId, err: errorText(error) }, "wallet activity: scan failed");
      return {
        scan: { complete: false, scannedToBlock: null, note: `HyperSync: ${errorText(error)}` },
        settledBelow: undefined,
      };
    }
  }

  /** Every token of the page named: native MON, listed (verified) tokens, and unlisted ones read onchain. */
  private async tokensOf(chainId: ChainId, addresses: readonly string[]): Promise<Map<string, WalletToken>> {
    const list = await this.deps.tokenList.get(chainId);
    const out = new Map<string, WalletToken>();
    const unlisted: Address[] = [];
    for (const token of new Set(addresses)) {
      if (token === NATIVE_TOKEN) {
        const { symbol, decimals } = networkOf(chainId).nativeCurrency;
        const logoUrl = list.byAddress.get(NATIVE_TOKEN)?.logoURI ?? null;
        out.set(token, {
          ...plain(token, symbol, decimals, true),
          native: true,
          mark: `native:${chainId}:${symbol}`,
          logoUrl,
        });
        continue;
      }
      const listed = list.byAddress.get(token);
      if (listed) {
        out.set(token, {
          ...plain(token, listed.symbol, listed.decimals, true),
          mark: `token:${chainId}:${token}`,
          logoUrl: listed.logoURI,
        });
      } else unlisted.push(getAddress(token));
    }
    if (unlisted.length > 0) {
      const metas = await this.deps.metadata.of(this.deps.read(chainId), chainId, unlisted);
      for (const [token, meta] of metas) {
        if (!meta) continue;
        out.set(token, {
          ...plain(token, meta.symbol, meta.decimals, false),
          lookalike: list.symbols.has(meta.symbol.toLowerCase()),
          mark: `token:${chainId}:${token}`,
          logoUrl: null,
        });
      }
    }
    return out;
  }

  private itemOf(tx: FoldedTx, tokens: ReadonlyMap<string, WalletToken>): WalletActivityItem {
    return {
      txHash: tx.txHash as `0x${string}`,
      blockNumber: tx.blockNumber,
      timestamp: tx.timestamp,
      kind: tx.kind,
      legs: tx.legs.flatMap((leg) => {
        const token = tokens.get(leg.token);
        if (!token) return [];
        const counterparty = leg.counterparty ? getAddress(leg.counterparty) : null;
        return [{ direction: leg.direction, token, amount: leg.amount, counterparty }];
      }),
      sender: tx.sender ? getAddress(tx.sender) : null,
      internal: tx.internal,
      spam: tx.spam,
    };
  }
}

function plain(token: string, symbol: string, decimals: number, verified: boolean): WalletToken {
  return {
    address: getAddress(token),
    native: false,
    symbol,
    decimals,
    verified,
    lookalike: false,
    mark: "",
    logoUrl: null,
  };
}
