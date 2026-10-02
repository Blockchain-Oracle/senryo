/** Shapes shared by the bridge adapters (relay, cctp, across, lifi) and the bridge service. */
import type { BridgeFee, BridgeStatus, BridgeStepWire } from "@senryo/api-client";
import { type Address, getAddress, type Hex } from "@senryo/chain";
import type {
  BridgeAsset,
  BridgeChain,
  BridgeDirection,
  BridgeProvider,
  ChainId,
  RemoteAsset,
  RemoteToken,
} from "@senryo/config";

export interface Side {
  chainId: number;
  token: RemoteToken;
}

export interface QuoteContext {
  monadChainId: ChainId;
  direction: BridgeDirection;
  asset: BridgeAsset;
  remoteAsset: RemoteAsset;
  remoteChain: BridgeChain;
  from: Side;
  to: Side;
  amount: bigint;
  sender: Address;
  recipient: string;
}

export interface ProviderQuote {
  provider: BridgeProvider;
  amountOut: bigint;
  minReceived: bigint;
  out: { symbol: string; decimals: number };
  fees: BridgeFee[];
  etaSec: number;
  steps: BridgeStepWire[];
  /** A provider request id known at quote time (Relay); null → tracked by the source tx hash. */
  trackingId: string | null;
  expiresAt: number | null;
}

export interface StatusInput {
  monadChainId: ChainId;
  id: string;
  fromChain: number;
  toChain: number | undefined;
}

export type StatusResult = Omit<BridgeStatus, "at" | "route" | "id">;

export const EVM_NATIVE = "0x0000000000000000000000000000000000000000";
export const isEvmNative = (address: string) => address.toLowerCase() === EVM_NATIVE;

const APPROVE_SELECTOR = "0x095ea7b3";
const SELECTOR_CHARS = 10;
const WORD_CHARS = 64;
const ADDRESS_CHARS = 40;

/** `approve(spender, amount)` calldata → its arguments, or null for any other call. */
export function decodeApprove(data: string): { spender: Address; amount: bigint } | null {
  if (!data.toLowerCase().startsWith(APPROVE_SELECTOR) || data.length < SELECTOR_CHARS + 2 * WORD_CHARS) return null;
  const spenderWord = data.slice(SELECTOR_CHARS, SELECTOR_CHARS + WORD_CHARS);
  const amountWord = data.slice(SELECTOR_CHARS + WORD_CHARS, SELECTOR_CHARS + 2 * WORD_CHARS);
  return {
    spender: getAddress(`0x${spenderWord.slice(WORD_CHARS - ADDRESS_CHARS)}`),
    amount: BigInt(`0x${amountWord}`),
  };
}

export function approveStep(chainId: number, token: string, spender: string, amount: bigint): BridgeStepWire {
  return { kind: "approve", chainId, token: getAddress(token), spender: getAddress(spender), amount };
}

export function callStep(
  chainId: number,
  to: string,
  data: string,
  value: bigint,
  action: Extract<BridgeStepWire, { kind: "call" }>["action"],
): BridgeStepWire {
  return { kind: "call", chainId, to: getAddress(to), data: data as Hex, value, action };
}

/** A fee in a token, with its USD value (usd6) when the provider gave one. */
export function fee(
  kind: BridgeFee["kind"],
  amount: bigint,
  token: { symbol: string; decimals: number; chainId: number },
  included: boolean,
  usd6: bigint | null,
): BridgeFee {
  return { kind, amount, symbol: token.symbol, decimals: token.decimals, chainId: token.chainId, included, usd6 };
}
