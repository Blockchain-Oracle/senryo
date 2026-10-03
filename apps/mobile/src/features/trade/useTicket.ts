/**
 * The F10 ticket's brain: amount (keypad text, usd6) × leverage → notional; the `@senryo/core` preview against the
 * live market + the account's latest risk; MAX (= what fits in Free to trade, 1¢ reserve, D-162); the first blocker
 * in spec order; and the send — `increase` through `@senryo/chain` with the scoped signer (the session policy sees
 * market room + equity, so an in-scope open signs without a step-up; D-037 Face ID is the policy's call).
 */
import { authFailureCopy, classifyAuthError, isSilent, SESSION_MOVE_CAP_USD6 } from "@senryo/account";
import { pinRead, readAccountSnapshot, readMarketRisk, readPositions, type Sender } from "@senryo/chain";
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
} from "@senryo/query";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { applyKey, type KeypadKey } from "~/components/trade/Keypad";
import { type MoneyOperation, useMoneyOperation } from "~/features/money/useMoneyOperation";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender, userSender } from "~/lib/account/sender";
import { activeNetwork } from "~/lib/network";
import { notify } from "~/lib/notify";
import { useReviewGuard } from "~/lib/review-guard";
import { openConfirmLevel } from "./confirm-level";
import { draftKey, type Side, useTicketDraft } from "./draft";
import { planKey, usePlannedTriggers } from "./planned-triggers";
import { useTicketPay } from "./ticket-pay";
import { useEnsureGas, useGasTopUp } from "./useGasTopUp";

export type { Side };
export const DEFAULT_LEVERAGE = 5;
const MS_PER_SECOND = 1000n;

export function useTicket(market: LiveMarket) {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const key = draftKey(env.chainId, market.marketId, address);
  const { draft, update } = useTicketDraft(key, {
    side: "long",
    amountText: "",
    leverage: Math.min(DEFAULT_LEVERAGE, market.maxLeverageX),
  });
  const { side, amountText, leverage } = draft;
  const online = useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline());
  const risk = useAccountRisk(address, "latest");
  const positions = usePositions(address);
  const gas = useGasBalance(address);
  const calendar = useCalendar(market.calendarId);
  const geo = useGeo();
  const protocol = useProtocolState();
  const guardian = protocol.status === "fresh" || protocol.status === "stale" ? protocol.value : undefined;
  const geoValue = geo.status === "fresh" || geo.status === "stale" ? geo.value : undefined;

  const isLong = side === "long";
  const parsed = parseUnits(amountText === "" ? "0" : amountText, DECIMALS.usd6);
  const amountUsd6 = parsed.ok ? parsed.value : 0n;
  const notionalUsd6 = amountUsd6 * BigInt(leverage);
  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const held =
    positions.status === "fresh" || positions.status === "stale"
      ? positions.value.find((p) => p.marketId === market.marketId)
      : undefined;
  // React Compiler memoises these (apps/mobile/src); the previews are pure bigint maths on the live inputs.
  const base = snapshot
    ? { market: market.risk, book: market.book, pv: market.pv, account: riskViewOf(snapshot), position: held, isLong }
    : undefined;
  const own: IncreasePreview | undefined =
    base && notionalUsd6 > 0n ? previewIncrease({ ...base, notionalUsd6 }) : undefined;
  // "Pay with" (C3 step 4): what Free to trade doesn't cover comes from the chosen asset inside the same operation.
  const pay = useTicketPay(env.chainId, address, snapshot?.freeToTrade, ticketNeedUsd6(own, snapshot?.freeToTrade));
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
  const opensAt =
    calendar.status === "fresh" || calendar.status === "stale"
      ? nextTransition(calendar.value, nowSec, true)
      : undefined;
  const gasBalance = gas.status === "fresh" || gas.status === "stale" ? gas.value : undefined;
  const openAfter = (snapshot ? positionCount(snapshot.positionBitmap) : 0) + (held ? 0 : 1);
  // The budget the sender will sign (limit × max fee), estimated per market/side/position count — S8.16b.
  const openRequest = preview
    ? increaseRequest(env.chainId, market.marketId, isLong, notionalUsd6, preview.execPrice18, openAfter)
    : undefined;
  const budget = useGasBudget(address, openRequest, ["increase", market.marketId, side, openAfter]);
  const needWei = budget.data?.needWei;
  const topUp = useGasTopUp();
  const gasShort = gasBalance !== undefined && needWei !== undefined && gasBalance < needWei;
  // A refused top-up blocks only while the balance is still short: MON added another way ("or add MON") clears it.
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
  const trace = useSendTrace(key);
  // Above the session's limits the reviewed order is signed with one passkey step-up instead of failing (Part 1 #1).
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
  // A swap leg always asks for the passkey (rule 11); so does a move whose approval is over the session's move cap.
  // Either way one passkey signs every leg.
  const confirmWith = pay.swapping || pay.incomingUsd6 > SESSION_MOVE_CAP_USD6 ? "passkey" : sessionLevel;
  const fees = useMoneyOperation(key);
  const ensureGas = useEnsureGas();
  const protection = usePlannedTriggers(planKey(env.chainId, address, market.marketId));
  const simulationRevert = trace.events.find((e) => e.stage === "failed")?.error;

  const blocker: TradeBlocker | undefined = firstTradeBlocker({
    online,
    mainnet: env.chainId === MAINNET_CHAIN_ID,
    geoAllowed: geoValue?.mainnetTradingAllowed,
    country: geoValue?.country ?? null,
    hasAccount: address !== undefined,
    gas: gasGate,
    status: market.pv.status,
    opensAt,
    leverageX: leverage,
    maxLeverageX: market.maxLeverageX,
    preview,
    simulationRevert: simulationRevert instanceof Error ? simulationRevert.message.split("\n")[0] : undefined,
    ...(held ? { heldLong: held.isLong } : {}),
    // A guardian pause or settle-only is named before the slide, never left to a raw simulation revert (C3 #9).
    ...(guardian ? { protocol: { ...guardian, now: nowSec } } : {}),
  });

  // What the ticket is showing right now, readable after an await (review R02): a confirmed order may only be sent
  // while its screen is still mounted on the same network and account it was reviewed on.
  const live = useRef({ mounted: true, address });
  live.current.address = address;
  useEffect(() => {
    live.current.mounted = true;
    return () => {
      live.current.mounted = false;
    };
  }, []);

  // What the user chose (the paying asset included), not what the plan derives from live state: once the move to
  // trading lands, Free to trade covers the order and the shortfall reads 0 — that must not stop the open.
  const guard = useReviewGuard(
    [env.chainId, address, market.marketId, side, amountText, leverage, pay.payWith?.key ?? ""].join(":"),
  );
  const submit = async () => {
    const client = account.client;
    if (!client || !address || !preview || !snapshot) return undefined;
    // Pay with another asset: [swap] → [approve] → deposit go first in the same operation (C3 step 4).
    const prefix = await pay.steps(env, address);
    const composed = mainnet || prefix.length > 0;
    // Short on gas → top up first, then continue this same hold (never a dead-end "Adding gas…"; S8.16c).
    if (!composed && gasShort && needWei !== undefined && !(await topUp.run(needWei)).ok) return undefined;
    // The top-up can take seconds. If the ticket closed, or the mode or account changed meanwhile, the reviewed
    // intent is gone: nothing is signed, and a fresh hold is required.
    const now = live.current;
    if (!now.mounted || now.address !== address || activeNetwork().chainId !== env.chainId) return undefined;
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
      const freshPreview = previewIncrease({
        market: freshMarket.risk,
        book: freshMarket.book,
        pv: freshMarket.pv,
        account: riskViewOf(freshRisk),
        position: freshPositions.find((p) => p.marketId === market.marketId),
        isLong,
        notionalUsd6,
      });
      const moved =
        freshPreview.execPrice18 > preview.execPrice18
          ? freshPreview.execPrice18 - preview.execPrice18
          : preview.execPrice18 - freshPreview.execPrice18;
      if (
        !freshMarket.enabled ||
        freshMarket.pv.status !== "OPEN" ||
        leverage > freshMarket.maxLeverageX ||
        moved * RISK.BPS > preview.execPrice18 * TRADE_SLIPPAGE_BPS ||
        freshPreview.issues.length > 0
      ) {
        throw new Error("Market or quote changed. Review this order again.");
      }
      guard();
      signingRisk = freshRisk;
      signingMarket = { ...market, ...freshMarket };
    };
    const open = positionCount(snapshot.positionBitmap) + (held ? 0 : 1);
    const reviewedIntent = {
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
      // The outcome's "Liq." fact comes from the reviewed intent ("" = none above $0).
      liqPrice18: preview.liqPrice18 === null ? "" : preview.liqPrice18.toString(),
      protection: protection.levels.map((level) => `${level.kind}:${level.price18}`).join(","),
      ...pay.intent,
    };
    const openRequest = () =>
      increaseRequest(env.chainId, market.marketId, isLong, notionalUsd6, preview.execPrice18, open);
    const triggers = protection.levels.map(() => "placeTrigger");
    let send = (sender: Sender): Promise<TrackedResult | undefined> =>
      trace.run(sender, openRequest(), { revalidate, plannedActions: ["increase", ...triggers], reviewedIntent });
    if (composed) {
      // One operation: [network fee] → [swap] → [move to trading] → open; the open's deadline is set as it signs.
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
      const ready = mainnet ? await fees.prepare(op) : { ok: true as const, op };
      if (!ready.ok) {
        notify({ title: ready.block, tone: "warning" });
        return undefined;
      }
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
          triggers,
        );
    }
    // The same reviewed order either way; only the signer differs. A cancelled passkey is silent (nothing signed).
    if (confirmWith === "passkey") {
      try {
        return await account.stepUp((signer) => send(stepUpSender(signer)));
      } catch (error) {
        const kind = classifyAuthError(error);
        if (isSilent(kind)) return undefined;
        if (kind === "unknown" && !(error instanceof Error && error.name === "AuthError")) throw error;
        const copy = authFailureCopy(kind, Platform.OS === "ios" ? "ios" : "android");
        notify({ title: copy.title, description: copy.body, tone: "warning" });
        return undefined;
      }
    }
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
    setSide: (s: Side) => update({ side: s }),
    amountText,
    amountUsd6,
    onKey: (k: KeypadKey) => update((d) => ({ amountText: applyKey(d.amountText, k) })),
    setAmountUsd6: (v: bigint) =>
      update({ amountText: v === 0n ? "" : formatUnits(v, DECIMALS.usd6, DECIMALS.cents, { grouping: false }) }),
    leverage,
    setLeverage: (v: number) => update({ leverage: Math.max(1, Math.min(v, market.maxLeverageX)) }),
    notionalUsd6,
    preview,
    maxAmountUsd6,
    snapshot,
    held,
    pay,
    blocker,
    hasAccount: address !== undefined,
    ready: account.client !== undefined,
    trace,
    confirmWith,
    gasStep: topUp.step,
    resetGas: topUp.reset,
    submit,
    nowSec,
  };
}
