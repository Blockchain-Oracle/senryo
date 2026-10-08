/**
 * Share a call (S5.13): mounts the share card off-screen, waits for it to lay out and for its marks to draw, captures
 * it at 3× (`react-native-view-shot`, 1080 × 1350 PNG) and opens the system share sheet (`expo-sharing`). Cancelling
 * the sheet is not an error; a capture that fails says so.
 */
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { notify } from "~/lib/notify";
import { CARD_H, CARD_W, type ShareCall, ShareCard } from "./ShareCard";

const SCALE = 3;
/** Marks and the QR draw a frame or two after layout; capture after this. */
const SETTLE_MS = 250;

export function ShareCallButton({ card }: { card: ShareCall }) {
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const capture = () =>
    new Promise<string>((resolve, reject) =>
      setTimeout(() => {
        if (!ref.current) return reject(new Error("The card did not draw"));
        captureRef(ref, {
          format: "png",
          quality: 1,
          result: "tmpfile",
          width: CARD_W * SCALE,
          height: CARD_H * SCALE,
        }).then(resolve, reject);
      }, SETTLE_MS),
    );

  const share = async () => {
    fire("tick");
    setBusy(true);
    try {
      const uri = await capture();
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share this call" });
    } catch (error) {
      notify({ title: "Couldn't make the card", description: (error as Error).message, tone: "warning" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button label="Share" variant="secondary" loading={busy} disabled={busy} onPress={() => void share()} />
      {busy ? (
        <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden>
          <ShareCard ref={ref} card={card} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({ offscreen: { position: "absolute", left: -CARD_W * SCALE, top: 0 } });
