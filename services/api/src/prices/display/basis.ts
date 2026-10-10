/**
 * Display − settlement, per market (D-302): the exchange line is shifted onto the settlement price, so it moves like the
 * exchanges but sits where Pyth (or RedStone) does — Bitfinex's BTC printed ~$100 over Pyth on 10 Oct 2026. A sample is
 * taken at each settlement update while the market's display tick is fresh; the basis is the median of the last
 * `BASIS_SAMPLES`, so one fast move can't drag it. No line is published before `BASIS_MIN_SAMPLES`, so it never jumps
 * into place.
 */
export const BASIS_SAMPLES = 30;
export const BASIS_MIN_SAMPLES = 3;

export class Basis {
  private readonly samples = new Map<string, bigint[]>();
  private readonly medians = new Map<string, bigint>();

  sample(symbol: string, displayE8: bigint, settlementE8: bigint): void {
    const list = this.samples.get(symbol) ?? [];
    list.push(displayE8 - settlementE8);
    if (list.length > BASIS_SAMPLES) list.shift();
    this.samples.set(symbol, list);
    const sorted = [...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    this.medians.set(symbol, sorted[Math.floor(sorted.length / 2)] ?? 0n);
  }

  ready(symbol: string): boolean {
    return (this.samples.get(symbol)?.length ?? 0) >= BASIS_MIN_SAMPLES;
  }

  /** The display price on the settlement price's footing. */
  adjust(symbol: string, displayE8: bigint): bigint {
    return displayE8 - (this.medians.get(symbol) ?? 0n);
  }

  /** For `/status`: each market's basis in e-8. */
  snapshot(): Record<string, string> {
    return Object.fromEntries([...this.medians].map(([s, b]) => [s, b.toString()]));
  }
}
