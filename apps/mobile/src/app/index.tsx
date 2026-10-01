import { type Href, Redirect } from "expo-router";
import { anySetupPending, pendingSetupStep } from "~/features/setup/progress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES, setupRoute } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/**
 * No-flash first-run gate (ported): a synchronous MMKV read decides welcome vs Home before the first frame. An account
 * that left its first-run setup unfinished reopens on the step it owes (J1: resumable, bound to the account).
 */
export default function Index() {
  const { ready, hint } = useAccount();
  if (!storage.getBoolean(STORAGE_KEYS.welcomed)) return <Redirect href={ROUTES.welcome} />;
  // The common case decides synchronously. Only an unfinished setup waits for the account's address (the hint read).
  if (!anySetupPending()) return <Redirect href={ROUTES.home} />;
  if (!ready) return null;
  const owed = pendingSetupStep(hint?.address);
  return <Redirect href={owed ? (setupRoute(owed) as Href) : ROUTES.home} />;
}
