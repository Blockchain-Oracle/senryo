/** Session settings (TTL, idle, Face ID per trade) persisted per device — non-secret. Loosening needs a step-up. */
import {
  DEFAULT_SETTINGS,
  type FaceIdMode,
  SESSION_IDLE_CHOICES_MS,
  SESSION_TTL_CHOICES_MS,
  type SessionSettings,
} from "@senryo/account";
import { AUTH_STORAGE } from "@/lib/constants/auth";
import { readJson, writeJson } from "./local";

const FACE_ID_MODES: readonly FaceIdMode[] = ["off", "above-threshold", "every-trade"];

function parse(raw: unknown): SessionSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Partial<Record<keyof SessionSettings, unknown>>;
  const ttl = (SESSION_TTL_CHOICES_MS as readonly unknown[]).includes(v.ttlMs) ? (v.ttlMs as number) : undefined;
  const idle = (SESSION_IDLE_CHOICES_MS as readonly unknown[]).includes(v.idleMs) ? (v.idleMs as number) : undefined;
  const faceId = FACE_ID_MODES.includes(v.faceId as FaceIdMode) ? (v.faceId as FaceIdMode) : undefined;
  return {
    ttlMs: ttl ?? DEFAULT_SETTINGS.ttlMs,
    idleMs: idle ?? DEFAULT_SETTINGS.idleMs,
    faceId,
  };
}

export function loadSettings(): SessionSettings {
  return readJson(AUTH_STORAGE.settings, parse) ?? DEFAULT_SETTINGS;
}

export function saveSettings(settings: SessionSettings): void {
  writeJson(AUTH_STORAGE.settings, settings);
}
