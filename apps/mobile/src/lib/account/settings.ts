/** Session settings (TTL, idle, Face ID per trade) persisted in MMKV — non-secret. Loosening needs a step-up. */
import {
  DEFAULT_SETTINGS,
  type FaceIdMode,
  SESSION_IDLE_CHOICES_MS,
  SESSION_TTL_CHOICES_MS,
  type SessionSettings,
} from "@senryo/account";
import { STORAGE_KEYS, storage } from "~/lib/storage";

const FACE_ID_MODES: readonly FaceIdMode[] = ["off", "above-threshold", "every-trade"];

export function loadSettings(): SessionSettings {
  try {
    const raw = storage.getString(STORAGE_KEYS.sessionSettings);
    if (!raw) return DEFAULT_SETTINGS;
    const v = JSON.parse(raw) as Partial<Record<keyof SessionSettings, unknown>>;
    const ttl = (SESSION_TTL_CHOICES_MS as readonly unknown[]).includes(v.ttlMs) ? (v.ttlMs as number) : undefined;
    const idle = (SESSION_IDLE_CHOICES_MS as readonly unknown[]).includes(v.idleMs) ? (v.idleMs as number) : undefined;
    const faceId = FACE_ID_MODES.includes(v.faceId as FaceIdMode) ? (v.faceId as FaceIdMode) : undefined;
    return { ttlMs: ttl ?? DEFAULT_SETTINGS.ttlMs, idleMs: idle ?? DEFAULT_SETTINGS.idleMs, faceId };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: SessionSettings): void {
  storage.set(STORAGE_KEYS.sessionSettings, JSON.stringify(settings));
}
