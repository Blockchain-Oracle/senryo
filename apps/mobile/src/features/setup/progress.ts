/**
 * Where a new account is in its first-run setup (J1, review R03; A2): versioned, bound to the account's address, and
 * resumable — killing the app mid-way reopens on the same step. Setup is owed from the moment a create's passkey
 * succeeds (the account provider records it then, `oweSetup`), so a kill or a create from the guest sheet still lands
 * on it. An account that signs in has no entry and goes straight to Home. Every step can be skipped except the terms,
 * which come last as a sheet over Home (Fomo F08).
 */
import type { Address } from "@senryo/account";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/** In order. `done` is the completion scene; `terms` is the sheet over Home; after it the entry reads `finished`. */
export const SETUP_STEPS = ["handle", "follow", "money", "face-id", "notifications", "done", "terms"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
type Stored = Record<string, string>;

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

/** A stored step this build no longer has (an older order) restarts from the first one rather than a dead route. */
function known(at: string): SetupStep {
  return (SETUP_STEPS as readonly string[]).includes(at) ? (at as SetupStep) : SETUP_STEPS[0];
}

/** True when some account on this device left its setup unfinished (a synchronous read for the launch gate). */
export function anySetupPending(): boolean {
  return Object.values(read()).some((at) => at !== "finished");
}

/**
 * A brand-new account owes its setup from the first step, written once the create's passkey succeeded. Welcome is
 * complete from then on (§0.7 #12): never before, so a cancelled passkey leaves the phone on Welcome.
 */
export function oweSetup(address: Address) {
  write(address, SETUP_STEPS[0]);
  storage.set(STORAGE_KEYS.welcomed, true);
}

/** The step this account still owes, or undefined when it never started (signed in) or has finished. */
export function pendingSetupStep(address: Address | undefined): SetupStep | undefined {
  if (!address) return undefined;
  const at = read()[address.toLowerCase()];
  return at === undefined || at === "finished" ? undefined : known(at);
}

/** Marks `step` complete (or skipped) and returns the next one, or undefined after the last. */
export function completeSetupStep(address: Address, step: SetupStep): SetupStep | undefined {
  const next = SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1];
  write(address, next ?? "finished");
  return next;
}

/**
 * The create-ceremony marker (defect 6). `beginCreate` runs before the passkey sheet with the address the phone held;
 * `endCreate` clears it however the ceremony ends. `reconcileCreate` runs once the hint is read at launch: a hint that
 * is not the one held before the ceremony is the new account, and its setup is owed even though the app died before
 * it could say so.
 */
export function beginCreate(previous: Address | undefined) {
  storage.set(STORAGE_KEYS.setupCreating, previous?.toLowerCase() ?? "");
}

export function endCreate() {
  storage.remove(STORAGE_KEYS.setupCreating);
}

export function creating(): boolean {
  return storage.getString(STORAGE_KEYS.setupCreating) !== undefined;
}

export function reconcileCreate(hint: Address | undefined) {
  const before = storage.getString(STORAGE_KEYS.setupCreating);
  if (before === undefined) return;
  endCreate();
  if (!hint || hint.toLowerCase() === before) return;
  if (read()[hint.toLowerCase()] === undefined) oweSetup(hint);
}
