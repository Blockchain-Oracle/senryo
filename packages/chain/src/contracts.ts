import type { ChainId } from "@senryo/config";
import {
  accessManagerAbi,
  aggregatorV3InterfaceAbi,
  collateralSwapperAbi,
  inboxFactoryAbi,
  intentRouterAbi,
  lpVaultAbi,
  marketCalendarAbi,
  mirrorAggregatorAbi,
  mockAUSDAbi,
  mockUSDCAbi,
  senryoCoreAbi,
  sessionOracleAbi,
  starterDripAbi,
} from "@senryo/contracts/abis";
import { addressBooks } from "@senryo/contracts/addresses";
import { perplExchangeAbi } from "@senryo/contracts/external";
import { type Abi, type Address, getAddress, getContract } from "viem";
import type { ReadClient } from "./clients.ts";

/** Deployed-contract name (key in `addresses/<chainId>.json`) → ABI. */
export const CONTRACT_ABIS = {
  AccessManager: accessManagerAbi,
  SenryoCore: senryoCoreAbi,
  SessionOracle: sessionOracleAbi,
  MarketCalendar: marketCalendarAbi,
  LpVault: lpVaultAbi,
  StarterDrip: starterDripAbi,
  IntentRouter: intentRouterAbi,
  InboxFactory: inboxFactoryAbi,
  CollateralSwapper: collateralSwapperAbi,
  MirrorXAU: mirrorAggregatorAbi,
  MirrorXAG: mirrorAggregatorAbi,
  /** FX mirrors on 10143 (S8.23, `AddMarkets.s.sol`). */
  MirrorEUR: mirrorAggregatorAbi,
  MirrorGBP: mirrorAggregatorAbi,
  MirrorJPY: mirrorAggregatorAbi,
  MirrorCHF: mirrorAggregatorAbi,
  MirrorCAD: mirrorAggregatorAbi,
  MockAUSD: mockAUSDAbi,
  MockUSDC: mockUSDCAbi,
} as const;

export type ContractName = keyof typeof CONTRACT_ABIS;

export { aggregatorV3InterfaceAbi };

/**
 * Every custom error any of our contracts — or the external venue the app sends to directly (Perpl's Exchange) — can
 * revert with, for decoding reverts from raw calls.
 */
export const ALL_ERRORS_ABI: Abi = [...Object.values(CONTRACT_ABIS).flat(), ...perplExchangeAbi].filter(
  (item) => item.type === "error",
);

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
