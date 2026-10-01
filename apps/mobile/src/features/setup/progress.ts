/**
 * Where a new account is in its first-run setup (J1, review R03): versioned, bound to the account's address, and
 * resumable — killing the app mid-way reopens on the same step. Only **creating** an account starts it; an account that
 * signs in on this phone has no entry and goes straight to Home. Every step can be skipped; skipping still advances.
 */
import type { Address } from "@senryo/account";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/** In order. `done` is the completion scene; after it the entry reads `finished`. */
export const SETUP_STEPS = ["handle", "follow", "voucher", "terms", "done"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
type Stored = Record<string, SetupStep | "finished">;

function read(): Stored {
  const raw = storage.getString(STORAGE_KEYS.setup);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Stored;
  } catch {
    return {};
  }
}

function write(address: Address, value: SetupStep | "finished") {
  storage.set(STORAGE_KEYS.setup, JSON.stringify({ ...read(), [address.toLowerCase()]: value }));
}

/** True when some account on this device left its setup unfinished (a synchronous read for the launch gate). */
export function anySetupPending(): boolean {
  return Object.values(read()).some((at) => at !== "finished");
}

/** A brand-new account starts at the first step. */
export function startSetup(address: Address) {
  write(address, SETUP_STEPS[0]);
}

/** The step this account still owes, or undefined when it never started (signed in) or has finished. */
export function pendingSetupStep(address: Address | undefined): SetupStep | undefined {
  if (!address) return undefined;
  const at = read()[address.toLowerCase()];
  return at === undefined || at === "finished" ? undefined : at;
}

/** Marks `step` complete (or skipped) and returns the next one, or undefined after the last. */
export function completeSetupStep(address: Address, step: SetupStep): SetupStep | undefined {
  const next = SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1];
  write(address, next ?? "finished");
  return next;
}
