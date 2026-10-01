import { Redirect } from "expo-router";
import { ROUTES } from "~/lib/constants/routes";

/** F41: an expired or unknown path (an old link, a mistyped deep link) lands on Home, never a dead end. */
export default function NotFound() {
  return <Redirect href={ROUTES.home} />;
}
