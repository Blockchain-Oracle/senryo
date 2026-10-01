import { Stack } from "expo-router";
import { PRIVACY } from "~/features/legal/content";
import { LegalPage } from "~/features/legal/LegalPage";

export default function PrivacyPage() {
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <LegalPage document={PRIVACY} />
    </>
  );
}
