import type { BinaryApiSnapshot, BinaryHistory } from "@senryo/api-client";
import {
  assertBinaryManifest,
  type BinarySnapshot,
  decodeRevert,
  type ReadClient,
  readBinaryQuote,
  readBinaryRound,
  readBinaryScheduledRounds,
  verifyBinarySource,
} from "@senryo/chain";
import {
  BINARY_POLICY,
  BINARY_PUBLIC_DEPLOYMENTS,
  BINARY_STATE,
  type BinaryEnvironment,
  type BinaryManifest,
} from "@senryo/config";
import { HTTP_STATUS, HttpError } from "@senryo/service-common";

/** Canonical history owner plugs in here in 4C1b. No history result can authorize a trade.
 * A page must include complete-account basis rebuilt from the entire canonical history, not just its page.
 * The reader owns cursor/source binding and rollback; API verifies its source and indexed block on chain.
 */
export interface BinaryHistoryReader {
  read(input: { manifest: BinaryManifest; owner: `0x${string}`; cursor?: string }): Promise<{
    owner: string;
    environmentId: string;
    chainId: number;
    contract: string;
    configHash: string;
    fromBlock: bigint;
    page: Extract<BinaryHistory, { status: "fresh" | "lagging" }>;
  } | null>;
}
interface Source {
  manifest: BinaryManifest;
  environment: BinaryEnvironment;
  read: ReadClient;
}
export const BINARY_API_MAX_BLOCK_AGE_SECONDS = 15n;
export const BINARY_HISTORY_MAX_BLOCK_LAG = 10n;
export const BINARY_HISTORY_MAX_AGE_SECONDS = 30n;
const MS_PER_SECOND = 1000;
const MAX_FUTURE_SECONDS = 5n;
const unavailable = () =>
  new HttpError(HTTP_STATUS.unavailable, "UPSTREAM_UNAVAILABLE", "Binary source is unavailable");
const inactive = () => new HttpError(HTTP_STATUS.notFound, "NOT_DEPLOYED", "Binary deployment is not active");
const unknownHistory = (reason: "not-configured" | "unavailable" | "noncanonical" | "incomplete"): BinaryHistory => ({
  status: "unavailable",
  reason,
  events: null,
  accounting: null,
  indexedBlock: null,
  nextCursor: null,
});
function evidence(m: BinaryManifest, block: { blockNumber: bigint; blockHash: `0x${string}`; timestamp: bigint }) {
  return {
    chainId: m.chainId,
    environmentId: m.environmentId,
    contract: m.contract,
    configHash: m.configHash,
    ...block,
  };
}
function snapshot(s: BinarySnapshot): BinaryApiSnapshot {
  return {
    source: evidence(s.manifest, { blockNumber: s.blockNumber, blockHash: s.blockHash, timestamp: s.timestamp }),
    roundId: s.roundId,
    owner: s.owner,
    round: { ...s.round, duration: s.round.duration as 300 | 900 },
    position: s.position,
    creditWei: s.creditWei,
    walletMonWei: s.walletMonWei,
    riskPaused: s.riskPaused,
  };
}

/** Fixed sources constructed by trusted composition, never selected from caller-provided RPC/config/flags. */
export class BinaryPredictions {
  private readonly sources: readonly Source[];
  constructor(
    sources: readonly Source[],
    private readonly historyReader: BinaryHistoryReader | undefined,
    private readonly now: () => bigint,
  ) {
    this.sources = Object.freeze(
      sources.map((s) => {
        const manifest = Object.freeze({ ...s.manifest }),
          environment = Object.freeze({ ...s.environment });
        assertBinaryManifest(manifest, environment);
        return Object.freeze({ ...s, manifest, environment });
      }),
    );
  }
  private source(chainId: string, contract: string): Source {
    if (chainId !== String(BINARY_POLICY.chainId)) throw inactive();
    const source = this.sources.find((s) => s.manifest.contract.toLowerCase() === contract.toLowerCase());
    if (!source) throw inactive();
    assertBinaryManifest(source.manifest, source.environment);
    return source;
  }
  private async canonical(s: Source, block: { blockNumber: bigint; blockHash: string; timestamp: bigint }) {
    const now = this.now();
    if (now - block.timestamp > BINARY_API_MAX_BLOCK_AGE_SECONDS || block.timestamp - now > MAX_FUTURE_SECONDS)
      throw unavailable();
    const canonical = await s.read.getBlock({ blockNumber: block.blockNumber });
    if (canonical.hash.toLowerCase() !== block.blockHash.toLowerCase()) throw unavailable();
  }
  private async direct<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof Error && error.message === "binary: missing round")
        throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "Binary round does not exist");
      if (error instanceof Error && error.message === "binary: insufficient shares")
        throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "Insufficient directly read shares");
      // RPC URLs, transport details and configuration are never reflected to the caller.
      throw unavailable();
    }
  }
  async list(chainId: string, asset: "BTC" | "ETH", duration: 300 | 900) {
    if (chainId !== String(BINARY_POLICY.chainId)) throw inactive();
    return this.direct(async () => {
      const groups = await Promise.all(
        this.sources.map(async (s) => {
          const result = await readBinaryScheduledRounds(s.read, s.manifest, s.environment, asset, duration);
          await this.canonical(s, result.source);
          return { source: evidence(s.manifest, result.source), rounds: result.rounds.map(snapshot) };
        }),
      );
      return {
        status: this.sources.length ? ("available" as const) : ("inactive" as const),
        sources: groups.map((g) => g.source),
        rounds: groups.flatMap((g) => g.rounds),
      };
    });
  }
  async round(chainId: string, contract: string, roundId: `0x${string}`, owner?: `0x${string}`) {
    const s = this.source(chainId, contract);
    return this.direct(async () => {
      const result = await readBinaryRound(
        s.read,
        s.manifest,
        s.environment,
        roundId,
        owner ?? s.manifest.liquidityBeneficiary,
      );
      await this.canonical(s, result);
      return snapshot(result);
    });
  }
  async quote(
    chainId: string,
    contract: string,
    roundId: `0x${string}`,
    owner: `0x${string}`,
    side: "up" | "down",
    action: "buy" | "sell",
    amount: bigint,
  ) {
    const s = this.source(chainId, contract);
    return this.direct(async () => {
      const state = await readBinaryRound(s.read, s.manifest, s.environment, roundId, owner);
      await this.canonical(s, state);
      if (
        state.round.state !== BINARY_STATE.Open ||
        state.timestamp >= state.round.cutoff ||
        (action === "buy" && state.riskPaused)
      )
        throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "This binary round is not accepting this trade");
      if (
        action === "buy" &&
        (amount < BINARY_POLICY.buyMinWei ||
          amount > BINARY_POLICY.buyMaxWei ||
          state.round.escrow + amount > BINARY_POLICY.supplyCapWei)
      )
        throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "Input exceeds binary purchase bounds");
      const result = await readBinaryQuote(s.read, state, side === "up", action, amount).catch(
        async (error: unknown) => {
          // Only a decoded revert from this verified, pinned quote call is an economic rejection.
          // Reorg/staleness still takes precedence over an input classification.
          await this.canonical(s, state);
          if (decodeRevert(error)?.name === "Invalid")
            throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "Input cannot produce a valid binary quote");
          throw error;
        },
      );
      await this.canonical(s, state);
      return { snapshot: snapshot(state), side, action, quote: result.quote };
    });
  }
  async history(chainId: string, contract: string, owner: `0x${string}`, cursor?: string) {
    const s = this.source(chainId, contract);
    return this.direct(async () => {
      const block = await verifyBinarySource(s.read, s.manifest, s.environment);
      await this.canonical(s, block);
      let history: BinaryHistory = unknownHistory("not-configured");
      if (this.historyReader) {
        try {
          const result = await this.historyReader.read({ manifest: s.manifest, owner, ...(cursor ? { cursor } : {}) });
          if (!result) history = unknownHistory("unavailable");
          else if (result.fromBlock > s.manifest.anchorBlock || result.fromBlock < 0n)
            history = unknownHistory("incomplete");
          else if (
            result.owner.toLowerCase() !== owner.toLowerCase() ||
            result.environmentId !== s.manifest.environmentId ||
            result.chainId !== s.manifest.chainId ||
            result.contract.toLowerCase() !== s.manifest.contract.toLowerCase() ||
            result.configHash.toLowerCase() !== s.manifest.configHash.toLowerCase() ||
            result.page.indexedBlock > block.blockNumber ||
            result.page.indexedBlock < s.manifest.anchorBlock
          )
            history = unknownHistory("noncanonical");
          else {
            const indexed = await s.read.getBlock({ blockNumber: result.page.indexedBlock });
            if (indexed.hash.toLowerCase() !== result.page.indexedBlockHash.toLowerCase())
              history = unknownHistory("noncanonical");
            else {
              const blockLag = block.blockNumber - result.page.indexedBlock;
              history = {
                ...result.page,
                blockLag,
                status:
                  blockLag <= BINARY_HISTORY_MAX_BLOCK_LAG &&
                  block.timestamp - indexed.timestamp <= BINARY_HISTORY_MAX_AGE_SECONDS
                    ? "fresh"
                    : "lagging",
              };
            }
          }
        } catch {
          history = unknownHistory("unavailable");
        }
      }
      // History I/O can overlap a reorg or stall: recheck the original direct evidence before returning.
      await this.canonical(s, block);
      return { source: evidence(s.manifest, block), history };
    });
  }
}

/** Public runtime: only reviewed public registry entries; fixture flags cannot enter through HTTP or env. */
export function createBinaryPredictions(
  chains: ReadonlyMap<number, { read: ReadClient }>,
  history?: BinaryHistoryReader,
) {
  return new BinaryPredictions(
    BINARY_PUBLIC_DEPLOYMENTS.map((manifest) => {
      const chain = chains.get(manifest.chainId);
      if (!chain) throw new Error("binary: approved deployment chain unavailable");
      return {
        manifest,
        read: chain.read,
        environment: {
          environmentId: manifest.environmentId,
          consumer: "public-api" as const,
          development: false,
          devWorkspace: false,
        },
      };
    }),
    history,
    () => BigInt(Math.floor(Date.now() / MS_PER_SECOND)),
  );
}
