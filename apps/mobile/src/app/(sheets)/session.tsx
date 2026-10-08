import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { AuthFlowBody, showsOutcome } from "~/features/auth/AuthFlowSheet";
import { SessionPanel } from "~/features/auth/SessionPanel";
import { SwitchBody } from "~/features/auth/SwitchConfirm";
import { useAuthFlow } from "~/features/auth/useAuthFlow";
import { SignOutConfirm } from "~/features/profile/SignOutConfirm";
import { ROUTES } from "~/lib/constants/routes";

/**
 * The trading session (A4, A5, A9) as a sheet — opened by the "Unlock" of a locked state: who, unlocked until when or
 * locked, Unlock / Lock now, Use another account (asked first, then A3's checks in this same sheet), Sign out
 * (confirmed). The same rows live in Settings → Security.
 */
function Body() {
  const close = useSheetClose();
  const [asking, setAsking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const flow = useAuthFlow({ switching: true, onDone: () => close(() => router.replace(ROUTES.home)) });
  const { phase, reset } = flow;
  useEffect(() => {
    if (phase.kind === "closing") reset();
  }, [phase.kind, reset]);
  if (showsOutcome(flow)) return <AuthFlowBody flow={flow} onClose={reset} />;
  if (asking) {
    return (
      <SwitchBody
        onChoose={() => {
          setAsking(false);
          flow.signIn();
        }}
        onCancel={() => setAsking(false)}
      />
    );
  }
  return (
    <>
      <SheetHeading title="Unlocked session" />
      <SessionPanel onSwitch={() => setAsking(true)} />
      <Button label="Sign out" variant="ghost" size="sm" onPress={() => setSigningOut(true)} />
      {signingOut ? <SignOutConfirm onClose={() => setSigningOut(false)} /> : null}
    </>
  );
}

export default function SessionSheet() {
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close trading session">
      <Body />
    </Sheet>
  );
}
