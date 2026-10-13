/**
 * The terminal's music on the phone (D-317, F2; the web's ♪ toggle): off by default, on from Settings → Sounds &
 * haptics; while the terminal is in focus it plays the chosen track, and leaving it stops it (the dock keeps tabs
 * mounted — and mounts them ahead of a visit, R5.24 — so focus, not mounting, is the cue).
 */
import { type SongName, TERMINAL_SONGS } from "@senryo/tokens";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";
import { music } from "~/feedback/fire";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export function useTerminalMusic(): void {
  const [on] = useMMKVBoolean(STORAGE_KEYS.terminalMusic, storage);
  const [stored] = useMMKVString(STORAGE_KEYS.musicTrack, storage);
  const track: SongName = TERMINAL_SONGS.find((s) => s === stored) ?? "arcade";
  useFocusEffect(
    useCallback(() => {
      music(on ? track : null);
      return () => music(null);
    }, [on, track]),
  );
}
