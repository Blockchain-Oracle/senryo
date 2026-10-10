import { addressOf, type Hex, type ReadClient, seriesIdOf } from "@senryo/chain";
import { type ChainId, type MarketSpec, marketsOn } from "@senryo/config";
import { windowsAbi } from "@senryo/contracts/abis";
import type { Logger } from "@senryo/service-common";
import { LISTING_REFRESH_MS } from "./constants.ts";

/**
 * Which catalogue series a network's `Windows` has registered (R1.24). The catalogue in code runs ahead of the chain
 * between deploys (34 markets in code, BTC/ETH/SOL on testnet until R4): a market none of whose series is on chain shows
 * its live price and takes no calls — the relay refuses it up front, where it used to answer "received" and fail in
 * simulation. Read on start and every 10 minutes, so a contracts deploy opens its markets with no api release. Until
 * the first read succeeds every series counts as listed (the relay's simulation still guards).
 */
export interface ListingStatus {
  readAt: string | null;
  listed: number;
  total: number;
  lastError: string | null;
}

export class SeriesListing {
  private listedIds: Set<Hex> | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly status: ListingStatus = { readAt: null, listed: 0, total: 0, lastError: null };

  constructor(
    private readonly chainId: ChainId,
    private readonly read: ReadClient,
    private readonly log: Logger,
  ) {}

  /** Reads once (a failure is logged, not thrown), then keeps reading. */
  async start(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), LISTING_REFRESH_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  listed(seriesId: Hex): boolean {
    return this.listedIds === null || this.listedIds.has(seriesId);
  }

  /** A market takes calls once any of its series is on chain. */
  marketListed(m: MarketSpec): boolean {
    return m.cadences.some((c) => this.listed(seriesIdOf(m.symbol, c)));
  }

  snapshot(): ListingStatus {
    return { ...this.status };
  }

  private async refresh(): Promise<void> {
    const ids = marketsOn(this.chainId).flatMap((m) => m.cadences.map((c) => seriesIdOf(m.symbol, c)));
    try {
      const address = addressOf(this.chainId, "Windows");
      const reads = await this.read.multicall({
        allowFailure: true,
        contracts: ids.map((id) => ({ address, abi: windowsAbi, functionName: "seriesOf", args: [id] }) as const),
      });
      // An unregistered series reads as zeros (`cadenceSec` 0); a failed read is not taken as either.
      const failed = reads.filter((r) => r.status !== "success").length;
      if (failed > 0) throw new Error(`${failed} of ${ids.length} series reads failed`);
      const listed = new Set(ids.filter((_id, i) => reads[i]?.status === "success" && reads[i].result.cadenceSec > 0));
      const changed = this.listedIds === null || listed.size !== this.listedIds.size;
      this.listedIds = listed;
      Object.assign(this.status, {
        readAt: new Date().toISOString(),
        listed: listed.size,
        total: ids.length,
        lastError: null,
      });
      if (changed) this.log.info({ chainId: this.chainId, listed: listed.size, total: ids.length }, "series listing");
    } catch (error) {
      this.status.lastError = (error as Error).message;
      this.log.warn({ chainId: this.chainId, err: this.status.lastError }, "series listing read failed");
    }
  }
}
