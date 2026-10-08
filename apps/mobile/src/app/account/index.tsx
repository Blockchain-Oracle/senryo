import { Redirect } from "expo-router";
import { ROUTES } from "~/lib/constants/routes";

/** `/account` is the You tab since the S1b.7 shell (D-176); its sections moved there unchanged. */
export default function AccountRedirect() {
  return <Redirect href={ROUTES.more} />;
}
