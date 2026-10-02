/**
 * LP (F24/F25): the vault snapshot from the chain (value, the user's shares and wallet AUSD, pending redeems, the
 * all-markets-open gate), the historical APR from indexed pool days (never a promise), and the request builders —
 * approve + deposit, request redeem, claim — all in the session policy's scope (LpVault is a known target/spender).
 */
import {
  CONTRACT_ABIS,
  contractCall,
  externalCall,
  isDeployed,
  type LpSnapshot,
  pinRead,
  poolTokenOf,
  readLpVault,
  type TxRequest,
} from "@senryo/chain";
import { type ChainId, positionGasLimit } from "@senryo/config";
import { type Address, type Reading, RISK } from "@senryo/core";
import { LpDaysDocument, SECONDS_PER_DAY } from "@senryo/indexer-client";
import { useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFETCH_MS, CANDLES_REFETCH_MS } from "./constants.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { ownLpRequests } from "./lp-requests.ts";
import { readingOf } from "./reading.ts";

/** APR window: the last 7 full days of pool history. */
export const LP_APR_DAYS = 7;
const DAYS_PER_YEAR = 365n;
const MS_PER_SECOND = 1000;

export function useLpVault(address: Address | undefined): Reading<LpSnapshot> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "lp"] as const,
    queryFn: async () => {
      const finalized = await env.read.getBlock({ blockTag: "finalized" });
      const requests = await ownLpRequests(env.indexer, env.chainId, address ?? "0x", finalized.number);
      const at =
        requests.indexedBlock !== undefined && requests.indexedBlock > 0n && requests.indexedBlock < finalized.number
          ? requests.indexedBlock
          : finalized.number;
      return readLpVault(
        pinRead(env.read, at),
        env.chainId,
        address ?? "0x",
        "finalized",
        requests.ids,
        requests.complete || (requests.indexedBlock !== undefined && requests.indexedBlock >= at),
      );
    },
    enabled: address !== undefined && isDeployed(env.chainId, "LpVault"),
    refetchInterval: ACCOUNT_REFETCH_MS,
    staleTime: ACCOUNT_REFETCH_MS,
  });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}

/**
 * Historical APR in bps over the last `LP_APR_DAYS`: (fees the pool kept + trader losses − trader gains) ÷ current
 * value, annualised, with the window it really covers (`days`, ≤ LP_APR_DAYS — flow book D "label the chip with its
 * real window"). Undefined with no history or an empty pool. Scoped to the active network.
 */
export interface LpApr {
  bps: bigint;
  /** Indexed days the figure covers. */
  days: number;
}

export function useLpApr(totalAssets: bigint | undefined): Reading<LpApr | undefined> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ["lp", env.chainId, "apr", LP_APR_DAYS] as const,
    queryFn: ({ signal }) => {
      const today = Math.floor(Date.now() / MS_PER_SECOND / SECONDS_PER_DAY);
      return env.indexer.request(LpDaysDocument, { chainId: env.chainId, fromDay: today - LP_APR_DAYS }, signal);
    },
    refetchInterval: CANDLES_REFETCH_MS,
    staleTime: CANDLES_REFETCH_MS,
  });
  const reading = readingOf(query, CANDLES_REFETCH_MS);
  if (reading.status === "unknown" || reading.status === "failed") return reading;
  const days = reading.value;
  if (!totalAssets || totalAssets <= 0n || days.length === 0) return { ...reading, value: undefined };
  const earned = days.reduce(
    (sum, d) => sum + (d.traderFees * (RISK.BPS - RISK.FEE_TO_INSURANCE_BPS)) / RISK.BPS - d.traderPnl,
    0n,
  );
  const span = BigInt(Math.max(days.length, 1));
  return {
    ...reading,
    value: { bps: (earned * RISK.BPS * DAYS_PER_YEAR) / (totalAssets * span), days: days.length },
  };
}

/** Approve the vault to pull AUSD (mainnet AUSD or practice MockAUSD — same ERC-20 `approve`). */
export function lpApproveRequest(chainId: ChainId, vault: Address, amountUsd6: bigint): TxRequest {
  return externalCall(poolTokenOf(chainId), CONTRACT_ABIS.MockAUSD, "approve", [vault, amountUsd6], "approve");
}

export function lpDepositRequest(chainId: ChainId, amountUsd6: bigint, receiver: Address): TxRequest {
  return contractCall(chainId, "LpVault", "deposit", [amountUsd6, receiver], "lpDeposit");
}

export function lpRequestRedeemRequest(chainId: ChainId, shares: bigint, receiver: Address): TxRequest {
  return contractCall(chainId, "LpVault", "requestRedeem", [shares, receiver], "lpRequestRedeem");
}

export function lpClaimRequest(chainId: ChainId, requestId: bigint): TxRequest {
  return contractCall(chainId, "LpVault", "claimRedeem", [requestId], "lpClaimRedeem", {
    gasCap: positionGasLimit("lpClaimRedeem", 1),
  });
}

/** Practice only: mint test AUSD to the wallet (MockAUSD faucet) so the LP flow can be tried. */
export function practiceFaucetRequest(chainId: ChainId): TxRequest {
  return contractCall(chainId, "MockAUSD", "faucet", [], "faucet");
}
