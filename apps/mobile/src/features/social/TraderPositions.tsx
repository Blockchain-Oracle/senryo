/**
 * A trader's open positions (Fomo F16 "Positions", F2 step 5): the market's real mark, ticker and side with the open
 * result at the live oracle price, size in the mode's money and the average entry, and Trade this (C11: the ticket on
 * the same side; the amount stays yours). Read from the chain, shown only while the trader shares this network's
 * trades. A row opens the market. Leverage isn't shown: our engine is cross-margined, so a position has none of its own.
 */
import type { Address } from "@senryo/account";
import type { PositionView } from "@senryo/chain";
import { engineMarket } from "@senryo/config";
import { notional, pnl } from "@senryo/core";
import { ids } from "@senryo/identity";
import { keys, useMarket, usePositions, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ErrorState, Skeleton } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useOpenMarket } from "./navigation";
import { QuietLine } from "./Quiet";
import { TradeThisButton } from "./trade-this";

/** Two placeholder rows: most traders hold one or two engine markets. */
const LOADING_ROWS = ["a", "b"] as const;
const SIZE_SKELETON_WIDTH = 72;
const NAME_SKELETON_WIDTH = "40%";

export function TraderPositions({ address, shared }: { address: Address; shared: boolean }) {
  const network = useNetwork();
  const readOnly = useReadOnlyNetwork();
  if (!shared) return <QuietLine tight text={`Trades private on ${network.modeLabel}`} />;
  if (readOnly) return <QuietLine tight text="Trading opens soon" />;
  return <OpenPositions address={address} />;
}

function OpenPositions({ address }: { address: Address }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const reading = usePositions(address);
  if (reading.status === "unknown") {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Loading positions" accessibilityState={{ busy: true }}>
        {LOADING_ROWS.map((row) => (
          <View key={row} style={styles.row}>
            <Skeleton width={SIZE.markRow} height={SIZE.markRow} />
            <View style={styles.text}>
              <Skeleton width={NAME_SKELETON_WIDTH} />
            </View>
            <Skeleton width={SIZE_SKELETON_WIDTH} />
          </View>
        ))}
      </View>
    );
  }
  if (reading.status === "failed") {
    return (
      <ErrorState
        diagnosis={reading.error}
        retry={() => void client.invalidateQueries({ queryKey: keys.positions(env.chainId, address) })}
      />
    );
  }
  if (reading.value.length === 0) return <QuietLine tight text="No open positions" />;
  return (
    <View>
      {reading.value.map((position) => (
        <PositionLine key={position.marketId} position={position} />
      ))}
    </View>
  );
}

function PositionLine({ position }: { position: PositionView }) {
  const { color } = useTheme();
  const network = useNetwork();
  const market = useMarket(position.marketId);
  const meta = engineMarket(position.marketId);
  const openMarket = useOpenMarket();
  const symbol = meta?.symbol ?? `Market ${position.marketId}`;
  const side = position.isLong ? "Long" : "Short";
  const live = market.status === "fresh" || market.status === "stale" ? market.value : undefined;
  const size = live ? usd(notional(position.size, live.pv.price18)) : undefined;
  const open = live ? pnl(position.isLong, position.size, position.entry, live.pv.price18) : undefined;
  const entry = price18(position.entry, priceDecimalsOf(position.marketId));
  return (
    <Pressable
      onPress={() => {
        if (!meta) return;
        fire("tick");
        openMarket(meta.symbol);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${meta?.name ?? symbol} ${side.toLowerCase()}${size ? `, size ${size}` : ""}${open === undefined ? "" : `, open ${signedUsd(open)}`}, entry ${entry} dollars`}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <EntityMark
        id={ids.engineMarket(network.chainId, position.marketId)}
        size={SIZE.markRow}
        label={symbol}
        decorative
        ground={color.ground}
      />
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={[TYPE.rowTitle, styles.grow, { color: color.ink }]}>
            {symbol} <Text style={{ color: position.isLong ? color.up : color.down }}>{side}</Text>
          </Text>
          {open === undefined ? null : (
            <Text style={[TYPE.rowPrice, { color: open >= 0n ? color.up : color.down }]}>{signedUsd(open)}</Text>
          )}
        </View>
        <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
          {size ?? "…"} · entry ${entry}
        </Text>
      </View>
      {meta ? <TradeThisButton symbol={meta.symbol} side={position.isLong ? "long" : "short"} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
  titleLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  grow: { flex: 1 },
});
