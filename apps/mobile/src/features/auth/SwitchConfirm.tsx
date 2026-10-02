/**
 * A5 Switch account: asked first, because this phone keeps one account and the other one's sign-in replaces it.
 * "Switch account?" with the reason behind an ⓘ, then **Choose passkey** (the picker; A3's checks follow) or Cancel.
 * Rendered inline over a screen (Welcome) or as the body of a sheet that is already open.
 */
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { InfoTip } from "~/features/setup/InfoTip";
import { SPACE } from "~/theme";

const WHY =
  "This phone keeps one Senryo account at a time. Signing in with another passkey replaces this one here; its passkey still signs it back in, and nothing is deleted.";

export function SwitchBody({ onChoose, onCancel }: { onChoose: () => void; onCancel: () => void }) {
  return (
    <>
      <View style={styles.heading}>
        <SheetHeading title="Switch account?" />
        <InfoTip title="One account per phone" body={WHY} />
      </View>
      <View style={styles.actions}>
        <Button label="Choose passkey" onPress={onChoose} />
        <Button label="Cancel" variant="ghost" size="sm" onPress={onCancel} />
      </View>
    </>
  );
}

function InSheet({ onChoose }: { onChoose: () => void }) {
  const close = useSheetClose();
  return <SwitchBody onChoose={() => close(onChoose)} onCancel={() => close()} />;
}

/** Over a screen: slides up, and away again on Cancel, drag or scrim. */
export function SwitchConfirm({ onChoose, onClose }: { onChoose: () => void; onClose: () => void }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Sheet onClose={onClose} closeLabel="Close switch account">
        <InSheet onChoose={onChoose} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs },
  actions: { gap: SPACE.sm },
});
