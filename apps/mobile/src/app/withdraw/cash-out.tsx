import { Redirect } from "expo-router";
import { withdrawRoute } from "~/lib/constants/routes";

/** Old cash-out links: Withdraw → Another chain (B9). */
export default function CashOutRedirect() {
  return <Redirect href={withdrawRoute(undefined, "chain")} />;
}
