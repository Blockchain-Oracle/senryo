import type { Hex } from "@senryo/chain";

/**
 * RedStone's signed packages (D-284), pure: parsing the gateway's answer, the verifier's median, and the wire payload
 * `RedStonePrintVerifier` checks. Shared by the api and the parse worker (`redstone-parse.worker.ts`), so it imports
 * nothing that starts a service.
 */
export interface Package {
  ts: number;
  value: bigint;
  signature: Uint8Array;
  feed: string;
}

/** What the parse worker is sent (the bytes are transferred, not copied) and answers. */
export interface ParseRequest {
  id: number;
  bytes: ArrayBuffer;
  wanted: string[];
}

export type ParseReply =
  | { id: number; ok: true; packages: [string, Package[]][] }
  | { id: number; ok: false; name: string; message: string };

const E8_DECIMALS = 8;
const DECIMAL = /^(\d+)(?:\.(\d+))?$/;
const VALUE_BYTES = 32;
/** Every package carries one 32-byte value (`RedStonePayload`). */
const VALUE_SIZE = 32n;
const DECIMAL_BASE = 10n;
const TS_BYTES = 6;
const SIZE_BYTES = 4;
const COUNT_BYTES = 3;
const FEED_BYTES = 32;
const N_BYTES = 2;
const META_BYTES = 3;
const MARKER = "000002ed57011e0000";
const HEX = 16;
const HALF = 2n;
const JSON_CONTENT_TYPE = "application/json";
const OPEN_BRACE = "{".charCodeAt(0);
/** JSON's insignificant whitespace: space, tab, line feed, carriage return. */
const JSON_WHITESPACE = new Set([..." \t\n\r"].map((c) => c.charCodeAt(0)));

const hexOf = (n: bigint, bytes: number) => n.toString(HEX).padStart(bytes * 2, "0");

/**
 * The gateway's JSON — one object keyed by feed — not a placeholder page, a CDN interstitial or a refusal served as
 * 200: its content type, and its first significant byte `{`.
 */
export function isJsonObject(contentType: string | null, body: ArrayBuffer): boolean {
  if (!(contentType ?? "").toLowerCase().includes(JSON_CONTENT_TYPE)) return false;
  for (const byte of new Uint8Array(body)) {
    if (JSON_WHITESPACE.has(byte)) continue;
    return byte === OPEN_BRACE;
  }
  return false;
}

/** "229.57362253" → 22957362253 (× 1e8, exact); null for more than 8 decimals or a non-plain number. */
export function decimalToE8(text: string): bigint | null {
  const m = DECIMAL.exec(text);
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > E8_DECIMALS) return null;
  return BigInt(m[1] ?? "0") * DECIMAL_BASE ** BigInt(E8_DECIMALS) + BigInt(frac.padEnd(E8_DECIMALS, "0") || "0");
}

/** The wire payload for one feed's packages at one timestamp (`RedStonePayload`). */
export function payloadOf(packages: readonly Package[]): Hex {
  const body = packages
    .map((p) => {
      const feed = Buffer.from(p.feed, "ascii")
        .toString("hex")
        .padEnd(FEED_BYTES * 2, "0");
      const signed = `${feed}${hexOf(p.value, VALUE_BYTES)}${hexOf(BigInt(p.ts), TS_BYTES)}${hexOf(VALUE_SIZE, SIZE_BYTES)}${hexOf(1n, COUNT_BYTES)}`;
      return `${signed}${Buffer.from(p.signature).toString("hex")}`;
    })
    .join("");
  return `0x${body}${hexOf(BigInt(packages.length), N_BYTES)}${hexOf(0n, META_BYTES)}${MARKER}`;
}

/** The verifier's median (even count: floored average) and half the spread. */
export function medianAndConf(values: readonly bigint[]): { median: bigint; conf: bigint } {
  const v = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(v.length / Number(HALF));
  const median = v.length % 2 === 1 ? (v[mid] ?? 0n) : ((v[mid - 1] ?? 0n) + (v[mid] ?? 0n)) / HALF;
  return { median, conf: ((v.at(-1) ?? 0n) - (v[0] ?? 0n)) / HALF };
}

/**
 * Parses the gateway's answer, keeping each value's source text (`JSON.parse` source access, Node ≥ 21) — a float
 * would change the signed bytes. The reviver makes this ~5× a plain parse (21–25 ms for 2 MB), so it runs in the worker.
 */
export function parsePackages(text: string, wanted: ReadonlySet<string>): Map<string, Package[]> {
  const raw = JSON.parse(text, (key, value, context?: { source?: string }) =>
    key === "value" && typeof value === "number" && context?.source ? context.source : value,
  ) as Record<
    string,
    { timestampMilliseconds: number; signature: string; dataPoints: { dataFeedId: string; value: string }[] }[]
  >;
  const out = new Map<string, Package[]>();
  for (const feed of wanted) {
    const packages = raw[feed] ?? [];
    const latest = Math.max(0, ...packages.map((p) => p.timestampMilliseconds));
    const at = packages.flatMap((p) => {
      const dp = p.dataPoints[0];
      const value = dp ? decimalToE8(String(dp.value)) : null;
      if (p.timestampMilliseconds !== latest || !dp || dp.dataFeedId !== feed || value === null) return [];
      return [{ ts: latest, value, signature: Buffer.from(p.signature, "base64"), feed }];
    });
    if (at.length > 0) out.set(feed, at);
  }
  return out;
}
