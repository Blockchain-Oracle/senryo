/**
 * The receipt as an image on the phone (D-331, D-352): the slip drawn off-screen with its link and QR, captured at 3×
 * (`react-native-view-shot`, 1080 pt wide), then shared through the system sheet or saved to Photos (add-only, asked on
 * that tap). Cancelling the sheet is not an error. While balances are hidden it waits, and privacy is checked again
 * just before the image leaves (D-329).
 */
import type { TradeSlip as Slip } from "@senryo/calls";
import * as Sharing from "expo-sharing";
import { type ReactNode, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { fire } from "~/feedback/fire";
import { balancesHidden, useHideBalances } from "~/lib/hide-balances";
import { notify } from "~/lib/notify";
import { saveToPhotos } from "~/lib/photos";
import { SLIP } from "~/theme";
import { TradeSlip } from "./TradeSlip";

const SCALE = 3;
/** Marks and the QR draw a frame or two after layout; capture after this. */
const SETTLE_MS = 700;
const BLOCKED = { title: "Balances are hidden", description: "Show balances to share or save this receipt." };

export function useSlipImage(slip: Slip): {
  node: ReactNode;
  busy: "share" | "save" | null;
  share: () => void;
  save: () => void;
} {
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
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

  const run = async (kind: "share" | "save") => {
    fire("tick");
    if (hidden) return notify(BLOCKED);
    setBusy(kind);
    try {
      const uri = await capture();
      if (balancesHidden()) return notify(BLOCKED);
      if (kind === "share") {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: slip.title });
        return;
      }
      const saved = await saveToPhotos(uri);
      notify(
        saved === "saved"
          ? { title: "Saved to Photos" }
          : saved === "refused"
            ? { title: "Photos access is off", description: "Share still saves it.", tone: "warning" }
            : { title: "Can't save here yet", description: "Share still saves it.", tone: "warning" },
      );
    } catch (error) {
      notify({ title: "Couldn't make the image", description: (error as Error).message, tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const node = busy ? (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden>
      <TradeSlip ref={ref} slip={slip} exporting />
    </View>
  ) : null;
  return { node, busy, share: () => void run("share"), save: () => void run("save") };
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -SLIP.maxWidth * SCALE, top: 0, width: SLIP.maxWidth },
});
