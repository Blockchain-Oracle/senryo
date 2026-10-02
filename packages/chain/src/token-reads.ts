/**
 * Any-token reads (D6): balances, metadata and allowances for arbitrary ERC-20s in multicalls that tolerate failures
 * (a spam or non-standard token must never break the rest of the batch). Native MON is `address(0)` and read through
 * Multicall3.getEthBalance, so every balance in one call comes from the same block.
 */
import { type Address, erc20Abi, multicall3Abi, zeroAddress } from "viem";
import type { ReadClient } from "./clients.ts";
import { MULTICALL3_ADDRESS } from "./constants.ts";

/** Calls per multicall: ~10k gas each, well inside an eth_call's gas allowance. */
const CALLS_PER_MULTICALL = 150;
const META_CALLS = 3;
/** Bounds on what a token may claim about itself before it is treated as broken. */
const MAX_DECIMALS = 36;
const MAX_TEXT_CHARS = 64;

const isNative = (token: Address) => token.toLowerCase() === zeroAddress;

type Call = { address: Address; abi: typeof erc20Abi | typeof multicall3Abi; functionName: string; args?: unknown[] };

async function multicallChunks(read: ReadClient, calls: readonly Call[], blockNumber?: bigint) {
  const out: Array<{ status: "success" | "failure"; result?: unknown }> = [];
  for (let i = 0; i < calls.length; i += CALLS_PER_MULTICALL) {
    const chunk = calls.slice(i, i + CALLS_PER_MULTICALL);
    const results = await read.multicall({
      contracts: chunk as never,
      allowFailure: true,
      batchSize: 0,
      ...(blockNumber === undefined ? {} : { blockNumber }),
    });
    out.push(...(results as Array<{ status: "success" | "failure"; result?: unknown }>));
  }
  return out;
}

/** `balanceOf(owner)` per token (native MON for `address(0)`) at one block; a failing token is `undefined`. */
export async function readTokenBalances(
  read: ReadClient,
  owner: Address,
  tokens: readonly Address[],
  blockNumber?: bigint,
): Promise<Array<bigint | undefined>> {
  const calls: Call[] = tokens.map((token) =>
    isNative(token)
      ? { address: MULTICALL3_ADDRESS, abi: multicall3Abi, functionName: "getEthBalance", args: [owner] }
      : { address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] },
  );
  const results = await multicallChunks(read, calls, blockNumber);
  return results.map((r) => (r.status === "success" && typeof r.result === "bigint" ? r.result : undefined));
}

export interface TokenMetadata {
  decimals: number;
  symbol: string;
  name: string;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strips control bytes some spam tokens put in their names.
  const text = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return text.length > 0 ? text.slice(0, MAX_TEXT_CHARS) : undefined;
}

/** `decimals()`, `symbol()` and `name()` per token; a token without valid decimals and symbol is `undefined`. */
export async function readTokenMetadata(
  read: ReadClient,
  tokens: readonly Address[],
): Promise<Array<TokenMetadata | undefined>> {
  const calls: Call[] = tokens.flatMap((address) => [
    { address, abi: erc20Abi, functionName: "decimals" },
    { address, abi: erc20Abi, functionName: "symbol" },
    { address, abi: erc20Abi, functionName: "name" },
  ]);
  const results = await multicallChunks(read, calls);
  return tokens.map((_, i) => {
    const [decimals, symbol, name] = results.slice(i * META_CALLS, (i + 1) * META_CALLS);
    const d = decimals?.status === "success" ? Number(decimals.result) : Number.NaN;
    const s = symbol?.status === "success" ? cleanText(symbol.result) : undefined;
    if (!Number.isInteger(d) || d < 0 || d > MAX_DECIMALS || s === undefined) return undefined;
    const n = name?.status === "success" ? cleanText(name.result) : undefined;
    return { decimals: d, symbol: s, name: n ?? s };
  });
}

/** ERC-20 allowance owner → spender per pair (0 when the read fails, so an approval is sent). */
export async function readAllowances(
  read: ReadClient,
  owner: Address,
  pairs: ReadonlyArray<{ token: Address; spender: Address }>,
): Promise<bigint[]> {
  if (pairs.length === 0) return [];
  const calls: Call[] = pairs.map((p) => ({
    address: p.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, p.spender],
  }));
  const results = await multicallChunks(read, calls);
  return results.map((r) => (r.status === "success" && typeof r.result === "bigint" ? r.result : 0n));
}
