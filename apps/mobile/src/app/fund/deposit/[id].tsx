import { Redirect } from "expo-router";
import { ROUTES } from "~/lib/constants/routes";

/** Old deposit-timeline links: every transfer in or out is a row in Activity, with its timeline in the receipt (B12). */
export default function DepositRedirect() {
  return <Redirect href={ROUTES.activity} />;
}
