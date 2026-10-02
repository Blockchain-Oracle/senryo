/**
 * A Perpl market page's cross-links (flow book C2 step 4, rule 6): "Your position ›" with its side and size when the
 * wallet holds one on Perpl, and "Own BTC ›" — the spot token that is the asset itself (WBTC, WETH, MON), opening its
 * page — where Monad lists one.
 */
import { spotToken, usePerplPositions } from "@senryo/query";
import { router } from "expo-router";
import { LinkRow } from "~/features/trade/MarketLinks";
import { useAccount } from "~/lib/account/provider";
import { perplPositionRoute, tokenRoute } from "~/lib/constants/routes";
import { perplSize } from "./format";
import type { PerplMarketMeta } from "./market";

/** Which spot token is the Perpl market's asset on Monad (by the Perpl ticker). */
const OWN_TOKEN: Readonly<Record<string, string>> = { MON: "MON", BTC: "WBTC", ETH: "WETH" };

export function PerplHeldRow({ meta }: { meta: PerplMarketMeta }) {
  const positions = usePerplPositions(useAccount().hint?.address);
  const held =
    positions.status === "fresh" || positions.status === "stale"
      ? positions.value.find((p) => p.marketId === meta.marketId)
      : undefined;
  if (!held) return null;
  return (
    <LinkRow
      mark={meta.mark}
      label={meta.symbol}
      title="Your position"
      subtitle={`${held.side === "long" ? "Long" : "Short"} · ${perplSize(held.lots, meta)}`}
      onPress={() => router.push(perplPositionRoute(meta.marketId))}
    />
  );
}

export function PerplOwnRow({ meta }: { meta: PerplMarketMeta }) {
  const symbol = OWN_TOKEN[meta.symbol];
  const token = symbol ? spotToken(symbol) : undefined;
  if (!symbol || !token) return null;
  return (
    <LinkRow
      mark={token.mark}
      label={symbol}
      title={`Own ${meta.symbol}`}
      subtitle={`${symbol} on Monad`}
      onPress={() => router.push(tokenRoute(symbol))}
    />
  );
}
