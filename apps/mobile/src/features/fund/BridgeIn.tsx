/**
 * Deposit from another chain (flow book B4 steps 3–5): the exact amount in the source token's own units, then the live
 * quote — what arrives on Monad (the minimum), the fees, the time and the route with its provider's mark — re-quoted
 * while open, "Quote expired · Refresh" past its expiry. The transfer itself starts on the other chain, signed by the
 * wallet holding the funds there; the app has no connected-wallet or deposit-address route yet (routes.md UNDEFINED-4),
 * so the last step is an honest lock, never a dead button that pretends. Practice: Circle's testnet USDC via CCTP.
 */
import type { BridgeRouteChain } from "@senryo/api-client";
import type { BridgeAsset } from "@senryo/config";
import { anyAssetKeys, useBridgeQuote, useBridgeRoutes, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ReadingView } from "~/components/kit/states";
import { Info } from "~/components/kit/symbols";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { Keypad } from "~/components/trade/Keypad";
import { useAmountInput } from "~/features/money/amount";
import { etaText, providerMark, providerName } from "~/features/money/ChainGrid";
import { ReviewRow, ReviewRows } from "~/features/money/Review";
import { tokenAmount } from "~/features/tokens/format";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { bridgeAssetMark } from "./bridge-assets";

/** No balance to cap a deposit from elsewhere: the route's minimum and the quote say what works. */
const NO_CAP_BITS = 128n;
const NO_CAP = 2n ** NO_CAP_BITS;
const KEYPAD_HEIGHT = 248;
const MS_PER_SECOND = 1000;

export function BridgeIn({ asset, chainId }: { asset: BridgeAsset; chainId: number }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const routes = useBridgeRoutes(asset, "in");
  const retry = () => void client.invalidateQueries({ queryKey: anyAssetKeys.bridgeRoutes(env.chainId, asset, "in") });
  return (
    <ReadingView reading={routes} loading="plate" loadingLabel="Finding the route" retry={retry}>
      {(value) => {
        const chain = value.chains.find((c) => c.chainId === chainId && c.available);
        if (!chain) {
          return <Text style={[TYPE.rowDetail, styles.center]}>No route for {asset} from this chain</Text>;
        }
        return <Quote asset={asset} chain={chain} />;
      }}
    </ReadingView>
  );
}

function Quote({ asset, chain }: { asset: BridgeAsset; chain: BridgeRouteChain }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const client = useQueryClient();
  const address = useAccount().hint?.address;
  const remote = chain.remote[0];
  const decimals = remote?.decimals ?? 0;
  const input = useAmountInput(decimals, null, NO_CAP);
  const [why, setWhy] = useState(false);
  const quote = useBridgeQuote(
    address && remote && input.amount > 0n
      ? {
          fromChain: chain.chainId,
          toChain: env.chainId,
          asset,
          amount: input.amount,
          sender: address,
          recipient: address,
          remote: remote.asset,
        }
      : undefined,
  );
  const q = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const ok = q?.status === "ok" ? q : undefined;
  const expired = ok?.expiresAt != null && ok.expiresAt * MS_PER_SECOND < Date.now();
  const feeUsd6 = ok?.fees.reduce((sum, f) => sum + (f.usd6 ?? 0n), 0n);
  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[TYPE.displayBalance, { color: input.text ? color.ink : color.text3 }]}
        >
          {input.text || "0"} {remote?.symbol}
        </Text>
        <View style={styles.from}>
          <EntityMark id={chain.mark} label={chain.name} size={SIZE.markInline} decorative />
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>From {chain.name}</Text>
        </View>
      </View>
      {input.amount > 0n ? (
        <ReviewRows>
          {ok ? (
            <>
              <ReviewRow
                label="You receive at least"
                value={tokenAmount(ok.minReceived, ok.out.decimals, ok.out.symbol)}
                mark={<EntityMark id={bridgeAssetMark(asset)} label={asset} size={SIZE.markChip} decorative />}
              />
              <ReviewRow label="Fees" value={feeUsd6 !== undefined && feeUsd6 > 0n ? usd(feeUsd6) : "Included"} />
              <ReviewRow label="Time" value={etaText(ok.etaSec)} />
              <ReviewRow
                label="Route"
                value={providerName(ok.provider)}
                mark={
                  <EntityMark
                    id={providerMark(ok.provider)}
                    label={providerName(ok.provider)}
                    size={SIZE.markChip}
                    decorative
                  />
                }
              />
              {expired ? (
                <Pressable
                  onPress={() => void client.invalidateQueries({ queryKey: ["bridge", "quote"] })}
                  accessibilityRole="button"
                >
                  <Text style={[TYPE.rowDetail, { color: color.link }]}>Quote expired · Refresh</Text>
                </Pressable>
              ) : null}
            </>
          ) : q?.status === "unsupported" ? (
            <ReviewRow label="Route" value={q.reason} tone="warn" />
          ) : quote.status === "failed" ? (
            <ReviewRow label="Quote" value="Unavailable · try again" tone="warn" />
          ) : (
            <ReviewRow label="Quote" value="Getting a quote" />
          )}
        </ReviewRows>
      ) : null}
      <View style={styles.keypad}>
        <Keypad onKey={input.key} />
      </View>
      <Button label={`Send from your ${chain.name} wallet · soon`} disabled onPress={() => undefined} />
      <View style={styles.links}>
        <Pressable onPress={() => setWhy(true)} accessibilityRole="button" hitSlop={SPACE.sm} style={styles.link}>
          <Info size={SIZE.iconSm} color={color.text3} />
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
            Why not yet
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push(ROUTES.receive)} accessibilityRole="link" hitSlop={SPACE.sm}>
          <Text style={[TYPE.rowDetail, { color: color.link }]}>Receive on Monad ›</Text>
        </Pressable>
      </View>
      <ChildSheet open={why} onClose={() => setWhy(false)} title="Sending from another chain">
        <Text style={[TYPE.body, { color: color.text2 }]}>
          This transfer starts on {chain.name}, signed by the wallet that holds your {remote?.symbol} there. Connecting
          that wallet is the next step we are building. Until then, withdraw to your Monad address from an exchange, or
          receive from any Monad wallet.
        </Text>
      </ChildSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  center: { textAlign: "center", paddingVertical: SPACE.xl },
  hero: { alignItems: "center", gap: SPACE.xs, paddingVertical: SPACE.md },
  from: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  keypad: { height: KEYPAD_HEIGHT },
  links: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
