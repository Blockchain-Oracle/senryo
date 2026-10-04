/**
 * One page per asset (flow book B2; plan §0.9 "Asset detail"): the mark, name and symbol in the bar (a check when
 * verified), the price and 24 h change, the pool chart where one exists (never for a stablecoin, never faked), your
 * balance with the dollar breakdown, the action circles Receive · Send · Swap · Withdraw (+ Buy where Ramp lists it)
 * — each opening its flow with this asset preselected, or saying in ≤ 4 words why not — the own ↔ trade cross-link
 * (XAUt0 → the XAU market; MON/BTC/ETH → their Perpl perps on Mainnet), About, and this asset's activity. An
 * unverified token gets the banner with Hide.
 */
import { isDeployed } from "@senryo/chain";
import { type ChainId, isChainId, MAINNET_CHAIN_ID, MAINNET_TOKENS, networkOf } from "@senryo/config";
import { QueryEnvProvider, spotToken, useAccountRisk, useQueryEnv, useTokenPrices } from "@senryo/query";
import { type Href, router, Stack } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowDownUp, ArrowUp, CircleCheck, CreditCard, Download, Send } from "~/components/kit/symbols";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { PositionRowsSkeleton } from "~/features/home/HomeParts";
import { PageHeader, PageTitle } from "~/features/markets/PageHeader";
import { ActionCircle, ActionCircles } from "~/features/money/ActionCircle";
import { AssetMark } from "~/features/money/AssetMark";
import { useHiddenTokens } from "~/features/money/hidden";
import { rampAssetOf } from "~/features/money/ramp";
import { useRampBuy } from "~/features/money/useRampBuy";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { tokenPrice } from "~/features/tokens/format";
import { TokenChart } from "~/features/tokens/TokenChart";
import { useAccount } from "~/lib/account/provider";
import { sharedRead } from "~/lib/account/sender";
import {
  discoverRoute,
  marketRoute,
  ROUTES,
  receiptRoute,
  receiveRoute,
  sendRoute,
  swapRoute,
  withdrawRoute,
} from "~/lib/constants/routes";
import { ENV } from "~/lib/env";
import { arrow, signedPct } from "~/lib/money";
import { setActiveNetwork, useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { AboutSection, AssetActivity, BalanceSection, FactRow, UnverifiedBanner } from "./AssetSections";
import { isStable, useAsset } from "./useAsset";

/** Tokens whose Perpl perp the page links to (Mainnet), by symbol. */
const PERPL_OF: Readonly<Record<string, string>> = {
  MON: "MON",
  WBTC: "BTC",
  CBBTC: "BTC",
  "BTC.B": "BTC",
  WETH: "ETH",
};

export function AssetDetail({ chainId, address }: { chainId: number; address: string }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  if (!isChainId(chainId))
    return (
      <Page title="Asset">
        <QuietLine>Unsupported network</QuietLine>
      </Page>
    );
  return (
    <QueryEnvProvider
      chainId={chainId}
      read={sharedRead(chainId)}
      api={env.api}
      indexer={env.indexer}
      apiOrigin={ENV.API_ORIGIN}
    >
      <Detail address={address} chainId={chainId} ground={color.ground} />
    </QueryEnvProvider>
  );
}

function Page({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader {...(right ? { right } : {})}>
        <PageTitle>{title}</PageTitle>
      </PageHeader>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function Detail({ address, chainId, ground }: { address: string; chainId: ChainId; ground: string }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const active = useNetwork();
  const network = networkOf(chainId);
  const account = useAccount();
  const me = account.hint?.address;
  const readOnly = active.chainId !== chainId;
  const page = useAsset(address);
  const rampBuy = useRampBuy(chainId);
  const hidden = useHiddenTokens(network.chainId, me);
  const asset = page.asset;
  const spot = asset && network.chainId === MAINNET_CHAIN_ID ? spotToken(asset.key) : undefined;
  const spotPrices = useTokenPrices(spot ? [spot] : []);
  const coreReady = isDeployed(network.chainId, "SenryoCore");
  const risk = useAccountRisk(!readOnly && coreReady && asset?.collateral ? me : undefined, "finalized");
  if (!asset) {
    return (
      <Page title="Asset">
        {page.failed ? (
          <QuietLine action={{ label: "Back", onPress: () => router.back() }}>Couldn’t load this asset</QuietLine>
        ) : (
          <PositionRowsSkeleton rows={2} />
        )}
      </Page>
    );
  }
  const practice = network.key === "testnet";
  const spotPrice =
    spotPrices.status === "fresh" || spotPrices.status === "stale" ? spotPrices.value[0]?.priceUsd18 : undefined;
  const price = asset.priceUsd18 ?? spotPrice ?? null;
  const stable = isStable(asset);
  const change = asset.change24hBps;
  const holds = risk.status === "fresh" || risk.status === "stale" ? risk.value.holds : 0n;
  const ramp = rampAssetOf(network.chainId, asset.key);
  const perp = network.chainId === MAINNET_CHAIN_ID ? PERPL_OF[asset.symbol.toUpperCase()] : undefined;
  const gold = asset.key === MAINNET_TOKENS.xaut0.toLowerCase();
  const none = asset.total === 0n;
  const hide = () => {
    hidden.hide(asset.key);
    if (router.canGoBack()) router.back();
  };
  const goHomeTab = (tab: "positions" | "assets") => {
    storage.set(STORAGE_KEYS.homeTab, tab);
    router.navigate(ROUTES.home);
  };
  return (
    <View style={[styles.fill, { backgroundColor: ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader>
        <View style={styles.identity}>
          <AssetMark asset={asset} size={SIZE.markRow} ground={ground} />
          <View style={styles.grow}>
            <View style={styles.titleLine}>
              <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
                {asset.verified ? asset.name : asset.symbol}
              </Text>
              {asset.verified ? (
                <CircleCheck size={SIZE.iconSm} color={color.link} accessibilityLabel="Verified" />
              ) : null}
            </View>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{asset.symbol}</Text>
          </View>
        </View>
      </PageHeader>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xxl }]}>
        {!asset.verified ? <UnverifiedBanner asset={asset} onHide={hide} /> : null}
        {hidden.has(asset.key) ? (
          <QuietLine action={{ label: "Show", onPress: () => hidden.show(asset.key) }}>Hidden from Assets</QuietLine>
        ) : null}
        <View style={styles.price}>
          <Text accessibilityRole="header" style={[TYPE.displayPrice, { color: price ? color.ink : color.text3 }]}>
            {price ? tokenPrice(price) : "No price"}
          </Text>
          {change !== null && !stable ? (
            <Text style={[TYPE.rowChange, { color: change >= 0 ? color.up : color.down }]}>
              {arrow(BigInt(change))} {signedPct(BigInt(change))} 24h
            </Text>
          ) : null}
        </View>
        {spot && !stable ? <TokenChart token={spot} priceUsd18={price ?? undefined} /> : null}
        {readOnly ? (
          <View style={styles.price}>
            <QuietLine>
              {network.key === "mainnet"
                ? "Browse Mainnet tokens in Practice. Switch to use real funds."
                : "Browse Practice tokens. Switch to use paper funds."}
            </QuietLine>
            <SlideToConfirm
              direction="left"
              label={`Slide left to switch to ${network.key === "mainnet" ? "Mainnet" : "Practice"}`}
              resetKey={`${active.chainId}:${chainId}`}
              onConfirm={() => {
                account.lock();
                setActiveNetwork(network.key);
              }}
            />
          </View>
        ) : (
          <>
            <BalanceSection
              asset={asset}
              chainId={network.chainId}
              holdsUsd6={asset.collateral ? holds : 0n}
              onTrades={() => goHomeTab("positions")}
              onCard={() => router.navigate(ROUTES.card)}
            />
            <ActionCircles>
              <ActionCircle icon={Download} label="Receive" onPress={() => router.push(receiveRoute(asset.key))} />
              <ActionCircle
                icon={Send}
                label="Send"
                reason={none ? "None to send" : undefined}
                note={asset.verified ? undefined : "Warned"}
                onPress={() => router.push(sendRoute(asset.key))}
              />
              <ActionCircle
                icon={ArrowDownUp}
                label="Swap"
                reason={practice ? "Mainnet only" : !asset.verified && none ? "Unverified" : undefined}
                note={asset.verified ? undefined : "Unverified · sell only"}
                onPress={() => router.push(none ? swapRoute(undefined, asset.key) : swapRoute(asset.key))}
              />
              <ActionCircle
                icon={ArrowUp}
                label="Withdraw"
                reason={none ? "None to withdraw" : undefined}
                onPress={() => router.push(withdrawRoute(asset.key))}
              />
              {ramp && me ? (
                <ActionCircle
                  icon={CreditCard}
                  label="Buy"
                  reason={rampBuy.opening ? "Opening Ramp" : undefined}
                  onPress={() => void rampBuy.buy(asset)}
                />
              ) : null}
            </ActionCircles>
          </>
        )}
        {gold && !readOnly ? (
          <FactRow
            label="Gold, with leverage"
            value="Trade XAU"
            onPress={() => router.push(marketRoute("XAU") as Href)}
          />
        ) : null}
        {perp && !readOnly ? (
          <FactRow
            label="Perpetual on Perpl"
            value={`Trade ${perp}`}
            onPress={() => router.push(discoverRoute(`perpl:${perp}`) as Href)}
          />
        ) : null}
        <AboutSection asset={asset} chainId={network.chainId} networkName={network.name} />
        {me && !readOnly ? (
          <AssetActivity
            asset={asset}
            chainId={network.chainId}
            account={me}
            onOpen={(r) => router.push(receiptRoute(r.id))}
            onAll={() => router.push(ROUTES.activity)}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.xl },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  titleLine: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  grow: { flex: 1, minWidth: 0 },
  price: { gap: SPACE.xs },
});
