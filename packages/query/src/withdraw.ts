/**
 * Withdraw collateral out of the account to an address (`SenryoCore.withdraw(token, amount, to)`). The core debits the
 * token, then re-checks the account: Free to trade must stay ≥ 0 afterwards, so the most that can leave is the lower of
 * that token's balance and Free to trade (`maxWithdrawable`, a preview — the core is the authority). To the account's
 * own address it is in session scope (D-039); to any other address the session policy asks for a step-up.
 */
import { type AccountSnapshot, addressOf, contractCall, type TxRequest } from "@senryo/chain";
import { type ChainId, MAINNET_CHAIN_ID, MAINNET_EXTERNAL, positionGasLimit } from "@senryo/config";
import type { Address } from "@senryo/core";

export type CollateralSymbol = "AUSD" | "USDC";

/** The collateral token on a network: the external token on mainnet, our mock from the address book on practice. */
export function collateralTokenOf(chainId: ChainId, symbol: CollateralSymbol): Address {
  if (chainId === MAINNET_CHAIN_ID) return symbol === "AUSD" ? MAINNET_EXTERNAL.ausd : MAINNET_EXTERNAL.usdc;
  return addressOf(chainId, symbol === "AUSD" ? "MockAUSD" : "MockUSDC");
}

/** The most of `symbol` that can leave the account now: min(its balance, Free to trade), never negative. */
export function maxWithdrawable(snapshot: AccountSnapshot, symbol: CollateralSymbol): bigint {
  const balance = symbol === "AUSD" ? snapshot.ausd : snapshot.usdc;
  const free = snapshot.freeToTrade > 0n ? snapshot.freeToTrade : 0n;
  return balance < free ? balance : free;
}

export function withdrawRequest(
  chainId: ChainId,
  symbol: CollateralSymbol,
  amountUsd6: bigint,
  to: Address,
  positions: number,
): TxRequest {
  return contractCall(
    chainId,
    "SenryoCore",
    "withdraw",
    [collateralTokenOf(chainId, symbol), amountUsd6, to],
    "withdraw",
    {
      gasCap: positionGasLimit("withdraw", positions),
      meta: { kind: "withdraw", amount: amountUsd6.toString(), symbol, recipient: to, source: "trading" },
    },
  );
}
