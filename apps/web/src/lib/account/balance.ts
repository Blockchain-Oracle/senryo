"use client";

/**
 * The account's balance as the desk shows it (the phone's `HomeHeader.useBalance` + `portfolio/account.ts`): the
 * risk-adjusted balance at `finalized`, and how it did over the day — today's balance against the day's first indexed
 * snapshot, less the money moved in or out since (a withdrawal is not a loss; a deposit or a claim is not a gain).
 */
import type { AccountSnapshot } from "@senryo/chain";
import { type Address, type Reading, RISK } from "@senryo/core";
import { useAccountRisk, useEquityHistory, useNetFlows } from "@senryo/query";

const DAY_SEC = 86_400;

/** What the balance holds back from new trades (margin, card holds or the envelope, the buffer); never below zero. */
export function lockedOf(snapshot: AccountSnapshot): bigint {
  const locked = snapshot.equityInit - snapshot.freeToTrade;
  return locked > 0n ? locked : 0n;
}

export interface BalanceView {
  risk: Reading<AccountSnapshot>;
  /** Signed day change (usd6), net of flows; undefined until the day's history and flows are known. */
  change: bigint | undefined;
  changeBps: bigint | undefined;
}

export function useBalance(address: Address | undefined): BalanceView {
  const risk = useAccountRisk(address, "finalized");
  const day = useEquityHistory(address, DAY_SEC);
  const equity = risk.status === "fresh" || risk.status === "stale" ? risk.value.equityInit : undefined;
  const first = day.status === "fresh" || day.status === "stale" ? day.value[0] : undefined;
  const flows = useNetFlows(address, first?.timestamp);
  const moved = flows.status === "fresh" || flows.status === "stale" ? flows.value : undefined;
  const change = first && moved && equity !== undefined ? equity - first.equityInit - moved.net : undefined;
  const base = first && moved ? first.equityInit + moved.inflow : undefined;
  const changeBps = base !== undefined && base > 0n && change !== undefined ? (change * RISK.BPS) / base : undefined;
  return { risk, change, changeBps };
}
