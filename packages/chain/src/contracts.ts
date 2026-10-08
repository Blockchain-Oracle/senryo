import { type ChainId, MAINNET_CHAIN_ID, MAINNET_USDC } from "@senryo/config";
import {
  accessManagerAbi,
  bandReserveAbi,
  marketCalendarAbi,
  pythPrintVerifierAbi,
  testUSDAbi,
  windowsAbi,
} from "@senryo/contracts/abis";
import { addressBooks } from "@senryo/contracts/addresses";
import { type Abi, type Address, getAddress, getContract } from "viem";
import type { ReadClient } from "./clients.ts";

/** Deployed-contract name (key in `addresses/<chainId>.json`) → ABI: the prediction markets (S2, D-256). */
export const CONTRACT_ABIS = {
  AccessManager: accessManagerAbi,
  BandReserve: bandReserveAbi,
  MarketCalendar: marketCalendarAbi,
  PythPrintVerifier: pythPrintVerifierAbi,
  TestUSD: testUSDAbi,
  Windows: windowsAbi,
} as const;

export type ContractName = keyof typeof CONTRACT_ABIS;

/** Every custom error any of our contracts can revert with, for decoding reverts from raw calls. */
export const ALL_ERRORS_ABI: Abi = Object.values(CONTRACT_ABIS)
  .flat()
  .filter((item) => item.type === "error");

export class NotDeployedError extends Error {
  constructor(
    readonly chainId: number,
    readonly contract: string,
  ) {
    super(`${contract} is not deployed on chain ${chainId}`);
    this.name = "NotDeployedError";
  }
}

export function isDeployed(chainId: ChainId, name: ContractName): boolean {
  return Boolean(addressBooks[chainId]?.contracts[name]?.address);
}

export function addressOf(chainId: ChainId, name: ContractName): Address {
  const entry = addressBooks[chainId]?.contracts[name];
  if (!entry?.address) throw new NotDeployedError(chainId, name);
  return getAddress(entry.address);
}

/** First block to consider for this deployment (indexer start block). */
export function startBlockOf(chainId: ChainId, name: ContractName): bigint {
  const entry = addressBooks[chainId]?.contracts[name];
  if (!entry) throw new NotDeployedError(chainId, name);
  return BigInt(entry.startBlock);
}

/** Typed read-only contract instance (`.read.<fn>(args, { blockTag })`). */
export function readContract<N extends ContractName>(chainId: ChainId, name: N, client: ReadClient) {
  return getContract({ address: addressOf(chainId, name), abi: CONTRACT_ABIS[name], client });
}

/**
 * The dollar every bet uses (D-258): Circle USDC on mainnet, our Test USD (address book, after the S2 deploy) on
 * testnet. `undefined` until the testnet token is deployed — callers show "Coming with the next deploy", never $0.
 */
export function dollarTokenOf(chainId: ChainId): Address | undefined {
  if (chainId === MAINNET_CHAIN_ID) return getAddress(MAINNET_USDC);
  const entry = addressBooks[chainId]?.contracts.TestUSD;
  return entry ? getAddress(entry.address) : undefined;
}

/** The prediction-market contracts on a network (S2 testnet, S9 mainnet); false until they're in the address book. */
export function marketsDeployed(chainId: ChainId): boolean {
  return Boolean(addressBooks[chainId]?.contracts.BandReserve);
}
