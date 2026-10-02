import { type Href, Redirect } from "expo-router";
import { anySetupPending, creating, pendingSetupStep } from "~/features/setup/progress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES, setupRoute } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/**
 * No-flash first-run gate (ported): a synchronous MMKV read decides welcome vs Home before the first frame. An account
 * that left its first-run setup unfinished reopens on the step it owes (A2: resumable, bound to the account, owed from
 * the moment its passkey succeeded). A create the app died in waits for the hint read, which settles whether a new
 * account came out of it. The terms step is a sheet over Home (`TermsHost` raises it).
 */
export default function Index() {
  const { ready, hint } = useAccount();
  const welcomed = storage.getBoolean(STORAGE_KEYS.welcomed) === true;
  const unsettled = creating();
  if (!welcomed && !unsettled) return <Redirect href={ROUTES.welcome} />;
  // The common case decides synchronously. Only an unfinished setup waits for the account's address (the hint read).
  if (!anySetupPending() && !unsettled) return <Redirect href={ROUTES.home} />;
  if (!ready) return null;
  const owed = pendingSetupStep(hint?.address);
  if (owed && owed !== "terms") return <Redirect href={setupRoute(owed) as Href} />;
  return <Redirect href={owed || storage.getBoolean(STORAGE_KEYS.welcomed) ? ROUTES.home : ROUTES.welcome} />;
}
