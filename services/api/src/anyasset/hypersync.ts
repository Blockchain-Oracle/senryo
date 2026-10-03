/**
 * Token discovery and wallet movements through Envio HyperSync (plan §0.8 B1, D8): one scan per (chain, address) reads
 * every ERC-20 `Transfer` with the address on either side, its WMON wraps and its own transactions' MON value — and,
 * where the network has a traces host, the internal calls that paid it MON (hypersync-pages.ts). The tokens feed
 * holdings; the movements go to the store (`wallet_transfers`, when the api has a database) for Activity. Scans are
 * incremental per (chain, address): the next scan starts where the last one stopped, at most one per
 * HYPERSYNC_RESCAN_MS, and a long history finishes over several scans (`complete = false` until it reaches the newest
 * final block). With a store, the cursors and tokens survive a restart. The token's budget is shared (15,000 units /
 * 60 s, 1,000 per query on 2 Oct), so one scan spends at most `pagesPerScan` queries across both cursors (transfers
 * first: holdings need them), and a 429 backs every scan off until the window resets and the caller falls back.
 */
import { type Address, getAddress } from "@senryo/chain";
import { type ChainId, HYPERSYNC_TRACES_URL, HYPERSYNC_URL, WMON } from "@senryo/config";
import { MS_PER_SECOND } from "@senryo/service-common";
import {
  HYPERSYNC_BACKOFF_MS,
  HYPERSYNC_PAGES_PER_SCAN,
  HYPERSYNC_RESCAN_MS,
  HYPERSYNC_TIMEOUT_MS,
  SCAN_STATE_TTL_MS,
  SCAN_STATES_MAX,
} from "./constants.ts";
import {
  internalCallQuery,
  type Movement,
  type MovementPage,
  parseInternalPage,
  parseTransferPage,
  transferQuery,
} from "./hypersync-pages.ts";
import { fetchJson, isRateLimited, TtlCache, UpstreamError } from "./upstream.ts";

interface ScanState {
  tokens: Set<string>;
  /** First block not yet scanned for logs and transactions. */
  nextBlock: number;
  complete: boolean;
  /** First block not yet scanned for internal MON calls (only where a traces host exists). */
  traceNextBlock: number;
  tracesComplete: boolean;
  scannedAt: number;
}

export interface Discovery {
  tokens: Address[];
  complete: boolean;
  scannedToBlock: bigint;
  /** Logs, transactions and (where served) internal calls all reached the newest final block. */
  movementsComplete: boolean;
  note: string | null;
}

export interface Cursors {
  nextBlock: number;
  traceNextBlock: number;
}

/** Where a scan keeps what it read (services/api `wallet-store.ts`); without one, tokens live in memory only. */
export interface MovementStore {
  /** The address's saved cursors and the tokens of its stored movements; undefined before its first scan. */
  load(chainId: ChainId, address: string): Promise<(Cursors & { tokens: string[] }) | undefined>;
  /** A page's movements and the cursors after it, in one transaction (a cursor never runs ahead of its rows). */
  save(chainId: ChainId, address: string, movements: readonly Movement[], cursors: Cursors): Promise<void>;
}

export class HyperSyncScanner {
  private readonly states = new TtlCache<ScanState>(SCAN_STATES_MAX);
  private readonly running = new Map<string, Promise<Discovery>>();
  private backoffUntil = 0;

  constructor(
    private readonly token: string | undefined,
    /** Queries one scan may spend (checks pass 1 to stay inside the shared budget). */
    private readonly pagesPerScan: number = HYPERSYNC_PAGES_PER_SCAN,
    private readonly store?: MovementStore,
  ) {}

  get configured(): boolean {
    return this.token !== undefined;
  }

  /** Tokens `address` has touched; throws `UpstreamError` when HyperSync can't answer and nothing is cached. */
  async discover(chainId: ChainId, address: Address): Promise<Discovery> {
    const key = `${chainId}:${address.toLowerCase()}`;
    const running = this.running.get(key);
    if (running) return running;
    const work = this.scan(chainId, address, key).finally(() => this.running.delete(key));
    this.running.set(key, work);
    return work;
  }

  private async stateOf(chainId: ChainId, address: Address, key: string): Promise<ScanState> {
    const cached = this.states.peek(key)?.value;
    if (cached) return cached;
    const saved = await this.store?.load(chainId, address);
    return {
      tokens: new Set(saved?.tokens ?? []),
      nextBlock: saved?.nextBlock ?? 0,
      complete: false,
      traceNextBlock: saved?.traceNextBlock ?? 0,
      tracesComplete: HYPERSYNC_TRACES_URL[chainId] === undefined,
      scannedAt: 0,
    };
  }

  private async scan(chainId: ChainId, address: Address, key: string): Promise<Discovery> {
    const state = await this.stateOf(chainId, address, key);
    const fresh = Date.now() - state.scannedAt < HYPERSYNC_RESCAN_MS;
    if (fresh && state.complete && state.tracesComplete) return this.result(state, null);
    if (!this.token) throw new UpstreamError("hypersync", null, "no HyperSync token configured");
    if (Date.now() < this.backoffUntil) {
      if (state.scannedAt > 0) return this.result(state, "HyperSync rate-limited; showing the last scan");
      throw new UpstreamError("hypersync", null, "rate-limited (backing off)");
    }
    let note: string | null = null;
    try {
      let pages = 0;
      for (let done = false; !done && pages < this.pagesPerScan; pages += 1) {
        done = await this.transferPage(chainId, address, state);
      }
      const traces = HYPERSYNC_TRACES_URL[chainId];
      for (let done = false; traces && !done && pages < this.pagesPerScan; pages += 1) {
        done = await this.internalPage(traces, chainId, address, state);
      }
    } catch (error) {
      if (isRateLimited(error)) {
        const waitMs = error.retryAfterSec === undefined ? HYPERSYNC_BACKOFF_MS : error.retryAfterSec * MS_PER_SECOND;
        this.backoffUntil = Date.now() + waitMs;
      }
      if (state.scannedAt === 0 && state.nextBlock === 0) throw error;
      // Provider errors name the provider and status only (upstream.ts); anything else is the store's.
      note = `${error instanceof UpstreamError ? error.message : "scan store unavailable"}; showing the last scan`;
    }
    state.scannedAt = Date.now();
    this.states.set(key, state, SCAN_STATE_TTL_MS);
    if (!state.complete && note === null) note = "token scan still running";
    return this.result(state, note);
  }

  /** One logs + transactions query from `state.nextBlock`; true when it reached the newest final block. */
  private async transferPage(chainId: ChainId, address: Address, state: ScanState): Promise<boolean> {
    const json = await this.query(HYPERSYNC_URL[chainId], transferQuery(address, state.nextBlock, WMON[chainId]));
    const page = parseTransferPage(json, address, state.nextBlock, WMON[chainId]);
    await this.keep(chainId, address, page, { nextBlock: page.nextBlock, traceNextBlock: state.traceNextBlock });
    for (const token of page.tokens) state.tokens.add(token);
    state.nextBlock = page.nextBlock;
    state.complete = page.done;
    return page.done;
  }

  /** One internal-calls query from `state.traceNextBlock` on the traces host. */
  private async internalPage(url: string, chainId: ChainId, address: Address, state: ScanState): Promise<boolean> {
    const json = await this.query(url, internalCallQuery(address, state.traceNextBlock));
    const page = parseInternalPage(json, address, state.traceNextBlock);
    await this.keep(chainId, address, page, { nextBlock: state.nextBlock, traceNextBlock: page.nextBlock });
    state.traceNextBlock = page.nextBlock;
    state.tracesComplete = page.done;
    return page.done;
  }

  private async keep(chainId: ChainId, address: Address, page: MovementPage, cursors: Cursors): Promise<void> {
    await this.store?.save(chainId, address, page.movements, cursors);
  }

  private async query(url: string, body: unknown): Promise<unknown> {
    const res = await fetchJson("hypersync", `${url}/query`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}` },
      timeoutMs: HYPERSYNC_TIMEOUT_MS,
      body,
    });
    this.watchBudget(res?.headers);
    return res?.json;
  }

  /** Stop before the shared budget runs dry: no query while the window has less than one query's cost left. */
  private watchBudget(headers: Headers | undefined): void {
    const remaining = Number(headers?.get("x-ratelimit-remaining") ?? "");
    const cost = Number(headers?.get("x-ratelimit-cost") ?? "");
    const reset = Number(headers?.get("x-ratelimit-reset") ?? "");
    if (Number.isFinite(remaining) && Number.isFinite(cost) && remaining < cost && Number.isFinite(reset)) {
      this.backoffUntil = Date.now() + reset * MS_PER_SECOND;
    }
  }

  private result(state: ScanState, note: string | null): Discovery {
    return {
      tokens: [...state.tokens].map((t) => getAddress(t)),
      complete: state.complete,
      scannedToBlock: BigInt(state.nextBlock),
      movementsComplete: state.complete && state.tracesComplete,
      note,
    };
  }
}
