import { Redirect } from "expo-router";
import { ROUTES } from "~/lib/constants/routes";

/**
 * Old "move wallet funds into trading" links: the split is gone from user flows (BD-3) — a dollar asset is one row in
 * Assets and every action pulls from wherever it sits — so this lands on Home.
 */
export default function WalletFundingRedirect() {
  return <Redirect href={ROUTES.home} />;
}
