/**
 * Scan a wallet or payment QR (B7 Scan; expo-camera's barcode scanner, runtime 0.2.0). A full-screen layer over the
 * step that opened it: the live camera, a rounded viewfinder, Close, and one line saying what it reads. The first code
 * that parses as an address or an EIP-681 payment link is handed back once (a haptic tick); anything else says so in
 * place. Camera denied: "Allow camera to scan" + Settings. A build without the camera module says that instead.
 */
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { X } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { BUTTON, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { type CameraModule, cameraModule } from "./native";
import { parsePayment, type ScannedPayment } from "./qr-payload";

const FINDER = 248;
const FINDER_STROKE = 3;
/** A code that didn't parse is said for this long before scanning resumes. */
const UNREADABLE_MS = 1_600;

export function Scanner({ onScan, onClose }: { onScan: (payment: ScannedPayment) => void; onClose: () => void }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const camera = cameraModule();
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={[StyleSheet.absoluteFill, { backgroundColor: color.ground }]}
      accessibilityViewIsModal
    >
      {camera ? (
        <Live camera={camera} onScan={onScan} />
      ) : (
        <View style={styles.center}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>This build can't scan yet</Text>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Paste the address instead</Text>
        </View>
      )}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close scanner"
        hitSlop={SPACE.xs}
        style={[styles.close, { top: insets.top + SPACE.sm, backgroundColor: color.raised2 }]}
      >
        <X size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.ink} />
      </Pressable>
    </Animated.View>
  );
}

function Live({ camera, onScan }: { camera: CameraModule; onScan: (payment: ScannedPayment) => void }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, request] = camera.useCameraPermissions();
  const [unreadable, setUnreadable] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void request();
  }, [permission, request]);
  useEffect(() => {
    if (!unreadable) return;
    const id = setTimeout(() => setUnreadable(false), UNREADABLE_MS);
    return () => clearTimeout(id);
  }, [unreadable]);
  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Allow camera to scan</Text>
        <Button label="Open Settings" variant="secondary" block={false} onPress={() => void Linking.openSettings()} />
      </View>
    );
  }
  const { CameraView } = camera;
  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          if (done.current || unreadable) return;
          const payment = parsePayment(data);
          if (!payment) {
            fire("warn");
            setUnreadable(true);
            return;
          }
          done.current = true;
          fire("filled");
          onScan(payment);
        }}
      />
      <View style={styles.center} pointerEvents="none">
        <View style={[styles.finder, { borderColor: color.onLacquer }]} />
      </View>
      <View style={[styles.caption, { bottom: insets.bottom + SPACE.xxl }]} pointerEvents="none">
        <Text style={[TYPE.bodyStrong, styles.text, { color: color.onLacquer, backgroundColor: color.scrim }]}>
          {unreadable ? "Not a Monad address" : "Monad address or payment code"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.md,
  },
  finder: { width: FINDER, height: FINDER, borderRadius: RADIUS.xl, borderWidth: FINDER_STROKE },
  close: {
    position: "absolute",
    left: SIZE.gutter,
    width: BUTTON.utility + SPACE.xs,
    height: BUTTON.utility + SPACE.xs,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  text: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill, overflow: "hidden" },
});
