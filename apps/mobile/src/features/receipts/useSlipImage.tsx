/**
 * Share or save the slip on the phone (D-331; it replaces the S5.13 share card): the slip drawn off-screen with its
 * link and QR, captured at 3× (`react-native-view-shot`, 1080 pt wide) and handed to the system sheet, which also
 * saves it to Photos (`expo-sharing`). Cancelling the sheet is not an error. While balances are hidden it waits, and
 * privacy is checked again just before the image leaves (D-329).
 */
import type { TradeSlip as Slip } from "@senryo/calls";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { balancesHidden, useHideBalances } from "~/lib/hide-balances";
import { notify } from "~/lib/notify";
import { SLIP } from "~/theme";
import { TradeSlip } from "./TradeSlip";

const SCALE = 3;
/** Marks and the QR draw a frame or two after layout; capture after this. */
const SETTLE_MS = 700;
const BLOCKED = { title: "Balances are hidden", description: "Show balances to share or save this receipt." };

export function SlipShare({ slip }: { slip: Slip }) {
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [hidden] = useHideBalances();

  const capture = () =>
    new Promise<string>((resolve, reject) =>
      setTimeout(() => {
        if (!ref.current) return reject(new Error("The receipt did not draw"));
        captureRef(ref, { format: "png", quality: 1, result: "tmpfile", width: SLIP.maxWidth * SCALE }).then(
          resolve,
          reject,
        );
      }, SETTLE_MS),
    );

  const share = async () => {
    fire("tick");
    if (hidden) return notify(BLOCKED);
    setBusy(true);
    try {
      const uri = await capture();
      if (balancesHidden()) return notify(BLOCKED);
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: slip.title });
    } catch (error) {
      notify({ title: "Couldn't make the image", description: (error as Error).message, tone: "warning" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button label="Share or save" variant="secondary" loading={busy} disabled={busy} onPress={() => void share()} />
      {busy ? (
        <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden>
          <TradeSlip ref={ref} slip={slip} exporting />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -SLIP.maxWidth * SCALE, top: 0, width: SLIP.maxWidth },
});
