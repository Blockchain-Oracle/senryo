/**
 * A trader's open positions (Fomo F16 "Positions", adapted to perps): market with its real mark, side, the position's
 * size at the live oracle price in the mode's money, and the average entry. Read from the chain, shown only when the
 * trader shares this network's trades. Following is not copy trading: a row opens the market, never a ticket.
 */
import type { Address } from "@senryo/account";
import type { PositionView } from "@senryo/chain";
import { engineMarket } from "@senryo/config";
import { notional } from "@senryo/core";
import { ids } from "@senryo/identity";
import { keys, useMarket, usePositions, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ErrorState, Skeleton } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { price18, priceDecimalsOf, usd } from "~/lib/money";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useOpenMarket } from "./navigation";
import { ModeBadge, QuietLine, SectionHeading } from "./Quiet";

/** Two placeholder rows: most traders hold one or two engine markets. */
const LOADING_ROWS = ["a", "b"] as const;
const SIZE_SKELETON_WIDTH = 72;

export function TraderPositions({ address, shared }: { address: Address; shared: boolean }) {
  const network = useNetwork();
  const readOnly = useReadOnlyNetwork();
  if (!shared) {
    return (
      <View style={styles.section}>
        <SectionHeading title="Positions" />
        <QuietLine tight text={`This trader keeps their trades private on ${network.modeLabel}`} />
      </View>
    );
  }
  if (readOnly) {
    return (
      <View style={styles.section}>
        <SectionHeading title="Positions" />
        <QuietLine tight text="Trading isn’t open on Mainnet yet, so there are no positions to show" />
      </View>
    );
  }
  return <OpenPositions address={address} />;
}

function OpenPositions({ address }: { address: Address }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const reading = usePositions(address);
  const positions = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  return (
    <View style={styles.section}>
      <SectionHeading title="Positions" count={positions?.length} trailing={<ModeBadge />} />
      {reading.status === "unknown" ? (
        <View>
          {LOADING_ROWS.map((row) => (
            <View key={row} style={styles.row}>
              <Skeleton width={SIZE.markRow} height={SIZE.markRow} />
              <View style={styles.name}>
                <Skeleton width="40%" />
              </View>
              <Skeleton width={SIZE_SKELETON_WIDTH} />
            </View>
          ))}
        </View>
      ) : null}
      {reading.status === "failed" ? (
        <ErrorState
          diagnosis={reading.error}
          retry={() => void client.invalidateQueries({ queryKey: keys.positions(env.chainId, address) })}
        />
      ) : null}
      {positions && positions.length === 0 ? <QuietLine tight text="No open positions" /> : null}
      {positions && positions.length > 0 ? (
        <View>
          {positions.map((position) => (
            <PositionLine key={position.marketId} position={position} />
          ))}
        </View>
      ) : null}
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
  const entry = price18(position.entry, priceDecimalsOf(position.marketId));
  return (
    <Pressable
      onPress={() => {
        if (!meta) return;
        fire("tick");
        openMarket(meta.symbol);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${meta?.name ?? symbol} ${side.toLowerCase()}${size ? `, size ${size}` : ""}, entry ${entry} dollars`}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <EntityMark
        id={ids.engineMarket(network.chainId, position.marketId)}
        size={SIZE.markRow}
        label={symbol}
        decorative
        ground={color.ground}
      />
      <View style={styles.name}>
        <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
          {meta?.name ?? symbol}
        </Text>
        <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
          {symbol} · <Text style={{ color: position.isLong ? color.up : color.down }}>{side}</Text>
        </Text>
      </View>
      <View style={styles.figures}>
        {size ? (
          <Text style={[TYPE.rowPrice, { color: color.ink }]}>{size}</Text>
        ) : (
          <Skeleton width={SIZE_SKELETON_WIDTH} />
        )}
        <Text style={[TYPE.rowChange, { color: color.text3 }]}>Entry ${entry}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.sm },
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
  name: { flex: 1, gap: SPACE.xxs },
  figures: { alignItems: "flex-end", gap: SPACE.xxs },
});
