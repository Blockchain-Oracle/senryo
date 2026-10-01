/**
 * Arc-flag normalisation for SVG path data (Expo image docs, iOS SVG decoder note): an elliptical arc with more than one
 * parameter set and packed `large-arc-flag`/`sweep-flag` values ("a1 1 0 00-1 1", "a2 2 0 1110 10") renders distorted or
 * not at all on iOS. Every arc is rewritten as its own command with the two flags separated by spaces. Other commands
 * and every number keep their original text, so nothing else in the geometry changes.
 */

const COMMAND = /[MmZzLlHhVvCcSsQqTtAa]/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const SEPARATOR = /^[\s,]+/;
/** Parameters per repeat for each command (lower-cased). */
const ARITY: Readonly<Record<string, number>> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
/** In an arc's seven parameters, the 4th (large-arc) and 5th (sweep) are the single-character flags. */
const LARGE_ARC_SLOT = 3;
const SWEEP_SLOT = 4;
const ARC_FLAG_SLOTS = new Set([LARGE_ARC_SLOT, SWEEP_SLOT]);
/** How much of the unparsed rest an error quotes. */
const ERROR_CONTEXT_CHARS = 12;

class Reader {
  private rest: string;
  constructor(d: string) {
    this.rest = d;
  }
  skip(): void {
    this.rest = this.rest.replace(SEPARATOR, "");
  }
  done(): boolean {
    this.skip();
    return this.rest.length === 0;
  }
  peekCommand(): boolean {
    this.skip();
    return COMMAND.test(this.rest.charAt(0));
  }
  command(): string {
    this.skip();
    const c = this.rest.charAt(0);
    this.rest = this.rest.slice(1);
    return c;
  }
  flag(): string {
    this.skip();
    const c = this.rest.charAt(0);
    if (c !== "0" && c !== "1") throw new Error(`arc flag expected, got "${this.rest.slice(0, ERROR_CONTEXT_CHARS)}"`);
    this.rest = this.rest.slice(1);
    return c;
  }
  number(): string {
    this.skip();
    const m = NUMBER.exec(this.rest);
    if (!m) throw new Error(`number expected, got "${this.rest.slice(0, ERROR_CONTEXT_CHARS)}"`);
    this.rest = this.rest.slice(m[0].length);
    return m[0];
  }
}

/** Rewrites only the arcs; returns `d` unchanged when it has none. */
export function normalizeArcs(d: string): string {
  if (!/[aA]/.test(d)) return d;
  const r = new Reader(d);
  const out: string[] = [];
  while (!r.done()) {
    const cmd = r.command();
    const arity = ARITY[cmd.toLowerCase()];
    if (arity === undefined) throw new Error(`unknown path command "${cmd}"`);
    if (arity === 0) {
      out.push(cmd);
      continue;
    }
    const sets: string[][] = [];
    do {
      const set: string[] = [];
      for (let i = 0; i < arity; i += 1) {
        set.push(cmd.toLowerCase() === "a" && ARC_FLAG_SLOTS.has(i) ? r.flag() : r.number());
      }
      sets.push(set);
    } while (!r.peekCommand() && !r.done());
    if (cmd.toLowerCase() === "a") for (const set of sets) out.push(`${cmd}${set.join(" ")}`);
    else out.push(`${cmd}${sets.map((s) => s.join(" ")).join(" ")}`);
  }
  return out.join("");
}
