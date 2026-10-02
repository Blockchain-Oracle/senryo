/**
 * What a finalized Perpl transaction actually did, from its events — never from the receipt status. An IOC that
 * matches nothing still succeeds: mainnet `eth_simulateV1` (2 Oct 2026) of an IOC long priced 10 % under the mark
 * returned status 1 with only `OrderRequestV2` + `ImmediateOrCancelExecuted(unmatched = total)`.
 *
 * Contract 1.7.5 emits, in log order, for one `execOrder`: `OrderRequestV2` (perpId, accountId — the taker), then per
 * matched maker its position event + `MakerOrderFilledV2`, the taker's own position event(s) (`PositionOpenedV2` /
 * `PositionIncreasedV2` / `PositionDecreased` / `PositionClosed` / `PositionInverted`, carrying the taker's accountId),
 * and one `TakerOrderFilledV2` (lots, average entry price, fee, balance after). Unfilled size shows as
 * `ImmediateOrCancelExecuted(unmatchedLotLNS, totalLotLNS)`; a walk cut at `maxMatches` as `MaxMatchesReached`. Only
 * logs emitted by the Exchange itself are read, and position events are kept only for the taker's account (maker
 * accounts' changes ride in the same receipt).
 */
import { type ChainId, PERPL_EXCHANGE, PERPL_POSITION_TYPE } from "@senryo/config";
import { perplExchangeAbi } from "@senryo/contracts/external";
import { type Log, parseEventLogs } from "viem";
import type { PerplSide } from "./math.ts";

/** The events of `logs` emitted by the Perpl Exchange on `chainId`, decoded, in log order. */
export function perplEvents(logs: readonly Log[], chainId: ChainId) {
  const exchange = PERPL_EXCHANGE[chainId].toLowerCase();
  const own = logs.filter((log) => log.address.toLowerCase() === exchange);
  return parseEventLogs({ abi: perplExchangeAbi, logs: own, strict: true });
}

type ExchangeEvent = ReturnType<typeof perplEvents>[number];

export type PerplPositionChange =
  | { kind: "opened" | "increased"; side: PerplSide; lotsAfter: bigint; entryPricePNS: bigint; depositCNS: bigint }
  | { kind: "decreased"; side: PerplSide; lotsAfter: bigint; realizedPnlCNS: bigint; fundingCNS: bigint }
  | { kind: "closed"; side: PerplSide; exitPricePNS: bigint; realizedPnlCNS: bigint; fundingCNS: bigint }
  | { kind: "inverted"; side: PerplSide; lotsAfter: bigint; entryPricePNS: bigint; realizedPnlCNS: bigint };

export interface PerplFill {
  marketId: number;
  accountId: bigint;
  orderType: number;
  requestedLots: bigint;
  filledLots: bigint;
  /** Lots the IOC cancelled (requested − filled). */
  unmatchedLots: bigint;
  /** Volume-weighted entry price of the taker fill (PNS); 0 when nothing filled. */
  avgPricePNS: bigint;
  feeCNS: bigint;
  /** Collateral moved by the fill (negative = into the position) and the account balance after it. */
  amountCNS: bigint;
  balanceAfterCNS: bigint | undefined;
  /** The walk stopped at `maxMatches` before the book or the price bound did. */
  maxMatchesReached: boolean;
  /** The taker's position changes, in order. */
  position: PerplPositionChange[];
}

export type PerplOrderOutcome =
  | ({ kind: "filled" } & PerplFill)
  | ({ kind: "partial" } & PerplFill)
  /** Nothing matched within the price bound: "Price moved — nothing opened." */
  | ({ kind: "unfilled" } & PerplFill)
  /** No order request from the Exchange in these logs (wrong receipt, or the order reverted). */
  | { kind: "no-order" };

const sideOf = (positionType: number): PerplSide => (positionType === PERPL_POSITION_TYPE.long ? "long" : "short");

function positionChange(e: ExchangeEvent, accountId: bigint): PerplPositionChange | undefined {
  if (!("accountId" in e.args) || e.args.accountId !== accountId) return undefined;
  switch (e.eventName) {
    case "PositionOpenedV2":
      return {
        kind: "opened",
        side: sideOf(e.args.positionType),
        lotsAfter: e.args.lotLNS,
        entryPricePNS: e.args.pricePNS,
        depositCNS: e.args.depositCNS,
      };
    case "PositionIncreasedV2":
      return {
        kind: "increased",
        side: sideOf(e.args.positionType),
        lotsAfter: e.args.endLotLNS,
        entryPricePNS: e.args.pricePNS,
        depositCNS: e.args.endDepositCNS,
      };
    case "PositionDecreased":
      return {
        kind: "decreased",
        side: sideOf(e.args.positionType),
        lotsAfter: e.args.endLotLNS,
        realizedPnlCNS: e.args.deltaPnlCNS,
        fundingCNS: e.args.fundingCNS,
      };
    case "PositionClosed":
      return {
        kind: "closed",
        side: sideOf(e.args.positionType),
        exitPricePNS: e.args.pricePNS,
        realizedPnlCNS: e.args.deltaPnlCNS,
        fundingCNS: e.args.fundingCNS,
      };
    case "PositionInverted":
      return {
        kind: "inverted",
        side: sideOf(e.args.positionType),
        lotsAfter: e.args.endLotLNS,
        entryPricePNS: e.args.pricePNS,
        realizedPnlCNS: e.args.deltaPnlCNS,
      };
    default:
      return undefined;
  }
}

/**
 * The outcome of the one `execOrder` in a finalized receipt's logs. `filled` only when every requested lot matched;
 * `partial` when some did; `unfilled` when none did — each with the decoded numbers.
 */
export function decodePerplOrder(logs: readonly Log[], chainId: ChainId): PerplOrderOutcome {
  const events = perplEvents(logs, chainId);
  const start = events.findIndex((e) => e.eventName === "OrderRequestV2");
  const request = events[start];
  if (request?.eventName !== "OrderRequestV2") return { kind: "no-order" };
  const { accountId, perpId, orderType, lotLNS: requestedLots } = request.args;
  const fill: PerplFill = {
    marketId: Number(perpId),
    accountId,
    orderType,
    requestedLots,
    filledLots: 0n,
    unmatchedLots: requestedLots,
    avgPricePNS: 0n,
    feeCNS: 0n,
    amountCNS: 0n,
    balanceAfterCNS: undefined,
    maxMatchesReached: false,
    position: [],
  };
  let notional = 0n;
  for (const e of events.slice(start + 1)) {
    if (e.eventName === "OrderRequestV2" || e.eventName === "OrderBatchCompleted") break;
    if (e.eventName === "TakerOrderFilledV2") {
      fill.filledLots += e.args.lotLNS;
      notional += e.args.lotLNS * e.args.entryPricePNS;
      fill.feeCNS += e.args.feeCNS;
      fill.amountCNS += e.args.amountCNS;
      fill.balanceAfterCNS = e.args.balanceCNS;
    } else if (e.eventName === "MaxMatchesReached") {
      fill.maxMatchesReached = true;
    } else {
      const change = positionChange(e, accountId);
      if (change) fill.position.push(change);
    }
  }
  fill.unmatchedLots = requestedLots > fill.filledLots ? requestedLots - fill.filledLots : 0n;
  fill.avgPricePNS = fill.filledLots > 0n ? notional / fill.filledLots : 0n;
  if (fill.filledLots === 0n) return { kind: "unfilled", ...fill };
  return { kind: fill.unmatchedLots === 0n ? "filled" : "partial", ...fill };
}

export type PerplCollateralEvent =
  | { kind: "account-created"; accountId: bigint }
  | { kind: "deposit" | "withdrawal"; accountId: bigint; amountCNS: bigint; balanceAfterCNS: bigint };

/** Account creation, deposits and withdrawals in a receipt's logs (confirms the funding steps from events). */
export function decodePerplCollateral(logs: readonly Log[], chainId: ChainId): PerplCollateralEvent[] {
  return perplEvents(logs, chainId).flatMap((e): PerplCollateralEvent[] => {
    if (e.eventName === "AccountCreated") return [{ kind: "account-created", accountId: e.args.id }];
    if (e.eventName === "CollateralDeposit" || e.eventName === "CollateralWithdrawal")
      return [
        {
          kind: e.eventName === "CollateralDeposit" ? "deposit" : "withdrawal",
          accountId: e.args.accountId,
          amountCNS: e.args.amountCNS,
          balanceAfterCNS: e.args.balanceCNS,
        },
      ];
    return [];
  });
}

/**
 * Journal facts for the Exchange's logs in a receipt: every event of the wallet's own account, stringified, without
 * the maker accounts' fills and position changes that share the receipt (they are other people's).
 */
export function perplReceiptFacts(
  logs: readonly Log[],
  chainId: ChainId,
): { event: string; contract: string; values: Record<string, string> }[] {
  const events = perplEvents(logs, chainId);
  const ownerEvent = events.find((e) => e.eventName === "OrderRequestV2" || e.eventName === "CollateralDeposit");
  const own = ownerEvent && "accountId" in ownerEvent.args ? ownerEvent.args.accountId : undefined;
  return events.flatMap((e) => {
    if (e.eventName === "MakerOrderFilledV2") return [];
    if ("accountId" in e.args && own !== undefined && e.args.accountId !== own) return [];
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(e.args)) {
      if (["bigint", "string", "boolean", "number"].includes(typeof value)) values[key] = String(value);
    }
    return [{ event: e.eventName, contract: e.address, values }];
  });
}
