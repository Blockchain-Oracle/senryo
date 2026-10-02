/**
 * Home → Assets (flow book B1; plan §0.9 Home "Assets"): every token at the account's address, largest first — the
 * mark, name, amount (a dollar asset folds in its trading part: "512.00 AUSD · 300.00 in trades"), value and 24 h
 * change. Unverified tokens wait under a collapsed "Other tokens (n)" with no value; hidden ones under "Hidden (n)",
 * where they can be shown again. A row opens the asset's page. Loading is three skeleton rows (never $0); an empty
 * account gets Add money with the method marks; a holdings outage still lists the dollars and MON from the chain.
 */
import { ids } from "@senryo/identity";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { ChevronDown } from "~/components/kit/symbols";
import { PositionRowsSkeleton } from "~/features/home/HomeParts";
import { AssetRow } from "~/features/money/AssetRow";
import type { MoneyAsset } from "~/features/money/assets";
import { useHiddenTokens } from "~/features/money/hidden";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { assetRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const LOADING_ROWS = 3;

export function AssetsTab() {
  const { color } = useTheme();
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const money = useMoneyAssets();
  const hidden = useHiddenTokens(network.chainId, address);
  const open = (a: MoneyAsset) => router.push(assetRoute(network.chainId, a.key));
  if (money.status === "loading") return <PositionRowsSkeleton rows={LOADING_ROWS} />;
  if (money.status === "failed") {
    return <QuietLine action={{ label: "Retry", onPress: money.retry }}>Couldn’t load assets</QuietLine>;
  }
  if (money.assets.length === 0 && money.other.length === 0 && money.hidden.length === 0) return <EmptyAssets />;
  return (
    <View>
      {money.stale && money.error ? <Text style={[TYPE.meta, styles.tag, { color: color.warn }]}>Offline</Text> : null}
      {money.assets.map((a, i) => (
        <AssetRow key={a.key} asset={a} index={i} onPress={() => open(a)} />
      ))}
      {money.degraded ? (
        <QuietLine action={{ label: "Retry", onPress: money.retry }}>Other tokens couldn’t load</QuietLine>
      ) : null}
      <Collapsed label={`Other tokens (${money.other.length})`} rows={money.other} onOpen={open} />
      <Collapsed
        label={`Hidden (${money.hidden.length})`}
        rows={money.hidden}
        onOpen={open}
        action={{ label: "Show", onPress: (a) => hidden.show(a.key) }}
      />
    </View>
  );
}

/** A folded group under the verified rows ("Other tokens (2)", "Hidden (1)"). */
function Collapsed({
  label,
  rows,
  onOpen,
  action,
}: {
  label: string;
  rows: readonly MoneyAsset[];
  onOpen: (a: MoneyAsset) => void;
  action?: { label: string; onPress: (a: MoneyAsset) => void };
}) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <View>
      <Pressable
        onPress={() => {
          fire("tick");
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.toggle}
      >
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
          {label}
        </Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={SPACE.lg} color={color.text2} />
        </View>
      </Pressable>
      {open
        ? rows.map((a, i) => (
            <AssetRow
              key={a.key}
              asset={a}
              index={i}
              onPress={() => onOpen(a)}
              {...(action
                ? {
                    trailing: (
                      <Pressable
                        onPress={() => action.onPress(a)}
                        accessibilityRole="button"
                        accessibilityLabel={`${action.label} ${a.symbol}`}
                        hitSlop={SPACE.sm}
                      >
                        <Text style={[TYPE.rowStrong, { color: color.link }]}>{action.label}</Text>
                      </Pressable>
                    ),
                  }
                : {})}
            />
          ))
        : null}
    </View>
  );
}

/** No assets yet: Add money, with the marks of the ways in (B1 empty state). */
function EmptyAssets() {
  const { color } = useTheme();
  const network = useNetwork();
  return (
    <View style={styles.empty}>
      <MarkCluster
        ids={[ids.evmChain(network.chainId), ids.exchange("coinbase"), ids.native(network.chainId, "MON")]}
        size={SIZE.markToken}
        ground={color.ground}
      />
      <Text style={[TYPE.rowTitle, { color: color.ink }]}>No assets yet</Text>
      <QuietLine action={{ label: "Add money", onPress: () => router.push(ROUTES.addMoney) }}>
        Any token on Monad lands here
      </QuietLine>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { paddingBottom: SPACE.xs },
  toggle: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, paddingVertical: SPACE.sm },
  empty: { alignItems: "center", gap: SPACE.sm, paddingTop: SPACE.lg },
});
