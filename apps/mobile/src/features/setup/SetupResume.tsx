import { type Href, router } from "expo-router";
import { useMMKVString } from "react-native-mmkv";
import { Button } from "~/components/kit/Button";
import { useAccount } from "~/lib/account/provider";
import { setupRoute } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { pendingSetupStep } from "./progress";

/** Home remains usable after contextual Face ID; permission prompts never stack automatically. */
export function SetupResume() {
  useMMKVString(STORAGE_KEYS.setup, storage);
  const step = pendingSetupStep(useAccount().hint?.address);
  if (!step || step === "terms" || step === "face-id") return null;
  return (
    <Button label="Finish account setup" variant="outline" onPress={() => router.push(setupRoute(step) as Href)} />
  );
}
