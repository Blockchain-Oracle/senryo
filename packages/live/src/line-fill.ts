/**
 * A chart's first frame from real history (04-pricing R15, F15): a terminal opened on a market whose last seconds the
 * client already holds draws them, instead of a flat line that takes the whole width to grow movement. `capacity`
 * samples `sampleMs` apart ending at `endMs`, straight between the ~1 Hz points (the live line eases across each
 * second much the same way); before the first point its value, after the last the last. Null with fewer than two
 * points in the window: the chart starts flat, as before.
 */
export function fillLine(
  times: ArrayLike<number>,
  prices: ArrayLike<number>,
  endMs: number,
  capacity: number,
  sampleMs: number,
): number[] | null {
  const startMs = endMs - (capacity - 1) * sampleMs;
  let inWindow = 0;
  for (let i = 0; i < times.length; i += 1) if ((times[i] ?? 0) >= startMs) inWindow += 1;
  if (times.length < 2 || inWindow < 2) return null;
  const out = new Array<number>(capacity);
  let j = 0;
  for (let k = 0; k < capacity; k += 1) {
    const at = startMs + k * sampleMs;
    while (j < times.length - 1 && (times[j + 1] ?? 0) <= at) j += 1;
    const t0 = times[j] ?? 0;
    const p0 = prices[j] ?? 0;
    const t1 = times[j + 1];
    const p1 = prices[j + 1];
    const v =
      at <= t0 || t1 === undefined || p1 === undefined || t1 <= t0 ? p0 : p0 + ((p1 - p0) * (at - t0)) / (t1 - t0);
    out[k] = v;
  }
  return out;
}
