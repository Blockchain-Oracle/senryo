// σ marks as they stream (`sigma` on the `prints` topic, R4.3): each market's fast mark and slow anchor through each
// minute boundary — the values a fill carries, so a quote prices with the same σ the reserve will. Keyed by symbol and
// minute; a few minutes kept (a fill uses the last boundary at least 5 s before it).
type Listener = () => void;

export interface SigmaMarkPoint {
  minute: number;
  fastE8: bigint;
  slowE8: bigint;
}

/** One minute's marks, `[symbol, fastE8, slowE8]` (decimal strings on the stream, bigints from the route). */
export interface SigmaFrame {
  minute: number;
  marks: readonly (readonly [string, bigint | string, bigint | string])[];
}

const KEEP_MINUTES = 3;

export class SigmaBook {
  private readonly bySymbol = new Map<string, SigmaMarkPoint[]>();
  private readonly listeners = new Set<Listener>();

  add(frame: SigmaFrame): void {
    for (const [symbol, fast, slow] of frame.marks) {
      const list = (this.bySymbol.get(symbol) ?? []).filter((p) => p.minute !== frame.minute);
      list.push({ minute: frame.minute, fastE8: BigInt(fast), slowE8: BigInt(slow) });
      list.sort((a, b) => a.minute - b.minute);
      this.bySymbol.set(symbol, list.slice(-KEEP_MINUTES));
    }
    for (const l of this.listeners) l();
  }

  /** `symbol`'s mark for `minute`, or its newest before it while that minute's is on its way. */
  at(symbol: string, minute: number): SigmaMarkPoint | undefined {
    const list = this.bySymbol.get(symbol) ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (p && p.minute <= minute) return p;
    }
    return undefined;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
