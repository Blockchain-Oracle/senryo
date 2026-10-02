/**
 * A9 Sign out, confirmed: "Sign out of @kai?" with the reassurance behind an ⓘ (the passkey signs you back in; nothing
 * is deleted), then **Sign out** / Cancel. Signing out ends the session, removes this phone's hint and Face ID unlock
 * item, stops pushes for the account, and lands on Welcome.
 */
import { router } from "expo-router";
import { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { accountName, useAccountIdentity } from "~/features/auth/SignInOutcome";
import { InfoTip } from "~/features/setup/InfoTip";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE } from "~/theme";

const WHY = "Your passkey signs you back in to the same account. Nothing is deleted.";

export function SignOutConfirm({ onClose }: { onClose: () => void }) {
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <View style={StyleSheet.absoluteFill}>
          <Sheet onClose={onClose} closeLabel="Close sign out">
            <Body />
          </Sheet>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Body() {
  const account = useAccount();
  const close = useSheetClose();
  const address = account.hint?.address;
  const { handle } = useAccountIdentity(address);
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try {
      await account.signOut();
      fire("confirm");
      close(() => router.replace(ROUTES.welcome));
    } catch {
      setBusy(false);
      fire("fail");
    }
  };
  return (
    <>
      <View style={styles.heading}>
        <SheetHeading title={`Sign out of ${accountName(handle, address)}?`} />
        <InfoTip title="Signing out" body={WHY} />
      </View>
      <View style={styles.actions}>
        <Button label="Sign out" variant="destructive" loading={busy} onPress={() => void signOut()} />
        <Button label="Cancel" variant="ghost" size="sm" disabled={busy} onPress={() => close()} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs },
  actions: { gap: SPACE.sm },
});
