/**
 * Pasted ids (R6.6): a transaction hash or a 32-byte id (`0x` + 64 hex), or a call, ride or parlay number (`1019`,
 * `#1019`, `C-10143-001019` from a slip's folio). These skip the index and ask the api's lookup, which names what
 * carries them; a hash nothing of ours carries still opens on the explorer.
 */

const HASH = /^0x[0-9a-f]{64}$/i;
const NUMBER = /^#?(\d{1,20})$/;
/** A slip's folio: N° C-<chainId>-<padded id> for a call, R- for a ride (`trade-slip.ts`). */
const FOLIO = /^(?:n°\s*)?([cr])-(\d+)-(\d+)$/i;

export type PastedId =
  | { kind: "hash"; value: string }
  | { kind: "number"; value: string; of?: "call" | "ride"; chainId?: number };

export function pastedId(query: string): PastedId | null {
  const q = query.trim();
  if (HASH.test(q)) return { kind: "hash", value: q.toLowerCase() };
  const folio = FOLIO.exec(q);
  if (folio?.[1] && folio[2] && folio[3]) {
    return {
      kind: "number",
      value: String(BigInt(folio[3])),
      of: folio[1].toLowerCase() === "c" ? "call" : "ride",
      chainId: Number(folio[2]),
    };
  }
  const n = NUMBER.exec(q);
  return n?.[1] ? { kind: "number", value: String(BigInt(n[1])) } : null;
}

const HASH_HEAD = 6;
const HASH_TAIL = 4;

/** `0x1234…cdef`: a hash short enough for a row. */
export function shortHash(hash: string): string {
  return hash.length <= HASH_HEAD + HASH_TAIL ? hash : `${hash.slice(0, HASH_HEAD)}…${hash.slice(-HASH_TAIL)}`;
}
