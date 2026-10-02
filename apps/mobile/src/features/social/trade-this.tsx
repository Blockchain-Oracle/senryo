/**
 * "Trade this" (C11, F-D2, F-D3): from a trader's open position — a feed trade row whose position is still open, or a
 * position on their profile — to the order ticket over that market, on the same side. Nothing else is prefilled: the
 * amount is the person's own, and nothing trades by itself (the ticket's review and slide still decide). Leverage is
 * passed only when the source knows it (the feed payload doesn't carry it yet). The ticket names its own blockers
 * (closed market, read-only market, an opposite position); real money asks for eligibility first, as Short / Long do.
 */
import type { FeedTrade } from "@senryo/api-client";
import { engineMarketsOn, MAINNET_CHAIN_ID } from "@senryo/config";
import { type Href, router } from "expo-router";
import { StyleSheet } from "react-native";
import { Button } from "~/components/kit/Button";
import { useInShell } from "~/components/shell/dock-context";
import { hasConfirmedEligibility } from "~/features/legal/eligibility";
import { perplMarketBySymbol } from "~/features/perpl/market";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { marketRoute, ROUTES, type TicketSide, tradeThisRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import type { MarketRef } from "./format";

/** Fills that leave a position open in the trader's direction: the moments worth copying the side of. */
const OPENING_KINDS: ReadonlySet<FeedTrade["fillKind"]> = new Set(["OPEN", "INCREASE"]);

/** A feed trade row offers Trade this while its position is still open and was opened or added to. */
export function tradeIsOpen(trade: FeedTrade): boolean {
  return OPENING_KINDS.has(trade.fillKind) && trade.positionStatus === "OPEN";
}

/** The market trades here: on our engine on this network, or a Perpl market on Mainnet (C4: its own ticket). */
export function useTradable(market: MarketRef | undefined): boolean {
  const network = useNetwork();
  if (market?.engineId !== undefined) return engineMarketsOn(network.chainId).some((m) => m.id === market.engineId);
  return (
    network.chainId === MAINNET_CHAIN_ID && market !== undefined && perplMarketBySymbol(market.symbol) !== undefined
  );
}

export function useTradeThis(): (symbol: string, side: TicketSide, leverage?: number) => void {
  const inShell = useInShell();
  const network = useNetwork();
  const address = useAccount().hint?.address;
  return (symbol, side, leverage) => {
    fire("press");
    const ticket = tradeThisRoute(symbol, side, leverage);
    const market = marketRoute(symbol) as Href;
    // Market detail first, so dismissing the ticket lands on the market; from a root page (a profile) the market
    // returns to the shell instead of stacking a second one (expo-router sends a cross-stack push to the root).
    if (inShell) router.push(market);
    else router.navigate(market);
    requestAnimationFrame(() => {
      if (network.key === "mainnet" && address && !hasConfirmedEligibility(address)) {
        router.push(`${ROUTES.eligibility}?next=${encodeURIComponent(String(ticket))}` as Href);
        return;
      }
      router.push(ticket);
    });
  };
}

/** The compact control a row carries (44 pt plate, quiet fill, sized to its label). */
export function TradeThisButton({ symbol, side }: { symbol: string; side: TicketSide }) {
  const tradeThis = useTradeThis();
  return (
    <Button
      label="Trade this"
      variant="secondary"
      size="sm"
      block={false}
      onPress={() => tradeThis(symbol, side)}
      accessibilityHint={`Opens the ${symbol} ticket on ${side}. You choose the amount`}
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({ button: { alignSelf: "center" } });
