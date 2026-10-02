/**
 * Perpl reads for one wallet, straight from the Exchange (no API key): the account (`getAccountByAddr` — reverts
 * `AccountDoesNotExist` when the wallet never deposited), its open positions (`getPositionV2` for every market set in
 * the account's position bitmap), the market terms an order needs (mark, decimals, max leverage, taker fee) and the
 * wallet's AUSD + allowance for planning the deposit. Every read of one call shares one block.
 */
import {
  type ChainId,
  PERPL_COLLATERAL,
  PERPL_EXCHANGE,
  PERPL_POSITION_TYPE,
  PERPL_PRICE_SOURCE,
} from "@senryo/config";
import { perplExchangeAbi } from "@senryo/contracts/external";
import { type Address, erc20Abi } from "viem";
import type { ReadClient } from "../clients.ts";
import { decodeRevert } from "../errors.ts";
import type { PerplScale, PerplSide } from "./math.ts";

/** A uint read that is a small count or a decimal place (never money). */
const small = (value: bigint | number): number => Number(value);

/** Bit layout of `AccountInfo.positions` (dex-sdk `state/account.rs` `perpetuals_with_position`). */
const BANK_LAYOUT = [
  { first: 0, bits: 253 },
  { first: 253, bits: 256 },
  { first: 509, bits: 256 },
  { first: 765, bits: 256 },
] as const;

/** Market ids whose bit is set in the account's four position banks. */
export function perplMarketsWithPositions(banks: readonly bigint[]): number[] {
  const out: number[] = [];
  BANK_LAYOUT.forEach((layout, i) => {
    const bank = banks[i] ?? 0n;
    for (let bit = 0; bank >> BigInt(bit) !== 0n && bit < layout.bits; bit += 1) {
      if ((bank >> BigInt(bit)) & 1n) out.push(layout.first + bit);
    }
  });
  return out;
}

export interface PerplAccount {
  accountId: bigint;
  /** Collateral on the Exchange (CNS = AUSD base units) and the part locked by resting orders. */
  balanceCNS: bigint;
  lockedBalanceCNS: bigint;
  /** What new margin can come from: balance − locked. */
  availableCNS: bigint;
  /** Non-zero = frozen by Perpl (orders refused). */
  frozen: number;
  marketsWithPositions: number[];
}

/** The wallet's Perpl account, or undefined when it has none (the first deposit creates it). */
export async function readPerplAccount(
  read: ReadClient,
  chainId: ChainId,
  owner: Address,
  blockNumber?: bigint,
): Promise<PerplAccount | undefined> {
  try {
    const a = await read.readContract({
      address: PERPL_EXCHANGE[chainId],
      abi: perplExchangeAbi,
      functionName: "getAccountByAddr",
      args: [owner],
      ...(blockNumber === undefined ? {} : { blockNumber }),
    });
    const banks = [a.positions.bank1, a.positions.bank2, a.positions.bank3, a.positions.bank4];
    return {
      accountId: a.accountId,
      balanceCNS: a.balanceCNS,
      lockedBalanceCNS: a.lockedBalanceCNS,
      availableCNS: a.balanceCNS > a.lockedBalanceCNS ? a.balanceCNS - a.lockedBalanceCNS : 0n,
      frozen: a.frozen,
      marketsWithPositions: perplMarketsWithPositions(banks),
    };
  } catch (error) {
    if (decodeRevert(error)?.name === "AccountDoesNotExist") return undefined;
    throw error;
  }
}

export interface PerplPosition {
  marketId: number;
  side: PerplSide;
  lots: bigint;
  /** Entry price (PNS) and the collateral held by the position (CNS). */
  entryPricePNS: bigint;
  depositCNS: bigint;
  /** Unrealized PnL at the mark, and its price/premium (funding) parts, as the Exchange computes them (CNS). */
  pnlCNS: bigint;
  deltaPnlCNS: bigint;
  premiumPnlCNS: bigint;
  markPricePNS: bigint;
  markPriceValid: boolean;
  entryBlock: bigint;
}

/** Open positions of `accountId` in `marketIds` (one multicall); a market with no lots is left out. */
export async function readPerplPositions(
  read: ReadClient,
  chainId: ChainId,
  accountId: bigint,
  marketIds: readonly number[],
  blockNumber?: bigint,
): Promise<PerplPosition[]> {
  if (marketIds.length === 0) return [];
  const results = await read.multicall({
    contracts: marketIds.map(
      (id) =>
        ({
          address: PERPL_EXCHANGE[chainId],
          abi: perplExchangeAbi,
          functionName: "getPositionV2",
          args: [BigInt(id), accountId],
        }) as const,
    ),
    allowFailure: false,
    ...(blockNumber === undefined ? {} : { blockNumber }),
  });
  return results.flatMap(([p, markPricePNS, markPriceValid], i): PerplPosition[] => {
    const marketId = marketIds[i];
    if (marketId === undefined || p.lotLNS === 0n) return [];
    return [
      {
        marketId,
        side: p.positionType === PERPL_POSITION_TYPE.long ? "long" : "short",
        lots: p.lotLNS,
        entryPricePNS: p.pricePNS,
        depositCNS: p.depositCNS,
        pnlCNS: p.pnlCNS,
        deltaPnlCNS: p.deltaPnlCNS,
        premiumPnlCNS: p.premiumPnlCNS,
        markPricePNS,
        markPriceValid,
        entryBlock: p.entryBlock,
      },
    ];
  });
}

export interface PerplMarketTerms extends PerplScale {
  marketId: number;
  markPNS: bigint;
  markTimestamp: number;
  paused: boolean;
  /** Highest leverage an open may ask for, hundredths (`getMarginFractions().perpInitMarginFracHdths`). */
  maxLeverageHdths: bigint;
  /** Taker fee, millionths of notional (`getTakerFee`, contract ≥ 1.7.5). */
  takerFeePpm: bigint;
}

/** What an order on `marketId` needs, read together at one block. */
export async function readPerplMarketTerms(
  read: ReadClient,
  chainId: ChainId,
  marketId: number,
  blockNumber?: bigint,
): Promise<PerplMarketTerms> {
  const address = PERPL_EXCHANGE[chainId];
  const id = BigInt(marketId);
  const [info, margins, fee] = await read.multicall({
    contracts: [
      { address, abi: perplExchangeAbi, functionName: "getPerpetualInfo", args: [id] } as const,
      { address, abi: perplExchangeAbi, functionName: "getMarginFractions", args: [id, 0n] } as const,
      { address, abi: perplExchangeAbi, functionName: "getTakerFee", args: [id] } as const,
    ],
    allowFailure: false,
    ...(blockNumber === undefined ? {} : { blockNumber }),
  });
  return {
    marketId,
    priceDecimals: small(info.priceDecimals),
    lotDecimals: small(info.lotDecimals),
    markPNS: info.markPNS,
    markTimestamp: small(info.markTimestamp),
    paused: info.status === PERPL_PRICE_SOURCE.pausedStatus,
    maxLeverageHdths: margins[0],
    takerFeePpm: fee,
  };
}

export interface PerplExchangeState {
  minAccountOpenCNS: bigint;
  halted: boolean;
}

export async function readPerplExchange(read: ReadClient, chainId: ChainId): Promise<PerplExchangeState> {
  const address = PERPL_EXCHANGE[chainId];
  const [minAccountOpenCNS, halted] = await read.multicall({
    contracts: [
      { address, abi: perplExchangeAbi, functionName: "getMinAccountOpenCNS" } as const,
      { address, abi: perplExchangeAbi, functionName: "isHalted" } as const,
    ],
    allowFailure: false,
  });
  return { minAccountOpenCNS, halted };
}

export interface PerplWalletCollateral {
  /** AUSD in the wallet, and what the Exchange may already pull from it. */
  balance: bigint;
  allowance: bigint;
}

export async function readPerplWalletCollateral(
  read: ReadClient,
  chainId: ChainId,
  owner: Address,
  blockNumber?: bigint,
): Promise<PerplWalletCollateral> {
  const token = PERPL_COLLATERAL[chainId];
  const [balance, allowance] = await read.multicall({
    contracts: [
      { address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] } as const,
      { address: token, abi: erc20Abi, functionName: "allowance", args: [owner, PERPL_EXCHANGE[chainId]] } as const,
    ],
    allowFailure: false,
    ...(blockNumber === undefined ? {} : { blockNumber }),
  });
  return { balance, allowance };
}

export interface PerplSnapshot {
  blockNumber: bigint;
  account: PerplAccount | undefined;
  positions: PerplPosition[];
  wallet: PerplWalletCollateral;
}

/**
 * The wallet's whole Perpl picture at the finalized head (money surfaces show finalized state): account, positions and
 * wallet AUSD, all at one block.
 */
export async function readPerplSnapshot(read: ReadClient, chainId: ChainId, owner: Address): Promise<PerplSnapshot> {
  const { number: blockNumber } = await read.getBlock({ blockTag: "finalized" });
  const [account, wallet] = await Promise.all([
    readPerplAccount(read, chainId, owner, blockNumber),
    readPerplWalletCollateral(read, chainId, owner, blockNumber),
  ]);
  const positions = account
    ? await readPerplPositions(read, chainId, account.accountId, account.marketsWithPositions, blockNumber)
    : [];
  return { blockNumber, account, positions, wallet };
}
