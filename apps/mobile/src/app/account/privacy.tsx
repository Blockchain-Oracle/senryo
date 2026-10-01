import { PRIVACY } from "@senryo/config";
import { Stack } from "expo-router";
import { LegalPage } from "~/features/legal/LegalPage";

export default function PrivacyPage() {
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <LegalPage document={PRIVACY} />
    </>
  );
}
