import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { WALLET_TITLE, WalletSheetBody } from "~/features/card/WalletRow";

/** `/card/wallet` — Add to Wallet (E5): locked on its named dependency, the same content as the Card tab's sheet. */
export default function AddToWalletScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: WALLET_TITLE }} />
      <WalletSheetBody />
    </Screen>
  );
}
