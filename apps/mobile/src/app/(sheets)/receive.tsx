import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { NetworkPill, ReceiveCard } from "~/features/wallet/ReceiveCard";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SPACE } from "~/theme";

/**
 * Receive (B3; Solflare S21): the fan's Receive opens this compact sheet over the page beneath — one address on Monad
 * for dollars. "Sending from another chain?" opens Add money's any-chain route once it exists (Aurora, S9).
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
  return (
    <View style={styles.stack}>
      <SheetHeading title="Receive dollars" />
      <NetworkPill />
      {address ? (
        <ReceiveCard
          key={`${chainId}:${address}`}
          address={address}
          onOtherChain={() => close(() => router.push(ROUTES.home))}
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
