/**
 * A spot token's buy / sell (J11, `/markets/tokens/[token]/trade?side=`) is the any ↔ any swap (B6) opened on the pair:
 * USDC → the token to buy, the token → USDC to sell. The same quotes (Monorail · KyberSwap), impact rule, review,
 * slide and step-up as every other swap, in the full-height transaction sheet over the token's page.
 */
import { MAINNET_TOKENS } from "@senryo/config";
import { spotToken } from "@senryo/query";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TransactionSheet } from "~/components/sheet/TransactionSheet";
import { QuietLine } from "~/features/markets/QuietLine";
import { SwapView } from "~/features/swap/SwapView";
import { SIZE, SPACE } from "~/theme";

export type TradeSide = "buy" | "sell";

export function TokenTicket({ symbol, side }: { symbol: string; side: TradeSide }) {
  const insets = useSafeAreaInsets();
  const token = spotToken(symbol);
  const usdc = MAINNET_TOKENS.usdc.toLowerCase();
  const close = () => router.back();
  return (
    <TransactionSheet onClose={close} closeLabel="Close the swap">
      <View style={[styles.body, { paddingBottom: insets.bottom + SPACE.sm }]}>
        {token ? (
          <SwapView
            initialPay={side === "buy" ? usdc : token.address}
            initialReceive={side === "buy" ? token.address : usdc}
            onLeave={close}
          />
        ) : (
          <QuietLine>{symbol} isn’t listed on Monad</QuietLine>
        )}
      </View>
    </TransactionSheet>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: SIZE.gutter },
});
