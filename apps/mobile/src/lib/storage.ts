import { createMMKV } from "react-native-mmkv";

/** The app's synchronous key-value store (theme, remembered choices, later the tx journal). Never secrets (SecureStore). */
export const storage = createMMKV({ id: "senryo" });

/** Every persisted key, versioned so a shape change never reads stale data. */
export const STORAGE_KEYS = {
  theme: "senryo.theme.v1",
  sounds: "senryo.sounds.v1",
  haptics: "senryo.haptics.v1",
} as const;
