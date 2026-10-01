"use client";

/**
 * The desk ticket's brain (the phone's `useTicket`, read side only — S11b slice 1 sends nothing): margin text (usd6) ×
 * leverage → notional; the `@senryo/core` preview against the live market and the account's latest risk; MAX (what
 * fits in Free to trade, 1¢ reserve, D-162); and the first blocker in spec order. Without an account the preview runs
 * against an empty one, and only its account-independent figures (entry, fee, margin, impact) are shown.
 */
import { MAINNET_CHAIN_ID } from "@senryo/config";
import {
  type AccountRiskView,
  DECIMALS,
  firstTradeBlocker,
  formatUnits,
  type IncreasePreview,
  maxIncreaseNotional,
  nextTransition,
  parseUnits,
  previewIncrease,
  type TradeBlocker,
} from "@senryo/core";
import { type LiveMarket, riskViewOf, useAccountRisk, useCalendar, usePositions, useQueryEnv } from "@senryo/query";
import { onlineManager } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";

export type Side = "long" | "short";
export const DEFAULT_LEVERAGE = 5;
const MS_PER_SECOND = 1000;
const NO_ACCOUNT: AccountRiskView = { equityLiq: 0n, mm: 0n, freeToTrade: 0n, atRisk: false };

export function useTicket(market: LiveMarket) {
  const env = useQueryEnv();
  const address = useAccount().hint?.address;
  const [side, setSide] = useState<Side>("long");
  const [amountText, setAmountText] = useState("");
  const [lev, setLev] = useState(() => Math.max(1, Math.min(DEFAULT_LEVERAGE, market.maxLeverageX)));
  const leverage = Math.max(1, Math.min(lev, market.maxLeverageX));
  const online = useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => true,
  );
  const risk = useAccountRisk(address, "latest");
  const positions = usePositions(address);
  const calendar = useCalendar(market.calendarId);

  const isLong = side === "long";
  const parsed = parseUnits(amountText === "" ? "0" : amountText, DECIMALS.usd6);
  const amountUsd6 = parsed.ok ? parsed.value : 0n;
  const notionalUsd6 = amountUsd6 * BigInt(leverage);
  const snapshot = known(risk);
  const held = known(positions)?.find((p) => p.marketId === market.marketId);
  const base = {
    market: market.risk,
    book: market.book,
    pv: market.pv,
    account: snapshot ? riskViewOf(snapshot) : NO_ACCOUNT,
    position: held,
    isLong,
  };
  const preview: IncreasePreview | undefined =
    notionalUsd6 > 0n ? previewIncrease({ ...base, notionalUsd6 }) : undefined;
  const maxAmountUsd6 = snapshot ? maxIncreaseNotional(base) / BigInt(leverage) : 0n;

  const nowSec = BigInt(Math.floor(Date.now() / MS_PER_SECOND));
  const week = known(calendar);
  const opensAt = week ? nextTransition(week, nowSec, true) : undefined;
  const blocker: TradeBlocker | undefined = firstTradeBlocker({
    online,
    mainnet: env.chainId === MAINNET_CHAIN_ID,
    geoAllowed: undefined,
    country: null,
    hasAccount: address !== undefined,
    gas: { kind: "ok" },
    status: market.pv.status,
    opensAt,
    leverageX: leverage,
    maxLeverageX: market.maxLeverageX,
    preview: snapshot ? preview : undefined,
    simulationRevert: undefined,
  });

  return {
    side,
    setSide,
    amountText,
    setAmountText,
    amountUsd6,
    invalidAmount: amountText !== "" && !parsed.ok,
    setMax: () =>
      setAmountText(
        maxAmountUsd6 === 0n ? "" : formatUnits(maxAmountUsd6, DECIMALS.usd6, DECIMALS.cents, { grouping: false }),
      ),
    leverage,
    setLeverage: (v: number) => setLev(Math.max(1, Math.min(v, market.maxLeverageX))),
    notionalUsd6,
    preview,
    maxAmountUsd6,
    /** The preview's account-dependent figures (Free to trade after, liquidation, margin use) mean something. */
    hasAccount: snapshot !== undefined,
    signedIn: address !== undefined,
    accountReading: risk,
    held,
    blocker,
    nowSec,
  };
}
