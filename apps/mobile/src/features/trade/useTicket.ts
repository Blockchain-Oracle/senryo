/**
 * The F10 ticket's brain: amount (keypad text, usd6) × leverage → notional; the `@senryo/core` preview against the
 * live market + the account's latest risk; MAX (= what fits in Free to trade, 1¢ reserve, D-162); the first blocker
 * in spec order; and the send — `increase` through `@senryo/chain` with the scoped signer (the session policy sees
 * market room + equity, so an in-scope open signs without a step-up; D-037 Face ID is the policy's call).
 */
import { positionCount, positionGasLimit } from "@senryo/config";
import {
  capHeadroomUsd6,
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
import {
  increaseRequest,
  type LiveMarket,
  riskViewOf,
  useAccountRisk,
  useCalendar,
  useGasBalance,
  useGeo,
  usePositions,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { onlineManager, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { applyKey, type KeypadKey } from "~/components/trade/Keypad";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { draftKey, type Side, useTicketDraft } from "./draft";

export type { Side };
export const DEFAULT_LEVERAGE = 5;
const GAS_PRICE_STALE_MS = 30_000;
const MS_PER_SECOND = 1000n;

export function useTicket(market: LiveMarket) {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const key = draftKey(env.chainId, market.marketId);
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
  const geoValue = geo.status === "fresh" || geo.status === "stale" ? geo.value : undefined;
  const gasPrice = useQuery({
    queryKey: ["chain", env.chainId, "gasPrice"],
    queryFn: () => env.read.getGasPrice(),
    staleTime: GAS_PRICE_STALE_MS,
  });

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
  const preview: IncreasePreview | undefined =
    base && notionalUsd6 > 0n ? previewIncrease({ ...base, notionalUsd6 }) : undefined;
  const maxAmountUsd6 = base ? maxIncreaseNotional(base) / BigInt(leverage) : 0n;

  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  const opensAt =
    calendar.status === "fresh" || calendar.status === "stale"
      ? nextTransition(calendar.value, nowSec, true)
      : undefined;
  const gasBalance = gas.status === "fresh" || gas.status === "stale" ? gas.value : undefined;
  const openAfter = (snapshot ? positionCount(snapshot.positionBitmap) : 0) + (held ? 0 : 1);
  const needWei = gasPrice.data === undefined ? undefined : positionGasLimit("increase", openAfter) * gasPrice.data;
  const hasGas = gasBalance === undefined || needWei === undefined ? true : gasBalance >= needWei;
  const trace = useSendTrace(key);
  const simulationRevert = trace.events.find((e) => e.stage === "failed")?.error;

  const blocker: TradeBlocker | undefined = firstTradeBlocker({
    online,
    mainnet: ACTIVE_NETWORK.modeLabel === "Mainnet",
    geoAllowed: geoValue?.mainnetTradingAllowed,
    country: geoValue?.country ?? null,
    hasAccount: address !== undefined,
    hasGas,
    status: market.pv.status,
    opensAt,
    leverageX: leverage,
    maxLeverageX: market.maxLeverageX,
    preview,
    simulationRevert: simulationRevert instanceof Error ? simulationRevert.message.split("\n")[0] : undefined,
  });

  const submit = async () => {
    const client = account.client;
    if (!client || !address || !preview || !snapshot) return undefined;
    const sender = userSender(client, address, account.settings.faceId, {
      marketRoomUsd6: (id, long) =>
        id === market.marketId ? capHeadroomUsd6(market.risk, market.book, market.pv, long) : undefined,
      equityUsd6: () => snapshot.equityInit,
      marketLabel: (id) => (id === market.marketId ? market.name : undefined),
    });
    const open = positionCount(snapshot.positionBitmap) + (held ? 0 : 1);
    return trace.run(
      sender,
      increaseRequest(env.chainId, market.marketId, isLong, notionalUsd6, preview.execPrice18, open),
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
    blocker,
    hasAccount: address !== undefined,
    ready: account.client !== undefined,
    trace,
    submit,
    nowSec,
  };
}
