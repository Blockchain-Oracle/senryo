import { Redirect } from "expo-router";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/** No-flash first-run gate (ported): a synchronous MMKV read decides welcome vs portfolio before the first frame. */
export default function Index() {
  return <Redirect href={storage.getBoolean(STORAGE_KEYS.welcomed) ? ROUTES.portfolio : ROUTES.welcome} />;
}
