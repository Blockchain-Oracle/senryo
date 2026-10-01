import { Redirect } from "expo-router";
import { ROUTES } from "~/lib/constants/routes";

/**
 * `/fund` was a tab until the S1b.7 shell (D-176); Fund became the add-money hub. Home is established underneath and
 * opens the hub over itself (Codex S1b.7 consult #8), so dismissing it lands on Home.
 */
export default function FundRedirect() {
  return <Redirect href={ROUTES.homeAddMoney} />;
}
