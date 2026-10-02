"use client";

/**
 * The ticket's brain (the phone's `useTicket`, flow book C3): margin (usd6) × leverage → exposure; the `@senryo/core`
 * preview against the live market and the account's latest risk; Max (what fits in Free to trade); the first blocker in
 * spec order (opposite side named before the slide); and the send — `increase` through `@senryo/chain`. In the session's
 * scope it signs with the session; above its caps the SAME reviewed order is signed with one passkey step-up instead of
 * failing. The reviewed intent is frozen at the slide: re-read at the pinned head right before signing, and anything
 * that moved past the bound stops it ("Review again"); the trace never resends.
 */
import type { Sender } from "@senryo/chain";
import { pinRead, readAccountSnapshot, readMarketRisk, readPositions } from "@senryo/chain";
import { MAINNET_CHAIN_ID, positionCount } from "@senryo/config";
import {
  capHeadroomUsd6,
  DECIMALS,
  firstTradeBlocker,
  formatUnits,
  type GasGate,
  type IncreasePreview,
  maxIncreaseNotional,
  nextTransition,
  parseUnits,
  previewIncrease,
  RISK,
  type TradeBlocker,
} from "@senryo/core";
import {
  increaseRequest,
  type LiveMarket,
  riskViewOf,
  TRADE_SLIPPAGE_BPS,
  useAccountRisk,
  useCalendar,
  useGasBalance,
  useGasBudget,
  useGeo,
  usePositions,
  useProtocolState,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { onlineManager } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { useStepUp } from "@/components/auth/step-up";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { stepUpSender, userSender } from "@/lib/account/sender";
import { money } from "@/lib/format";
import { useReviewGuard } from "@/lib/review-guard";
import type { Side } from "./commit";
import { openConfirmLevel } from "./confirm-level";
import { useGasTopUp } from "./use-gas-top-up";

export type { Side };
export const DEFAULT_LEVERAGE = 5;
const MS_PER_SECOND = 1000n;
/** Typed margin: digits with at most two decimals. */
const AMOUNT_INPUT = /^\d*(\.\d{0,2})?$/;

export const ticketKey = (chainId: number, address: string | undefined, marketId: number) =>
  `trade:${chainId}:${address?.toLowerCase() ?? "guest"}:${marketId}`;

export function useTicket(market: LiveMarket) {
  const env = useQueryEnv();
  const account = useAccount();
  const stepUp = useStepUp();
  const address = account.hint?.address;
  const [side, setSide] = useState<Side>("long");
  const [amountText, setAmount] = useState("");
  const [lev, setLev] = useState(() => Math.min(DEFAULT_LEVERAGE, market.maxLeverageX));
  const leverage = Math.max(1, Math.min(lev, market.maxLeverageX));
  const online = useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => true,
  );
  const risk = useAccountRisk(address, "latest");
  const positions = usePositions(address);
  const gas = useGasBalance(address);
  const calendar = useCalendar(market.calendarId);
  const geo = known(useGeo());
  const guardian = known(useProtocolState());

  const isLong = side === "long";
  const parsed = parseUnits(amountText === "" ? "0" : amountText, DECIMALS.usd6);
  const amountUsd6 = parsed.ok ? parsed.value : 0n;
  const notionalUsd6 = amountUsd6 * BigInt(leverage);
  const snapshot = known(risk);
  const held = known(positions)?.find((p) => p.marketId === market.marketId);
  const base = snapshot
    ? { market: market.risk, book: market.book, pv: market.pv, account: riskViewOf(snapshot), position: held, isLong }
    : undefined;
  const preview: IncreasePreview | undefined =
    base && notionalUsd6 > 0n ? previewIncrease({ ...base, notionalUsd6 }) : undefined;
  const maxAmountUsd6 = base ? maxIncreaseNotional(base) / BigInt(leverage) : 0n;

  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  const week = known(calendar);
  const opensAt = week ? nextTransition(week, nowSec, true) : undefined;
  const gasBalance = known(gas);
  const openAfter = (snapshot ? positionCount(snapshot.positionBitmap) : 0) + (held ? 0 : 1);
  const openRequest = preview
    ? increaseRequest(env.chainId, market.marketId, isLong, notionalUsd6, preview.execPrice18, openAfter)
    : undefined;
  const budget = useGasBudget(address, openRequest, ["increase", market.marketId, side, openAfter]);
  const needWei = budget.data?.needWei;
  const topUp = useGasTopUp();
  const gasShort = gasBalance !== undefined && needWei !== undefined && gasBalance < needWei;
  const topUpRefused = topUp.step.kind === "failed" && (gasShort || gasBalance === undefined);
  const gasGate: GasGate =
    topUp.step.kind === "failed" && topUpRefused
      ? {
          kind: "unavailable",
          reason: topUp.step.reason,
          ...(topUp.step.retryAfterSec !== undefined ? { retryAfterSec: topUp.step.retryAfterSec } : {}),
        }
      : gasShort
        ? { kind: "topup" }
        : { kind: "ok" };
  const key = ticketKey(env.chainId, address, market.marketId);
  const trace = useSendTrace(key);
  const confirmWith = openConfirmLevel({
    client: account.client,
    address,
    faceId: account.settings.faceId,
    marketId: market.marketId,
    isLong,
    notionalUsd6,
    equityUsd6: snapshot?.equityInit,
    roomUsd6: capHeadroomUsd6(market.risk, market.book, market.pv, isLong),
  });
  const simulationRevert = trace.events.find((e) => e.stage === "failed")?.error;
  const blocker: TradeBlocker | undefined = firstTradeBlocker({
    online,
    mainnet: env.chainId === MAINNET_CHAIN_ID,
    geoAllowed: geo?.mainnetTradingAllowed,
    country: geo?.country ?? null,
    hasAccount: address !== undefined,
    gas: gasGate,
    status: market.pv.status,
    opensAt,
    leverageX: leverage,
    maxLeverageX: market.maxLeverageX,
    preview,
    simulationRevert: simulationRevert instanceof Error ? simulationRevert.message.split("\n")[0] : undefined,
    ...(held ? { heldLong: held.isLong } : {}),
    ...(guardian ? { protocol: { ...guardian, now: nowSec } } : {}),
  });

  const intent = [env.chainId, address, market.marketId, side, amountText, leverage].join(":");
  const guard = useReviewGuard(intent);
  const submit = async () => {
    const client = account.client;
    if (!client || !address || !preview || !snapshot) return undefined;
    // Short on network fees → the sponsor tops up first, then this same confirmation continues.
    if (gasShort && needWei !== undefined && !(await topUp.run(needWei)).ok) return undefined;
    guard();
    let signingRisk = snapshot;
    let signingMarket = market;
    const revalidate = async () => {
      guard();
      const block = await env.read.getBlock({ blockTag: "latest" });
      const read = pinRead(env.read, block.number);
      const [freshRisk, freshMarket] = await Promise.all([
        readAccountSnapshot(read, env.chainId, address, "latest"),
        readMarketRisk(read, env.chainId, market.marketId),
      ]);
      const freshPositions = await readPositions(read, env.chainId, address, freshRisk.positionBitmap);
      const fresh = previewIncrease({
        market: freshMarket.risk,
        book: freshMarket.book,
        pv: freshMarket.pv,
        account: riskViewOf(freshRisk),
        position: freshPositions.find((p) => p.marketId === market.marketId),
        isLong,
        notionalUsd6,
      });
      const moved =
        fresh.execPrice18 > preview.execPrice18
          ? fresh.execPrice18 - preview.execPrice18
          : preview.execPrice18 - fresh.execPrice18;
      if (
        !freshMarket.enabled ||
        freshMarket.pv.status !== "OPEN" ||
        leverage > freshMarket.maxLeverageX ||
        moved * RISK.BPS > preview.execPrice18 * TRADE_SLIPPAGE_BPS ||
        fresh.issues.length > 0
      )
        throw new Error("Market or quote changed. Review this order again.");
      guard();
      signingRisk = freshRisk;
      signingMarket = { ...market, ...freshMarket };
    };
    const open = positionCount(snapshot.positionBitmap) + (held ? 0 : 1);
    const send = (sender: Sender) =>
      trace.run(
        sender,
        increaseRequest(env.chainId, market.marketId, isLong, notionalUsd6, preview.execPrice18, open),
        {
          revalidate,
          plannedActions: ["increase"],
          reviewedIntent: {
            network: env.chainId === MAINNET_CHAIN_ID ? "mainnet" : "testnet",
            marketId: String(market.marketId),
            symbol: market.symbol,
            side,
            leverage: String(leverage),
            marginUsd6: amountUsd6.toString(),
            lockedUsd6: preview.marginUsd6.toString(),
            notionalUsd6: notionalUsd6.toString(),
            execPrice18: preview.execPrice18.toString(),
            feeUsd6: preview.feeUsd6.toString(),
            sizeDelta: preview.sizeDelta.toString(),
            liqPrice18: preview.liqPrice18 === null ? "" : preview.liqPrice18.toString(),
          },
        },
      );
    // The same reviewed order either way; only the signer differs. A cancelled passkey is silent (nothing signed).
    if (confirmWith === "passkey")
      return stepUp.confirm(
        {
          title: `${side === "long" ? "Long" : "Short"} ${market.symbol} · ${money(notionalUsd6)}`,
          detail: `Above this session’s limits. Margin ${money(amountUsd6)} at ${leverage}×.`,
          confirmLabel: "Open with passkey",
        },
        () => account.stepUp((signer) => send(stepUpSender(signer))),
      );
    return send(
      userSender(client, address, account.settings.faceId, {
        marketRoomUsd6: (id, long) =>
          id === market.marketId
            ? capHeadroomUsd6(signingMarket.risk, signingMarket.book, signingMarket.pv, long)
            : undefined,
        equityUsd6: () => signingRisk.equityInit,
        marketLabel: (id) => (id === market.marketId ? market.name : undefined),
      }),
    );
  };

  return {
    side,
    setSide,
    amountText,
    setAmountText: (text: string) => {
      if (AMOUNT_INPUT.test(text)) setAmount(text);
    },
    amountUsd6,
    setAmountUsd6: (v: bigint) =>
      setAmount(v === 0n ? "" : formatUnits(v, DECIMALS.usd6, DECIMALS.cents, { grouping: false })),
    leverage,
    setLeverage: (v: number) => setLev(Math.max(1, Math.min(v, market.maxLeverageX))),
    notionalUsd6,
    preview,
    maxAmountUsd6,
    snapshot,
    held,
    blocker,
    hasAccount: address !== undefined,
    clientReady: account.client !== undefined,
    trace,
    confirmWith,
    gasStep: topUp.step,
    resetGas: topUp.reset,
    submit,
    intent,
    nowSec,
  };
}
