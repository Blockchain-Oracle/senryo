import { createMMKV } from "react-native-mmkv";

/** The app's synchronous key-value store (theme, remembered choices, later the tx journal). Never secrets (SecureStore). */
export const storage = createMMKV({ id: "senryo" });

/** Every persisted key, versioned so a shape change never reads stale data. */
export const STORAGE_KEYS = {
  theme: "senryo.theme.v1",
  sounds: "senryo.sounds.v1",
  haptics: "senryo.haptics.v1",
  welcomed: "senryo.welcomed.v1",
  /** Session settings (TTL, idle, Face ID per trade) — non-secret; loosening needs a step-up (S6). */
  sessionSettings: "senryo.session-settings.v1",
  /** S6.10 measurement ring buffer (prompt counts, flow timings, TTFT) — no secrets. */
  measure: "senryo.measure.v1",
  /** Per-install id for the starter relay's rate limit (`x-senryo-device`) — not an identity. */
  device: "senryo.device.v1",
  /** F10: the three-card risk explainer was accepted ("I understand" hold) — shown once, before the first trade. */
  riskExplained: "senryo.risk-explained.v1",
} as const;
