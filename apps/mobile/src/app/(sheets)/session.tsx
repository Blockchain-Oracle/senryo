import { type AuthFailure, authFailureCopy, classifyAuthError, isSilent } from "@senryo/account";
import { shortAddress } from "@senryo/core";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useChip } from "~/lib/account/use-chip";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_MINUTE = 60_000;

/** F04 / F02 / F09: who is signed in, how long trading stays unlocked, lock / unlock / switch / sign out. */
function Body() {
  const network = useNetwork();
  const { color } = useTheme();
  const account = useAccount();
  const chip = useChip();
  const close = useSheetClose();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthFailure>();
  const unlocked = account.snapshot.status === "unlocked";
  const address = account.snapshot.status === "none" ? undefined : account.snapshot.address;
  const idle = Math.round(account.settings.idleMs / MS_PER_MINUTE);

  const attempt = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
      fire("confirm", { sound: "unlock" });
    } catch (error) {
      const kind = classifyAuthError(error);
      if (!isSilent(kind)) setFailure(kind);
    } finally {
      setBusy(false);
    }
  };
  const copy = failure ? authFailureCopy(failure, Platform.OS === "ios" ? "ios" : "android") : undefined;
  return (
    <>
      <SheetHeading
        title="Trading session"
        body={
          unlocked
            ? `Small trades need no prompt while unlocked. Locks after ${idle} idle minutes, at the time shown, or when Senryo goes to the background.`
            : "Locked. Your portfolio stays visible; Face ID unlocks trading."
        }
      />
      <Panel style={styles.panel}>
        <KeyValue label={network.modeLabel} value={chip.label} valueColor={unlocked ? color.up : color.inkMuted} />
        {address ? <KeyValue label="Account" value={shortAddress(address)} /> : null}
      </Panel>
      {copy ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
          {copy.title}. {copy.body}
        </Text>
      ) : null}
      {unlocked ? (
        <Button
          label="Lock now"
          variant="outline"
          onPress={() => {
            fire("tick");
            account.lock();
          }}
        />
      ) : (
        <Button
          label={`Unlock with ${Platform.OS === "ios" ? "Face ID" : "fingerprint"}`}
          loading={busy}
          onPress={() => void attempt(account.unlock)}
        />
      )}
      <View style={styles.row}>
        <Button
          label="Switch"
          variant="ghost"
          block={false}
          disabled={busy}
          onPress={() => void attempt(account.signIn)}
        />
        <Button label="Account" variant="ghost" block={false} onPress={() => close(() => router.push(ROUTES.you))} />
        <Button
          label="Sign out"
          variant="ghost"
          block={false}
          disabled={busy}
          onPress={() => void account.signOut().then(() => close(() => router.replace(ROUTES.welcome)))}
        />
      </View>
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

const styles = StyleSheet.create({
  panel: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  row: { flexDirection: "row", justifyContent: "space-between" },
});
