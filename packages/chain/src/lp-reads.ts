import { type ChainId, MAINNET_CHAIN_ID, MAINNET_EXTERNAL } from "@senryo/config";
import { lpVaultAbi, mockAUSDAbi, senryoCoreAbi } from "@senryo/contracts/abis";
import type { Address } from "viem";
import type { ReadClient } from "./clients.ts";
import { addressOf } from "./contracts.ts";
import type { ReadTag } from "./reads.ts";

/** The LP pool's asset: AUSD on mainnet (external token), MockAUSD from our address book on practice. */
export function poolTokenOf(chainId: ChainId): Address {
  return chainId === MAINNET_CHAIN_ID ? MAINNET_EXTERNAL.ausd : addressOf(chainId, "MockAUSD");
}

export interface LpRedeemView {
  requestId: bigint;
  shares: bigint;
  claimableAt: bigint;
}

/** Everything the LP screen needs (F24/F25) from one block: vault value, the user's shares and wallet AUSD, gates. */
export interface LpSnapshot {
  /** Conservative pool value (redeem side), usd6. */
  totalAssets: bigint;
  totalSupply: bigint;
  tvlCap: bigint;
  /** What a new deposit may add before the cap (0 when paused/capped). */
  maxDeposit: bigint;
  shares: bigint;
  /** The user's shares valued at the conservative price. */
  sharesValue: bigint;
  walletAusd: bigint;
  allowance: bigint;
  /** Redeem claims need every market OPEN (weekend-gap protection). */
  allMarketsOpen: boolean;
  pending: LpRedeemView[];
  pendingValue: bigint;
  requestsComplete: boolean;
}

export async function readLpVault(
  read: ReadClient,
  chainId: ChainId,
  user: Address,
  blockTag: ReadTag = "latest",
  requestIds: readonly bigint[] = [],
  requestsComplete = false,
): Promise<LpSnapshot> {
  const vault = { address: addressOf(chainId, "LpVault"), abi: lpVaultAbi } as const;
  const token = { address: poolTokenOf(chainId), abi: mockAUSDAbi } as const;
  const core = { address: addressOf(chainId, "SenryoCore"), abi: senryoCoreAbi } as const;
  const [totalAssets, totalSupply, tvlCap, maxDeposit, shares, walletAusd, allowance, allOpen] = await read.multicall({
    contracts: [
      { ...vault, functionName: "totalAssets" },
      { ...vault, functionName: "totalSupply" },
      { ...vault, functionName: "tvlCap" },
      { ...vault, functionName: "maxDeposit", args: [user] },
      { ...vault, functionName: "balanceOf", args: [user] },
      { ...token, functionName: "balanceOf", args: [user] },
      { ...token, functionName: "allowance", args: [user, vault.address] },
      { ...core, functionName: "allMarketsOpen" },
    ],
    allowFailure: false,
    blockTag,
  });
  const ids = [...new Set(requestIds)];
  const [value, requests] = await Promise.all([
    read.readContract({ ...vault, functionName: "convertToAssets", args: [shares], blockTag }),
    ids.length === 0
      ? Promise.resolve([])
      : read.multicall({
          contracts: ids.map((id) => ({ ...vault, functionName: "requests", args: [id] }) as const),
          allowFailure: false,
          blockTag,
        }),
  ]);
  const pending = requests.flatMap((r, i) => {
    const [owner, , reqShares, claimableAt] = r;
    return owner.toLowerCase() === user.toLowerCase() && reqShares > 0n
      ? [{ requestId: ids[i] ?? 0n, shares: reqShares, claimableAt: BigInt(claimableAt) }]
      : [];
  });
  const pendingValue = await read.readContract({
    ...vault,
    functionName: "convertToAssets",
    args: [pending.reduce((sum, request) => sum + request.shares, 0n)],
    blockTag,
  });
  return {
    totalAssets,
    totalSupply,
    tvlCap,
    maxDeposit,
    shares,
    sharesValue: value,
    walletAusd,
    allowance,
    allMarketsOpen: allOpen,
    pending,
    pendingValue,
    requestsComplete,
  };
}
