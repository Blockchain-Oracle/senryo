/**
 * What a scanned code asks for (B7 Scan): a plain address, or an EIP-681 payment link — `ethereum:<to>[@chainId]` with
 * an optional `?value=` (native), or `ethereum:<token>[@chainId]/transfer?address=<to>&uint256=<amount>` (ERC-20).
 * Amounts are raw base units (decimal or `1e6` notation, integers only). Anything else is not a payment code.
 */

export interface ScannedPayment {
  address: `0x${string}`;
  chainId?: number | undefined;
  /** ERC-20 contract for a `transfer` link. */
  token?: `0x${string}` | undefined;
  /** Raw base units the link asks for. */
  amount?: bigint | undefined;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SCHEME = /^ethereum:(pay-)?/i;
const SCIENTIFIC = /^(\d+)(?:\.(\d+))?e(\d+)$/i;
const INTEGER = /^\d+$/;
const DECIMAL_RADIX = 10n;

function rawAmount(text: string | null): bigint | undefined {
  if (!text) return undefined;
  if (INTEGER.test(text)) return BigInt(text);
  const sci = SCIENTIFIC.exec(text);
  if (!sci) return undefined;
  const [, whole = "0", frac = "", exp = "0"] = sci;
  const shift = Number.parseInt(exp, 10) - frac.length;
  if (shift < 0) return undefined;
  return BigInt(`${whole}${frac}`) * DECIMAL_RADIX ** BigInt(shift);
}

export function parsePayment(raw: string): ScannedPayment | undefined {
  const text = raw.trim();
  if (ADDRESS.test(text)) return { address: text as `0x${string}` };
  if (!SCHEME.test(text)) return undefined;
  const body = text.replace(SCHEME, "");
  const [path = "", query = ""] = body.split("?", 2);
  const [targetPart = "", fn] = path.split("/", 2);
  const [target = "", chain] = targetPart.split("@", 2);
  if (!ADDRESS.test(target)) return undefined;
  const params = new URLSearchParams(query);
  const chainId = chain ? Number.parseInt(chain, 10) : undefined;
  const chainPart = chainId !== undefined && !Number.isNaN(chainId) ? { chainId } : {};
  if (fn === "transfer") {
    const to = params.get("address") ?? "";
    if (!ADDRESS.test(to)) return undefined;
    return {
      address: to as `0x${string}`,
      token: target as `0x${string}`,
      amount: rawAmount(params.get("uint256")),
      ...chainPart,
    };
  }
  return { address: target as `0x${string}`, amount: rawAmount(params.get("value")), ...chainPart };
}
