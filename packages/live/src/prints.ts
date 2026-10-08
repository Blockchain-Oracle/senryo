// Boundary prints as they stream (`print` on the `prints` topic): the K line a terminal draws is the one the chain
// records for that window. Keyed by symbol and boundary second.
type Listener = () => void;

export interface BoundaryPrint {
  symbol: string;
  t: number;
  priceE8: bigint;
  publishTime: number;
}

const KEEP = 64;

export class PrintBook {
  private readonly byKey = new Map<string, BoundaryPrint>();
  private readonly listeners = new Set<Listener>();

  add(p: BoundaryPrint): void {
    this.byKey.set(`${p.symbol}:${p.t}`, p);
    if (this.byKey.size > KEEP) {
      const oldest = this.byKey.keys().next().value;
      if (oldest !== undefined) this.byKey.delete(oldest);
    }
    for (const l of this.listeners) l();
  }

  at(symbol: string, t: number): BoundaryPrint | undefined {
    return this.byKey.get(`${symbol}:${t}`);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
