import { Stack } from "expo-router";
import { TERMS } from "~/features/legal/content";
import { LegalPage } from "~/features/legal/LegalPage";

export default function TermsPage() {
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <LegalPage document={TERMS} />
    </>
  );
}
