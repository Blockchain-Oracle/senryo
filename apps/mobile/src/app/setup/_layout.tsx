import { Redirect, Stack } from "expo-router";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useTheme } from "~/theme";

/**
 * A new account's first-run setup (J1): handle → follow → voucher → terms → Face ID → notifications → done, each a page
 * that pushes the next (Fomo F04–F07 are page pushes). No header: every step draws its own back and Skip. Without an
 * account there is nothing to set up.
 */
export default function SetupLayout() {
  const { color } = useTheme();
  const account = useAccount();
  if (account.ready && !account.hint) return <Redirect href={ROUTES.welcome} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground } }} />;
}
