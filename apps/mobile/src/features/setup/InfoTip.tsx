/**
 * The ⓘ behind which an explanation lives (D-237 copy budget: no sentences on primary screens). A 44 pt target around
 * the quiet info glyph; a tap raises a compact sheet with the title, the explanation and one "Got it". The sheet is a
 * transparent system modal so it covers the whole screen from wherever the ⓘ sits (inside a row, a scroll view or a
 * sheet route).
 */
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Button } from "~/components/kit/Button";
import { Info } from "~/components/kit/symbols";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, useTheme } from "~/theme";

export function InfoTip({ title, body, label }: { title: string; body: string; label?: string }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => {
          fire("tick");
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={label ?? `About ${title}`}
        hitSlop={(SIZE.touch - SIZE.iconSm) / 2}
        style={styles.tap}
      >
        <Info size={SIZE.iconSm + SPACE.xxs} strokeWidth={SIZE.iconStroke} color={color.text3} />
      </Pressable>
      {open ? <InfoSheet title={title} body={body} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function InfoSheet({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <View style={StyleSheet.absoluteFill}>
          <Sheet onClose={onClose} closeLabel={`Close ${title}`}>
            <SheetHeading title={title} body={body} />
            <GotIt />
          </Sheet>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function GotIt() {
  const close = useSheetClose();
  return <Button label="Got it" variant="secondary" onPress={() => close()} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tap: { justifyContent: "center", alignItems: "center" },
});
