/** Counts on the stats page: `1,284` (integers from the indexer's Int counters, never money). */
const COUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatCount(n: number): string {
  return COUNT.format(n);
}
