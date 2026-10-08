import { type Href, router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { NetworkPill, ReceiveCard } from "~/features/fund/ReceiveCard";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SPACE } from "~/theme";

/**
 * Receive (B3, plan §0.9 Receive; Solflare S21): the fan's Receive, an asset page's Receive circle and Add money's
 * "Crypto on Monad" / "From an exchange" all open this compact sheet over the page beneath. One address for every
 * token; `?asset=` preselects a chip, `?from=exchange` leads with the exchange's network tip.
 */
export default function ReceiveSheet() {
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close receive">
      <Body />
    </Sheet>
  );
}

function Body() {
  const close = useSheetClose();
  const address = useAccount().hint?.address;
  const chainId = useNetwork().chainId;
  const { asset, from } = useLocalSearchParams<{ asset?: string; from?: string }>();
  return (
    <View style={styles.stack}>
      <SheetHeading title="Deposit crypto" />
      <NetworkPill />
      {address ? (
        <ReceiveCard
          key={`${chainId}:${address}`}
          address={address}
          preselected={asset?.toLowerCase()}
          exchange={from === "exchange"}
          onOtherChain={() => close(() => router.push(`${ROUTES.addMoney}?panel=chain` as Href))}
        />
      ) : (
        <View style={styles.guest}>
          <SheetHeading title="Sign in to see your address" />
          <Button label="Create account" onPress={() => close(() => router.push(ROUTES.accountRequired))} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  guest: { gap: SPACE.md, paddingVertical: SPACE.lg },
});
