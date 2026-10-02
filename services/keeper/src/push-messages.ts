import { type ChainId, type EngineMarket, engineMarket } from "@senryo/config";
import { DECIMALS, formatUnits } from "@senryo/core";
import { ourMarketId } from "@senryo/indexer-client";
import { appLink, dollarsText, type NotificationSubject, pushTitle } from "@senryo/service-common";
import type { Fill } from "./fills.ts";
import type { PushMessage } from "./notify.ts";

/**
 * What each user push says (S1b): a short title, a plain-words body, the screen a tap opens, and the subject the
 * inbox row draws its mark from (G1). Practice pushes say so in the title and write money as P$; market prices are
 * dollars on both networks, with the market's own display decimals (`pushTitle`, `dollarsText`, `appLink` in
 * service-common). Only what the job knows is stated — no P&L, no numbers it didn't read.
 */

type MarketText = Pick<EngineMarket, "id" | "name" | "priceDecimals"> & { symbol: string };

const ACCOUNT: NotificationSubject = { kind: "account" };

/** Every engine market id is in ENGINE_MARKETS; the fallback only keeps a push readable if one is ever missing. */
function marketText(marketId: number): MarketText {
  return (
    engineMarket(marketId) ?? {
      id: marketId,
      symbol: String(marketId),
      name: `Market ${marketId}`,
      priceDecimals: DECIMALS.cents,
    }
  );
}

function price(market: MarketText, value18: bigint): string {
  return `$${formatUnits(value18, DECIMALS.e18, market.priceDecimals)}`;
}

const marketSubject = (marketId: number): NotificationSubject => ({ kind: "market", marketId: ourMarketId(marketId) });
const positionLink = (chainId: ChainId, marketId: number) => appLink(chainId, `positions/${marketId}`);

/** "Gold crossed $4,200.00" — the alert's level and direction, and the accepted price that crossed it. */
export function priceAlertPush(
  chainId: ChainId,
  marketId: number,
  direction: "above" | "below",
  level18: bigint,
  now18: bigint,
): PushMessage {
  const market = marketText(marketId);
  const moved = direction === "above" ? "rose above" : "fell below";
  return {
    title: pushTitle(chainId, `${market.name} crossed ${price(market, level18)}`),
    body: `${market.name} ${moved} the ${price(market, level18)} alert you set. It's now ${price(market, now18)}.`,
    url: appLink(chainId, `markets/${market.symbol}`),
    subject: marketSubject(market.id),
  };
}

/**
 * Cross margin: the whole account nears liquidation, not one position. With a single open position the tap opens
 * it; otherwise Home. Repeat warnings replace the one on screen (collapse key) instead of stacking.
 */
export function healthWarningPush(chainId: ChainId, soleMarketId: number | undefined): PushMessage {
  return {
    title: pushTitle(chainId, "Your account is close to liquidation"),
    body: "Add margin or reduce a position to keep your trades open.",
    url: soleMarketId === undefined ? appLink(chainId) : positionLink(chainId, soleMarketId),
    subject: soleMarketId === undefined ? ACCOUNT : marketSubject(soleMarketId),
    collapseKey: `health:${chainId}`,
  };
}

/** The amount credited by the sweep (its `Deposited` events), when the receipt had them. */
export function depositArrivedPush(chainId: ChainId, creditedUsd6: bigint): PushMessage {
  return {
    title: pushTitle(chainId, "Your deposit has arrived"),
    body:
      creditedUsd6 > 0n ? `${dollarsText(chainId, creditedUsd6)} is now in your account.` : "It's now in your account.",
    url: appLink(chainId, "activity"),
    subject: ACCOUNT,
  };
}

/** "Stop loss closed your Gold long" — at the fill price from the receipt; a partial size says the rest stays. */
export function triggerFillPush(
  chainId: ChainId,
  order: { marketId: number; isLong: boolean; takeProfit: boolean },
  fill: Fill | undefined,
): PushMessage {
  const market = marketText(order.marketId);
  const kind = order.takeProfit ? "Take profit" : "Stop loss";
  const side = order.isLong ? "long" : "short";
  const closed = fill === undefined || fill.sizeAfter === 0n;
  const filled = fill === undefined ? "It filled" : `It filled at ${price(market, fill.execPrice18)}`;
  return {
    title: pushTitle(chainId, `${kind} ${closed ? "closed" : "reduced"} your ${market.name} ${side}`),
    body: closed ? `${filled}.` : `${filled}. The rest of the position stays open.`,
    url: positionLink(chainId, market.id),
    subject: marketSubject(market.id),
  };
}

/** One push per liquidation transaction, naming the markets it closed (cross margin closes them together). */
export function liquidatedPush(chainId: ChainId, fills: readonly Fill[]): PushMessage {
  const [only] = fills;
  const reason = "Your account fell below the margin it needs to stay open";
  if (fills.length === 1 && only) {
    const market = marketText(only.marketId);
    return {
      title: pushTitle(chainId, `Your ${market.name} position was liquidated`),
      body: `${reason}, so it was closed at ${price(market, only.execPrice18)}.`,
      url: positionLink(chainId, market.id),
      subject: marketSubject(market.id),
    };
  }
  const names = fills.map((f) => marketText(f.marketId).name);
  const which = names.length === 2 ? `${names[0]} and ${names[1]} positions` : `${names.length || "open"} positions`;
  return {
    title: pushTitle(chainId, `Your ${which} were liquidated`),
    body: `${reason}, so they were closed.`,
    url: appLink(chainId),
    subject: ACCOUNT,
  };
}
