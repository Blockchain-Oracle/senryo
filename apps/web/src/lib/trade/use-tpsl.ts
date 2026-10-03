"use client";

/**
 * TP / SL on a held position (flow book C6, the phone's `useTriggerLegs` reduced to set and cancel): the account signs a
 * `TriggerOrder` with its session (our own domain — in scope, no prompt while unlocked) and places it with
 * `placeTrigger`; a keeper executes it when the oracle crosses. A level is bound to the position instance — it fills
 * `min(sizeDelta, size)`, so "the whole position" is the largest uint128 — and a full close cancels leftovers. The web
 * replaces a level in one operation (place the new one, then cancel the old); each send never resends.
 */
import { type PositionView, pinRead, readAccountSnapshot, readPositions } from "@senryo/chain";
import { DECIMALS, parseUnits, RISK } from "@senryo/core";
import {
  cancelTriggerRequest,
  type LiveMarket,
  placeTriggerRequest,
  triggerOrder,
  useQueryEnv,
  useSendTrace,
  useTriggers,
} from "@senryo/query";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { userSender } from "@/lib/account/sender";
import { useReviewGuard } from "@/lib/review-guard";
import { useEnsureGas } from "./use-gas-top-up";

export type TriggerKind = "sl" | "tp";

const UINT128_BITS = 128n;
/** The contract fills `min(sizeDelta, size)`: the largest uint128 means "all of the position". */
export const WHOLE_POSITION = (1n << UINT128_BITS) - 1n;

/** Long TP and short SL sit above the mark. */
export const isAbove = (kind: TriggerKind, isLong: boolean) => (kind === "tp") === isLong;

/** "4189.06" → 1e18 price, or undefined. */
export function parsePrice(text: string): bigint | undefined {
  const parsed = parseUnits(text, DECIMALS.e18);
  return parsed.ok && parsed.value > 0n ? parsed.value : undefined;
}

/** Why a level can't work for this side (long: liq < SL < mark < TP; short: TP < mark < SL < liq), or undefined. */
export function triggerProblem(
  kind: TriggerKind,
  isLong: boolean,
  price18: bigint,
  mark18: bigint,
  liq18: bigint | null | undefined,
): string | undefined {
  const above = isAbove(kind, isLong);
  const name = kind === "tp" ? "Take profit" : "Stop loss";
  if (above ? price18 <= mark18 : price18 >= mark18) return `${name} must be ${above ? "above" : "below"} the mark`;
  if (kind === "sl" && liq18 !== null && liq18 !== undefined && (isLong ? price18 <= liq18 : price18 >= liq18))
    return "Past the liquidation price";
  return undefined;
}

/** Signed distance of a level from the mark, in bps (for "−5.2% from mark"). */
export function bpsFromMark(mark18: bigint, price18: bigint): bigint {
  return mark18 === 0n ? 0n : ((price18 - mark18) * RISK.BPS) / mark18;
}

export function useTpSl(market: LiveMarket, position: PositionView | undefined) {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const gas = useEnsureGas();
  const base = `tpsl:${env.chainId}:${address ?? "guest"}:${market.marketId}`;
  const tp = useSendTrace(`${base}:tp`);
  const sl = useSendTrace(`${base}:sl`);
  const removal = useSendTrace(`${base}:cancel`);
  const triggers = useTriggers(address);
  const active = (known(triggers) ?? []).filter((t) => t.market_id === `ours-${market.marketId}`);
  const guard = useReviewGuard([env.chainId, address, market.marketId, position?.size ?? ""].join(":"));
  const traces = { tp, sl };

  const sender = () => {
    const client = account.client;
    return client && address ? userSender(client, address, account.settings.faceId) : undefined;
  };

  /**
   * Set a level, or replace the active one of its kind (the phone's behaviour): the new level is placed first, then the
   * replaced one is cancelled as a later step of the SAME operation, so one slide covers both and a failure after the
   * placement stays visible as partial — never a window with no protection, never a resend.
   */
  const place = async (kind: TriggerKind, price18: bigint) => {
    const from = sender();
    if (!from || !address || !position) return undefined;
    const replaced = active.filter((t) => t.takeProfit === (kind === "tp"));
    const placed = await traces[kind].run(
      from,
      () =>
        placeTriggerRequest(
          from,
          triggerOrder({
            user: address,
            marketId: market.marketId,
            isLong: position.isLong,
            takeProfit: kind === "tp",
            triggerPrice18: price18,
            sizeDelta: WHOLE_POSITION,
          }),
        ),
      {
        builderAction: "placeTrigger",
        preflight: (request) => gas.preflight(request)(),
        // A cancel's gas class is "placeTrigger" (`cancelTriggerRequest`), so that is the step it records.
        plannedActions: ["placeTrigger", ...replaced.map(() => "placeTrigger")],
        reviewedIntent: {
          marketId: String(market.marketId),
          leg: kind,
          price: price18.toString(),
          ...(replaced.length > 0 ? { replaces: replaced.map((t) => t.id).join(",") } : {}),
        },
        revalidate: async () => {
          guard();
          const block = await env.read.getBlock({ blockTag: "latest" });
          const pinned = pinRead(env.read, block.number);
          const snapshot = await readAccountSnapshot(pinned, env.chainId, address);
          const held = await readPositions(pinned, env.chainId, address, snapshot.positionBitmap);
          const current = held.find((p) => p.marketId === market.marketId);
          if (!current || current.size !== position.size || current.isLong !== position.isLong)
            throw new Error("The position changed. Review protection again.");
          guard();
        },
      },
    );
    if (placed?.final?.stage !== "finalized" || replaced.length === 0) return placed;
    // The replaced levels go in the same operation (in session: a cancel is reduce-class, no new prompt).
    for (const level of replaced) {
      await removal.run(from, cancelTriggerRequest(env.chainId, level.id as `0x${string}`), {
        preflight: (request) => gas.preflight(request)(),
        operationId: placed.operationId,
      });
    }
    return placed;
  };

  const cancel = async (orderId: string) => {
    const from = sender();
    if (!from) return undefined;
    return removal.run(from, cancelTriggerRequest(env.chainId, orderId as `0x${string}`), {
      preflight: (request) => gas.preflight(request)(),
      reviewedIntent: { marketId: String(market.marketId), cancels: orderId },
    });
  };

  return { active, tp, sl, removal, place, cancel, loading: triggers.status === "unknown" };
}
