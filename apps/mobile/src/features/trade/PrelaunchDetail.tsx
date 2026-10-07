/**
 * Market detail on Mainnet before the engine deploy (flow book C2 step 6; C1 step 6): the same page — identity, the
 * live Chainlink price on Monad mainnet, the candle chart and what the market is — with the bottom bar as one
 * disabled row, "Opening soon". No ticket and no invented numbers: there is no engine to read open interest or rates
 * from yet.
 */
import { type EngineMarket, MAINNET_CHAIN_ID } from "@senryo/config";
import { ids } from "@senryo/identity";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { MARKET_ABOUT } from "~/features/markets/MarketAbout";
import { MarketActions, marketShareUrl } from "~/features/markets/MarketActions";
import { MarketChart } from "~/features/markets/MarketChart";
import { PageHeader } from "~/features/markets/PageHeader";
import { feedUpdatedAt, usePrelaunchPrice } from "~/features/network/usePrelaunchPrices";
import { price18 } from "~/lib/money";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { LockedBar } from "./SideBar";
import { MarketIdentity } from "./TradeHeader";

const PRICE_DECIMALS = 18;
const DECIMAL_BASE = 10n;
const PRICE_SKELETON = 160;

export function PrelaunchDetail({ meta }: { meta: EngineMarket }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const query = usePrelaunchPrice(meta.id);
  const feed = query.data;
  // The feed's answer in 1e18, as the engine would read it.
  const price = feed ? feed.answer * DECIMAL_BASE ** BigInt(PRICE_DECIMALS - feed.decimals) : undefined;
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <PageHeader
        right={<MarketActions name={meta.name} watchKey={meta.symbol} shareUrl={marketShareUrl(meta.symbol)} />}
      >
        <MarketIdentity
          mark={ids.engineMarket(MAINNET_CHAIN_ID, meta.id)}
          symbol={meta.symbol}
          name={meta.name}
          maxLeverageX={undefined}
        />
      </PageHeader>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]}>
        {price === undefined && query.isError ? (
          <View style={styles.about}>
            <Text style={[TYPE.body, { color: color.text2 }]}>The price feed could not be reached.</Text>
            <Button
              label={query.isFetching ? "Retrying…" : "Retry price"}
              disabled={query.isFetching}
              onPress={() => void query.refetch()}
            />
          </View>
        ) : price === undefined ? (
          <Skeleton width={PRICE_SKELETON} height={SIZE.skeletonRow} />
        ) : (
          <Text
            maxFontSizeMultiplier={HERO_FONT_SCALE}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[TYPE.displayPrice, { color: color.ink }]}
          >
            ${price18(price, meta.priceDecimals)}
          </Text>
        )}
        {feed ? (
          <Text style={[TYPE.meta, { color: color.text2 }]}>
            {feedUpdatedAt(feed)} · Chainlink{query.isError ? " · Refresh failed" : ""}
          </Text>
        ) : null}
        {price === undefined ? null : <MarketChart line={{ symbol: meta.symbol, marketId: meta.id, price18: price }} />}
        <View style={styles.about}>
          <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
            About {meta.name}
          </Text>
          <Text style={[TYPE.body, { color: color.text2 }]}>{MARKET_ABOUT[meta.symbol] ?? meta.name}</Text>
        </View>
      </ScrollView>
      <LockedBar word="Opening soon" />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.xl },
  about: { gap: SPACE.sm },
});
