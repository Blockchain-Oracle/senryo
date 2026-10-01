import { TERMS } from "@senryo/config";
import { Stack } from "expo-router";
import { LegalPage } from "~/features/legal/LegalPage";

export default function TermsPage() {
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <LegalPage document={TERMS} />
    </>
  );
}
