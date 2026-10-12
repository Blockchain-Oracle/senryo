import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * The app's haptic words (move = one favourable step of an open call, the Tradash 6 ms tick; win and loss = a
 * call's result: success, and the plan's "soft thud") (plan §2.4 iOS feel, ux-product-feel §B.1). The only module allowed to import
 * expo-haptics (invariant haptics-via-feedback); call sites go through `fire()` so the user toggle applies.
 * iOS uses the Taptic Engine's semantic feedback; Android the system constants (`performAndroidHapticsAsync`).
 */
export type HapticEvent =
  | "tick"
  | "press"
  | "snap"
  | "confirm"
  | "filled"
  | "close"
  | "warn"
  | "fail"
  | "win"
  | "loss"
  | "move"
  | "surge"
  | "mega"
  | "slump"
  | "impact";

const android = Platform.OS === "android";
const A = Haptics.AndroidHaptics;

function ios(event: HapticEvent): Promise<void> {
  switch (event) {
    case "tick":
      return Haptics.selectionAsync();
    case "press":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case "snap":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    case "confirm":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    case "filled":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case "warn":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case "fail":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case "win":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case "loss":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case "move":
      return Haptics.selectionAsync();
    // Tradash's table (F3, research 01 F1): a cash-out, the surge and mega flourishes and a slump have their own words.
    case "close":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case "surge":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    case "mega":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case "slump":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    case "impact":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

const ANDROID: Record<HapticEvent, Haptics.AndroidHaptics> = {
  tick: A.Segment_Tick,
  press: A.Virtual_Key,
  snap: A.Gesture_End,
  confirm: A.Confirm,
  filled: A.Confirm,
  warn: A.Reject,
  fail: A.Reject,
  win: A.Confirm,
  loss: A.Long_Press,
  move: A.Clock_Tick,
  close: A.Virtual_Key,
  surge: A.Confirm,
  mega: A.Long_Press,
  slump: A.Gesture_End,
  impact: A.Long_Press,
};

/** Plays one haptic word; failures (Low Power Mode, Taptic off, camera active) are silent by design. */
export function playHaptic(event: HapticEvent): void {
  const run = android ? Haptics.performAndroidHapticsAsync(ANDROID[event]) : ios(event);
  run.catch(() => undefined);
}
