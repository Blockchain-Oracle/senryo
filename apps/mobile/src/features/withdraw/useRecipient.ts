/**
 * Who a send goes to, from what was typed or pasted: a 0x address as written, or an @handle resolved on the active
 * network (`useProfile`; an unlisted profile is not found — handles are per network and private until listed). The
 * resolved address is what gets signed and is always shown in full before the passkey check (direction §9: choosing
 * a handle never sends money by itself).
 */
import { ApiError, handleSyntaxIssue, normalizeHandle } from "@senryo/api-client";
import { socialKeys, useProfile, useQueryEnv } from "@senryo/query";
import { useEffect, useState } from "react";
import { useQueryError } from "~/features/social/useQueryError";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/** Resolution waits for the typing to pause. */
const RESOLVE_DELAY_MS = 350;
const HTTP_NOT_FOUND = 404;

export type Recipient =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "resolving" }
  | { status: "not-found"; handle: string }
  | { status: "failed" }
  | { status: "ready"; address: `0x${string}`; handle: string | null };

export function useRecipient(input: string): Recipient {
  const text = input.trim();
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const id = setTimeout(() => setSettled(text), RESOLVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);
  const isAddress = ADDRESS.test(text);
  const handle = normalizeHandle(text);
  // Only something shaped like a handle is looked up; anything else is not a recipient (and is never echoed back).
  const wellFormed = !isAddress && handle.length > 0 && handleSyntaxIssue(handle) === null;
  const lookup = wellFormed && settled === text ? handle : undefined;
  const profile = useProfile(lookup);
  const env = useQueryEnv();
  const error = useQueryError(socialKeys.profile(env.chainId, lookup ?? ""));
  if (text === "") return { status: "empty" };
  if (isAddress) return { status: "ready", address: text as `0x${string}`, handle: null };
  if (!wellFormed) return { status: "invalid" };
  if (settled !== text || profile.status === "unknown") return { status: "resolving" };
  if (profile.status === "failed") {
    return error instanceof ApiError && error.status === HTTP_NOT_FOUND
      ? { status: "not-found", handle }
      : { status: "failed" };
  }
  return { status: "ready", address: profile.value.address as `0x${string}`, handle: profile.value.handle };
}
