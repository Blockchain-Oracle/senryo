/**
 * The editor's username field (C09; the setup step's states, `app/setup/handle.tsx`, for an account that may already
 * have a name): checked as it is typed, with every state in one line — unchanged · checking · available · taken ·
 * reserved · held · invalid · couldn't check — and what a change costs said before saving: the old name is held for
 * 30 days, and only its last owner can take it back (`PUT /v1/profile`, HANDLE_TOMBSTONE_DAYS).
 */
import { HANDLE_MAX_CHARS, HANDLE_MIN_CHARS, HANDLE_TOMBSTONE_DAYS, normalizeHandle } from "@senryo/api-client";
import { useHandleAvailability } from "@senryo/query";
import { useEffect, useState } from "react";
import type { FieldTone } from "./ProfileField";

/** The availability check waits for the typing to pause. */
const CHECK_DELAY_MS = 300;

const INVALID: Record<string, string> = {
  length: `Use ${HANDLE_MIN_CHARS} to ${HANDLE_MAX_CHARS} characters`,
  charset: "Letters, numbers and underscores only",
  blocked: "That name can’t be used",
};

export interface HandleField {
  text: string;
  /** The name as the server would store it (no "@", lower case). */
  typed: string;
  onChangeText: (next: string) => void;
  /** What a save sends: `undefined` keeps the name, `null` removes it, a string claims it. */
  change: string | null | undefined;
  /** False while a changed name isn't known to be claimable. */
  ok: boolean;
  message: string;
  tone: FieldTone;
  /** A save was refused for this name; the message stays until the name is edited. */
  refuse: (message: string) => void;
}

export function useHandleField(current: string | null): HandleField {
  const [text, setText] = useState(current ?? "");
  const [settled, setSettled] = useState(text);
  const [refused, setRefused] = useState<string>();
  useEffect(() => {
    const id = setTimeout(() => setSettled(text), CHECK_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);

  const typed = normalizeHandle(text);
  const unchanged = typed === (current ?? "");
  const removing = typed === "" && current !== null;
  const check = useHandleAvailability(unchanged || removing ? undefined : settled);
  const typing = normalizeHandle(settled) !== typed;
  const known = !typing && (check.status === "fresh" || check.status === "stale") ? check.value : undefined;
  const old = current ? `@${current}` : undefined;

  const base = {
    text,
    typed,
    onChangeText: (next: string) => {
      setRefused(undefined);
      setText(next.toLowerCase());
    },
    change: unchanged ? undefined : removing ? null : typed,
    refuse: setRefused,
  };
  const state = (message: string, tone: FieldTone, ok: boolean): HandleField => ({ ...base, message, tone, ok });

  if (refused) return state(refused, "bad", false);
  if (unchanged) {
    return state(
      old
        ? `If you change it, ${old} is held for ${HANDLE_TOMBSTONE_DAYS} days so nobody can pose as you. After that anyone can take it.`
        : `${HANDLE_MIN_CHARS} to ${HANDLE_MAX_CHARS} letters, numbers or underscores.`,
      "quiet",
      true,
    );
  }
  if (removing) {
    return state(
      `Saving removes your username. ${old} is held for ${HANDLE_TOMBSTONE_DAYS} days; until then only you can take it back.`,
      "quiet",
      true,
    );
  }
  if (typing || check.status === "unknown") return state("Checking…", "quiet", false);
  if (!known) return state("Couldn’t check that name. Check your connection.", "bad", false);
  switch (known.state) {
    case "available":
      return state(
        old
          ? `@${known.handle} is available. ${old} will be held for ${HANDLE_TOMBSTONE_DAYS} days, then anyone can take it.`
          : `@${known.handle} is available`,
        "good",
        true,
      );
    case "invalid":
      return state(INVALID[known.reason ?? "charset"] ?? "That name can’t be used", "bad", false);
    case "held":
      // Only the server knows whose hold it is, so the save is allowed to try: the last owner gets the name back.
      return state("On hold after a recent release. Only its last owner can take it back.", "quiet", true);
    case "reserved":
      return state("That name is reserved", "bad", false);
    case "taken":
      return state("That name is taken", "bad", false);
  }
}
