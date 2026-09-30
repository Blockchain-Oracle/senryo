import { type HandleSyntaxIssue, handleSyntaxIssue } from "@senryo/api-client";
import {
  BLOCKED_WORDS,
  LEET_FOLD,
  RESERVED_HANDLE_TOKENS,
  RESERVED_HANDLES,
  RESERVED_NAME_TOKENS,
} from "./constants.ts";

/**
 * Content filter for handles, display names and bios (S12b, App Store 1.2). Pure: no DB, no I/O.
 * Folding lower-cases, maps leetspeak and, for handles, drops separators so `f_u_c_k` still matches.
 */

function fold(text: string): string {
  return Array.from(text.toLowerCase(), (ch) => LEET_FOLD[ch] ?? ch).join("");
}

const LETTERS_ONLY = /[^a-z]/g;
const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

/** A handle contains a blocked word anywhere (separators and digits folded away). */
export function handleHasBlockedWord(handle: string): boolean {
  const folded = fold(handle).replace(LETTERS_ONLY, "");
  return BLOCKED_WORDS.some((word) => folded.includes(word));
}

/** Free text contains a word starting with a blocked root (`shits` yes, `Scunthorpe` no). */
export function textHasBlockedWord(text: string): boolean {
  const words = fold(text).split(WORD_SPLIT);
  return words.some((word) => BLOCKED_WORDS.some((root) => word.startsWith(root)));
}

/** A display name impersonates Senryo ("Senryo", "Official") as a whole word. */
export function nameIsReserved(name: string): boolean {
  const words = new Set(fold(name).split(WORD_SPLIT));
  return RESERVED_NAME_TOKENS.some((token) => words.has(token));
}

export type HandleScreen =
  | { state: "invalid"; reason: HandleSyntaxIssue | "blocked" }
  | { state: "reserved" }
  | { state: "ok" };

/** Everything decidable without the database, for a normalised handle: syntax, blocked words, reserved names. */
export function screenHandle(handle: string): HandleScreen {
  const syntax = handleSyntaxIssue(handle);
  if (syntax) return { state: "invalid", reason: syntax };
  if (handleHasBlockedWord(handle)) return { state: "invalid", reason: "blocked" };
  const bare = handle.replaceAll("_", "");
  if (RESERVED_HANDLES.has(handle) || RESERVED_HANDLES.has(bare)) return { state: "reserved" };
  if (RESERVED_HANDLE_TOKENS.some((token) => bare.includes(token))) return { state: "reserved" };
  return { state: "ok" };
}
