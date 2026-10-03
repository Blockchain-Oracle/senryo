"use client";

/**
 * The ticket's brain (the phone's `useTicket`, flow book C3): margin (usd6) × leverage → exposure; the `@senryo/core`
 * preview against the live market and the account's latest risk; "Pay with" (C3 step 4: buying power = Free to trade +
 * what the chosen asset brings; the shortfall comes from it in the same operation — wallet AUSD / USDC moved to the
 * trading account, or on Mainnet any verified holding swapped to AUSD first); Max (what fits); the first blocker in
 * spec order (opposite side named before the slide); and the send — `increase` through `@senryo/chain`, alone or as the
 * act of one composed operation ([network fee] → [swap] → [move to trading] → open, B0.4, B11). In the session's scope
 * it signs with the session; above its caps, or with a swap leg, the SAME reviewed order is signed with one passkey
 * step-up. The reviewed intent is frozen at the slide: re-read at the pinned head right before signing, and anything
 * that moved past the bound stops it ("Review again"); the trace never resends.
 */
import { SESSION_MOVE_CAP_USD6 } from "@senryo/account";
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
  type ComposedStep,
  increaseRequest,
  type LiveMarket,
  riskViewOf,
  runOperationSteps,
  TRADE_SLIPPAGE_BPS,
  type TrackedResult,
  ticketNeedUsd6,
  useAccountRisk,
  useCalendar,
  useGasBalance,
  useGasBudget,
  useGeo,
  usePositions,
  useProtocolState,
  useQueryEnv,
  useSendTrace,
  useTicketPay,
} from "@senryo/query";
import { onlineManager } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { useStepUp } from "@/components/auth/step-up";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { stepUpSender, userSender } from "@/lib/account/sender";
import { money } from "@/lib/format";
import { useMoneyAssets } from "@/lib/money/use-money-assets";
import { type MoneyOperation, useMoneyOperation, usePreparedOperation } from "@/lib/money/use-money-operation";
import { useReviewGuard } from "@/lib/review-guard";
import type { Side } from "./commit";
import { openConfirmLevel } from "./confirm-level";
import { useEnsureGas, useGasTopUp } from "./use-gas-top-up";

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
  const own: IncreasePreview | undefined =
    base && notionalUsd6 > 0n ? previewIncrease({ ...base, notionalUsd6 }) : undefined;
  // "Pay with" (C3 step 4): what Free to trade doesn't cover comes from the chosen asset inside the same operation.
  const pay = useTicketPay(
    env.chainId,
    address,
    snapshot?.freeToTrade,
    ticketNeedUsd6(own, snapshot?.freeToTrade),
    useMoneyAssets(address),
  );
  const funded = (extra: bigint) =>
    base && extra > 0n
      ? { ...base, account: { ...base.account, freeToTrade: base.account.freeToTrade + extra } }
      : base;
  const paid = funded(pay.incomingUsd6);
  const preview: IncreasePreview | undefined =
    paid && notionalUsd6 > 0n && pay.incomingUsd6 > 0n ? previewIncrease({ ...paid, notionalUsd6 }) : own;
  const reach = funded(pay.buyingPowerUsd6 !== undefined && snapshot ? pay.buyingPowerUsd6 - snapshot.freeToTrade : 0n);
  const maxAmountUsd6 = reach ? maxIncreaseNotional(reach) / BigInt(leverage) : 0n;
  const mainnet = env.chainId === MAINNET_CHAIN_ID;

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
  // Mainnet pays its own fees in MON: the composed operation plans them (B11), never the practice sponsor.
  const gasGate: GasGate = mainnet
    ? { kind: "ok" }
    : topUp.step.kind === "failed" && topUpRefused
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
  const fees = useMoneyOperation(key);
  const ensureGas = useEnsureGas();
  const sessionLevel = openConfirmLevel({
    client: account.client,
    address,
    faceId: account.settings.faceId,
    marketId: market.marketId,
    isLong,
    notionalUsd6,
    equityUsd6: snapshot?.equityInit,
    roomUsd6: capHeadroomUsd6(market.risk, market.book, market.pv, isLong),
  });
  // A swap leg always asks for the passkey (rule 11); so does a move over the session's move cap. One passkey signs all.
  const confirmWith = pay.swapping || pay.incomingUsd6 > SESSION_MOVE_CAP_USD6 ? "passkey" : sessionLevel;
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

  const payKey = [
    pay.payWith?.key ?? "",
    pay.incomingUsd6,
    pay.swap.status === "ok" ? pay.swap.quote.quote.minOut : "",
  ];
  // B11 before the slide (Mainnet): the composed order's network fee — on the account, "Network fee" first, or named.
  const planned = usePreparedOperation(
    fees,
    mainnet && address && preview && !blocker ? [key, amountText, leverage, ...payKey].join(":") : undefined,
    async () => {
      if (!address || !preview || !snapshot) return undefined;
      const open = positionCount(snapshot.positionBitmap) + (held ? 0 : 1);
      const act: ComposedStep = {
        role: "act",
        action: "increase",
        label: "Open",
        request: increaseRequest(env.chainId, market.marketId, isLong, notionalUsd6, preview.execPrice18, open),
      };
      return {
        steps: [...(await pay.steps(env, address)), act],
        reviewedIntent: {},
        revalidate: async () => undefined,
        spends: pay.payWith
          ? { [pay.payWith.key]: pay.swap.status === "ok" ? pay.swap.amountIn : pay.incomingUsd6 }
          : {},
      };
    },
  );
  // The guard holds what the user chose (the paying asset included), not what the plan derives from live state: once
  // the move to trading lands, Free to trade covers the order and the shortfall reads 0 — that must not stop the open.
  // The plan's figures re-arm the slide instead (`payKey`), and each leg re-checks itself before it signs.
  const intent = [env.chainId, address, market.marketId, side, amountText, leverage, pay.payWith?.key ?? ""].join(":");
  const guard = useReviewGuard(intent);
  const submit = async (): Promise<TrackedResult | string | undefined> => {
    const client = account.client;
    if (!client || !address || !preview || !snapshot) return undefined;
    // Pay with another asset: [swap] → [approve] → move to trading go first in the same operation (C3 step 4).
    const prefix = await pay.steps(env, address);
    const composed = mainnet || prefix.length > 0;
    // Short on network fees (Practice, the order alone) → the sponsor tops up first, then this confirmation continues.
    if (!composed && gasShort && needWei !== undefined && !(await topUp.run(needWei)).ok) return undefined;
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
    const reviewedIntent = {
      network: mainnet ? "mainnet" : "testnet",
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
      ...pay.intent,
    };
    const openRequest = () =>
      increaseRequest(env.chainId, market.marketId, isLong, notionalUsd6, preview.execPrice18, open);
    let feeSwap = false;
    let send = (sender: Sender): Promise<TrackedResult | undefined> =>
      trace.run(sender, openRequest(), { revalidate, plannedActions: ["increase"], reviewedIntent });
    if (composed) {
      // One operation: [network fee] → [swap] → [move to trading] → open; the open is built as it signs.
      const openStep: ComposedStep = {
        role: "act",
        action: "increase",
        label: "Open",
        request: openRequest(),
        build: async () => openRequest(),
      };
      const steps = [...prefix, openStep];
      const op: MoneyOperation = {
        steps,
        reviewedIntent,
        revalidate: async (index) => (index === steps.length - 1 ? revalidate() : guard()),
        spends: pay.payWith
          ? { [pay.payWith.key]: pay.swap.status === "ok" ? pay.swap.amountIn : pay.incomingUsd6 }
          : {},
      };
      // B11: MON on hand, or "Network fee" first in the same operation, or the named shortfall — never a dead end.
      const ready = await fees.prepare(op);
      if (!ready.ok) return ready.block;
      // A fee swap is a swap: it asks for the passkey too (rule 11).
      feeSwap = ready.fee === "top-up";
      send = (sender) =>
        runOperationSteps<TrackedResult>(
          ready.op.steps,
          ready.op.reviewedIntent,
          (step, index, options) =>
            trace.run(sender, step.build ?? step.request, {
              ...options,
              revalidate: () => ready.op.revalidate(index),
              ...(mainnet ? {} : { preflight: ensureGas.preflight(step.request) }),
            }),
          { read: env.read },
        );
    }
    // The same reviewed order either way; only the signer differs. A cancelled passkey is silent (nothing signed).
    if (confirmWith === "passkey" || feeSwap)
      return stepUp.confirm(
        {
          title: `${side === "long" ? "Long" : "Short"} ${market.symbol} · ${money(notionalUsd6)}`,
          detail: pay.swapping
            ? `Paid with ${pay.payWith?.symbol ?? "AUSD"}, swapped to AUSD first. Margin ${money(amountUsd6)} at ${leverage}×. One passkey signs every step.`
            : feeSwap
              ? `MON for the network fee is swapped in first. Margin ${money(amountUsd6)} at ${leverage}×.`
              : `Above this session’s limits. Margin ${money(amountUsd6)} at ${leverage}×.`,
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
    pay,
    mainnet,
    /** Mainnet: the order's planned steps with its network fee (Details), or why the fee can't be paid. */
    planned: planned.data,
    blocker,
    hasAccount: address !== undefined,
    clientReady: account.client !== undefined,
    trace,
    confirmWith,
    gasStep: topUp.step,
    resetGas: topUp.reset,
    submit,
    intent,
    /** The pay plan's figures (shortfall moved, swap minimum): a change re-arms the slide before it confirms. */
    payKey: payKey.join(":"),
    nowSec,
  };
}
