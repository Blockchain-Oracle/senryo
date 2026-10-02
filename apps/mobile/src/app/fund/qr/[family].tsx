import { type Href, Redirect, useLocalSearchParams } from "expo-router";
import { ROUTES } from "~/lib/constants/routes";

/**
 * Old deposit-address links (`/fund/qr/monad`, `/fund/qr/evm`): Monad is the one wallet address on Receive (the deposit
 * inbox left user flows, B3); other chains are Add money's "From another chain" (B4).
 */
export default function DepositAddressRedirect() {
  const { family } = useLocalSearchParams<{ family: string }>();
  return <Redirect href={family === "monad" ? ROUTES.receive : (`${ROUTES.addMoney}?panel=chain` as Href)} />;
}
