/**
 * Token discovery through Envio HyperSync (plan §0.8 B1): every ERC-20 `Transfer` with the address in topic1 (sent) or
 * topic2 (received) names a token the address has touched. Scans are incremental per (chain, address): the next scan
 * starts where the last one stopped, at most one per HYPERSYNC_RESCAN_MS, and a long history finishes over several
 * scans (`complete = false` until it reaches HyperSync's head). The token's budget is shared (15,000 units / 60 s,
 * 1,000 per query on 2 Oct), so a 429 backs every scan off until the window resets and the caller falls back.
 */
import { type Address, getAddress } from "@senryo/chain";
import { type ChainId, ERC20_TRANSFER_TOPIC, HYPERSYNC_URL } from "@senryo/config";
import { MS_PER_SECOND } from "@senryo/service-common";
import { z } from "zod";
import {
  HYPERSYNC_BACKOFF_MS,
  HYPERSYNC_PAGES_PER_SCAN,
  HYPERSYNC_RESCAN_MS,
  HYPERSYNC_TIMEOUT_MS,
  SCAN_STATE_TTL_MS,
  SCAN_STATES_MAX,
} from "./constants.ts";
import { fetchJson, isRateLimited, TtlCache, UpstreamError } from "./upstream.ts";

interface ScanState {
  tokens: Set<string>;
  /** First block not yet scanned. */
  nextBlock: number;
  complete: boolean;
  scannedAt: number;
}

export interface Discovery {
  tokens: Address[];
  complete: boolean;
  scannedToBlock: bigint;
  note: string | null;
}

const ADDRESS_HEX_CHARS = 40;
const TOPIC_PAD = 24;
const topicOf = (address: string) => `0x${"0".repeat(TOPIC_PAD)}${address.toLowerCase().slice(2)}`;
const logSchema = z.object({ address: z.string().nullish(), topic3: z.string().nullish() });
const responseSchema = z.object({
  data: z.union([z.array(z.object({ logs: z.array(logSchema).nullish() })), z.object({ logs: z.array(logSchema) })]),
  next_block: z.number(),
  archive_height: z.number().nullish(),
});

export class HyperSyncScanner {
  private readonly states = new TtlCache<ScanState>(SCAN_STATES_MAX);
  private readonly running = new Map<string, Promise<Discovery>>();
  private backoffUntil = 0;

  constructor(private readonly token: string | undefined) {}

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

  private async scan(chainId: ChainId, address: Address, key: string): Promise<Discovery> {
    const state = this.states.peek(key)?.value ?? {
      tokens: new Set<string>(),
      nextBlock: 0,
      complete: false,
      scannedAt: 0,
    };
    const fresh = Date.now() - state.scannedAt < HYPERSYNC_RESCAN_MS;
    if (fresh && state.complete) return this.result(state, null);
    if (!this.token) throw new UpstreamError("hypersync", null, "no HyperSync token configured");
    if (Date.now() < this.backoffUntil) {
      if (state.scannedAt > 0) return this.result(state, "HyperSync rate-limited; showing the last scan");
      throw new UpstreamError("hypersync", null, "rate-limited (backing off)");
    }
    let note: string | null = null;
    try {
      for (let page = 0; page < HYPERSYNC_PAGES_PER_SCAN; page += 1) {
        const done = await this.page(chainId, address, state);
        if (done) break;
      }
    } catch (error) {
      if (isRateLimited(error)) {
        const waitMs = error.retryAfterSec === undefined ? HYPERSYNC_BACKOFF_MS : error.retryAfterSec * MS_PER_SECOND;
        this.backoffUntil = Date.now() + waitMs;
      }
      if (state.scannedAt === 0 && state.nextBlock === 0) throw error;
      note = "HyperSync unavailable; showing the last scan";
    }
    state.scannedAt = Date.now();
    this.states.set(key, state, SCAN_STATE_TTL_MS);
    if (!state.complete && note === null) note = "token scan still running";
    return this.result(state, note);
  }

  /** One query from `state.nextBlock`; returns true when the scan reached HyperSync's head. */
  private async page(chainId: ChainId, address: Address, state: ScanState): Promise<boolean> {
    const topic = topicOf(address);
    const res = await fetchJson("hypersync", `${HYPERSYNC_URL[chainId]}/query`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}` },
      timeoutMs: HYPERSYNC_TIMEOUT_MS,
      body: {
        from_block: state.nextBlock,
        logs: [{ topics: [[ERC20_TRANSFER_TOPIC], [], [topic]] }, { topics: [[ERC20_TRANSFER_TOPIC], [topic]] }],
        field_selection: { log: ["address", "topic3"] },
      },
    });
    this.watchBudget(res?.headers);
    const parsed = responseSchema.parse(res?.json);
    const logs = Array.isArray(parsed.data) ? parsed.data.flatMap((b) => b.logs ?? []) : parsed.data.logs;
    for (const log of logs) {
      // ERC-721 Transfer indexes the token id as topic3; ERC-20 has none.
      if (log.topic3 || !log.address || log.address.length !== ADDRESS_HEX_CHARS + 2) continue;
      state.tokens.add(log.address.toLowerCase());
    }
    if (parsed.next_block > state.nextBlock) state.nextBlock = parsed.next_block;
    const head = parsed.archive_height ?? parsed.next_block;
    state.complete = state.nextBlock >= head;
    return state.complete;
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
      note,
    };
  }
}
