import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { AuthFlowBody } from "~/features/auth/AuthFlowSheet";
import { useAuthFlow } from "~/features/auth/useAuthFlow";
import { useAccount } from "~/lib/account/provider";
import { SPACE, useTheme } from "~/theme";

/**
 * F03 → F01: any action a guest takes lands here — create or sign in without leaving the screen they were on. The
 * ceremony and a failure replace the invitation inside this same sheet; a cancel returns to the invitation.
 */
function Body() {
  const { color } = useTheme();
  const account = useAccount();
  const close = useSheetClose();
  const flow = useAuthFlow({ onDone: () => close() });
  const { phase, reset } = flow;
  useEffect(() => {
    if (phase.kind === "closing") reset();
  }, [phase.kind, reset]);
  if (phase.kind === "running" || phase.kind === "failed") return <AuthFlowBody flow={flow} />;
  return (
    <>
      <SheetHeading
        title="Create an account to trade"
        body="Your account is a passkey: Face ID, no seed phrase. Practice mode gives you test dollars to start."
      />
      <View style={{ gap: SPACE.sm }}>
        <Button
          label="Create account"
          leading={<PasskeyGlyph color={color.primaryForeground} />}
          disabled={!account.ready}
          onPress={flow.create}
        />
        <Button label="I already have an account" variant="outline" disabled={!account.ready} onPress={flow.signIn} />
        <Button label="Keep browsing" variant="ghost" size="sm" onPress={() => close()} />
      </View>
    </>
  );
}

export default function AccountRequiredSheet() {
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close create account">
      <Body />
    </Sheet>
  );
}
