import { MAX_FEE_BASE_MULTIPLIER_BPS, MIN_BASE_FEE_WEI, PRIORITY_FEE_WEI } from "@senryo/config";
import type { ReadClient } from "./clients.ts";
import { BPS, FEE_REFRESH_MS } from "./constants.ts";

export interface FeeQuote {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  baseFeePerGas: bigint;
  at: number;
}

/**
 * EIP-1559 fees from the latest base fee, cached for FEE_REFRESH_MS so a hot path (card authorisations) pays no extra
 * round trip. Monad's priority fee is a hard-coded 2 gwei; `maxFeePerGas` = 2 × base + priority (the charge is
 * gas LIMIT × effective price, so the cap only matters if the base fee really rises).
 */
export class FeeCache {
  private quote: FeeQuote | undefined;
  private inflight: Promise<FeeQuote> | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly read: ReadClient,
    private readonly refreshMs: number = FEE_REFRESH_MS,
    /** `maxFeePerGas` = base × this (bps) + priority; user sends pass USER_MAX_FEE_BASE_MULTIPLIER_BPS (D-171). */
    private readonly multiplierBps: bigint = MAX_FEE_BASE_MULTIPLIER_BPS,
  ) {}

  /** Background refresh (services); clients just call `get()`. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.refresh().catch(() => undefined);
    }, this.refreshMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async get(): Promise<FeeQuote> {
    if (this.quote && Date.now() - this.quote.at < this.refreshMs) return this.quote;
    return this.refresh();
  }

  refresh(): Promise<FeeQuote> {
    this.inflight ??= this.fetch().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private async fetch(): Promise<FeeQuote> {
    const block = await this.read.getBlock({ blockTag: "latest" });
    // Monad's base fee never goes below its 100 gwei floor; a node reporting less (or none, or a local fork decaying
    // it on empty blocks) is quoted at the floor so the signed max fee always clears a real block (D-171).
    const reported = block.baseFeePerGas ?? MIN_BASE_FEE_WEI;
    const base = reported > MIN_BASE_FEE_WEI ? reported : MIN_BASE_FEE_WEI;
    const quote: FeeQuote = {
      baseFeePerGas: base,
      maxPriorityFeePerGas: PRIORITY_FEE_WEI,
      maxFeePerGas: (base * this.multiplierBps) / BPS + PRIORITY_FEE_WEI,
      at: Date.now(),
    };
    this.quote = quote;
    return quote;
  }
}
