/**
 * Our engine's market rows (Fomo F11; flow book C1): the `RowShell` grammar with the market's own art, the ticker and
 * its max-leverage badge, the short name — plus the session word when the market isn't open — and the oracle price
 * over its 24 h change. The mark and ticker are configuration, so they show while the price loads; a failed read says
 * so with a Retry. Before the Mainnet engine deploy the same row shows the live Chainlink price with a lock and "Soon".
 * Long-press stars the market (C10).
 */
import { ENGINE_MARKETS, MAINNET_CHAIN_ID } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { ids } from "@senryo/identity";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { feedUpdatedAt, usePrelaunchPrice } from "~/features/network/usePrelaunchPrices";
import { fire } from "~/feedback/fire";
import { marketRoute } from "~/lib/constants/routes";
import { price18, priceDecimalsOf, signedPct } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { LeverageBadge } from "./LeverageBadge";
import { LockTag, RowShell } from "./RowShell";
import { STATUS_LABEL, statusTone } from "./session";
import { useMarketLine } from "./useMarketLine";
import { useWatchlist } from "./useWatchlist";

export function EngineMarketRow({ marketId, onOpen }: { marketId: number; onOpen?: () => void }) {
  const network = useNetwork();
  const { color } = useTheme();
  const watchlist = useWatchlist();
  const meta = ENGINE_MARKETS.find((m) => m.id === marketId);
  const symbol = meta?.symbol ?? String(marketId);
  const reading = useMarketLine(marketId, meta?.symbol ?? "");
  const client = useQueryClient();
  const retrying = useIsFetching({ queryKey: ["market", network.chainId] }) > 0;
  const open = () => {
    onOpen?.();
    router.push(marketRoute(symbol));
  };
  const star = () => watchlist.toggle(symbol);
  const shared = {
    mark: ids.engineMarket(network.chainId, marketId),
    title: symbol,
    onPress: open,
    onLongPress: star,
    accessibilityHint: "Opens the market. Long-press to star it",
  };
  if (reading.status === "unknown" || reading.status === "failed") {
    const failed = reading.status === "failed";
    return (
      <RowShell
        {...shared}
        subtitle={failed ? "Price unavailable" : (meta?.name ?? "")}
        subtitleTone={failed ? color.warn : undefined}
        price={failed ? null : undefined}
        changeBps={undefined}
        trailing={
          failed ? (
            <Pressable
              onPress={() => {
                fire("tick");
                void client.invalidateQueries({ queryKey: ["market", network.chainId] });
              }}
              disabled={retrying}
              accessibilityRole="button"
              accessibilityLabel={`Retry reading ${meta?.name ?? "the price"}`}
              accessibilityState={{ busy: retrying }}
              hitSlop={SPACE.sm}
              style={[styles.retry, { backgroundColor: color.raised2 }]}
            >
              <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.ink }]}>
                {retrying ? "Retrying…" : "Retry"}
              </Text>
            </Pressable>
          ) : undefined
        }
        accessibilityLabel={`${meta?.name ?? symbol}, ${failed ? "price unavailable" : "reading the price"}`}
      />
    );
  }
  const line = reading.value;
  const change = line.change24hBps;
  const price = `$${price18(line.price18, priceDecimalsOf(marketId))}`;
  const open24 = line.status === "OPEN";
  return (
    <RowShell
      {...shared}
      tag={<LeverageBadge x={line.maxLeverageX} />}
      subtitle={open24 ? line.name : `${line.name} · ${STATUS_LABEL[line.status]}`}
      subtitleTone={open24 ? undefined : statusTone(line.status, color)}
      price={price}
      changeBps={change}
      accessibilityLabel={`${line.name}, ${symbol}${line.maxLeverageX > 0 ? `, up to ${line.maxLeverageX} times leverage` : ""}, ${STATUS_LABEL[line.status]}, ${price}${change === undefined ? "" : `, ${change >= 0n ? "up" : "down"} ${signedPct(change)}`}${watchlist.has(symbol) ? ", starred" : ""}`}
    />
  );
}

/**
 * Mainnet before the engine deploy (C1 step 6): the market stays listed with its live Chainlink price and a lock
 * that says "Soon" — no full-screen prelaunch page. It opens market detail, which says the same.
 */
export function PrelaunchMarketRow({ marketId }: { marketId: number }) {
  const meta = ENGINE_MARKETS.find((m) => m.id === marketId);
  const query = usePrelaunchPrice(marketId);
  const price = query.data;
  const { color } = useTheme();
  const symbol = meta?.symbol ?? String(marketId);
  const shown = price ? `$${formatUnits(price.answer, price.decimals, price.shown)}` : undefined;
  return (
    <RowShell
      mark={ids.engineMarket(MAINNET_CHAIN_ID, marketId)}
      title={symbol}
      tag={<LockTag word="Soon" />}
      subtitle={
        price
          ? `${meta?.name} · ${feedUpdatedAt(price)}${query.isError ? " · Refresh failed" : ""}`
          : query.isError
            ? "Feed could not be reached"
            : (meta?.name ?? "")
      }
      price={shown ?? (query.isError ? null : undefined)}
      changeBps={undefined}
      trailing={
        query.isError ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Retry ${symbol} feed`}
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
            style={[styles.retry, { backgroundColor: color.raised2 }]}
          >
            <Text style={[TYPE.rowDetail, { color: color.ink }]}>{query.isFetching ? "Retrying…" : "Retry"}</Text>
          </Pressable>
        ) : undefined
      }
      onPress={() => router.push(marketRoute(symbol))}
      accessibilityLabel={`${meta?.name ?? symbol}, opening soon${shown && price ? `, ${shown}, ${feedUpdatedAt(price)}` : query.isError ? ", feed could not be reached" : ", reading price"}`}
    />
  );
}

const styles = StyleSheet.create({
  retry: {
    paddingHorizontal: SPACE.md,
    minHeight: SIZE.touch - SPACE.md,
    borderRadius: BUTTON.radius.sm,
    justifyContent: "center",
  },
});
