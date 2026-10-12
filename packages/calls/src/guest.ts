/**
 * A guest's Practice key (R5.10): the first call needs no sign-in. On Practice, a visitor's first tap makes a plain key
 * on this device — kept like a one-tap delegate (SecureStore on the phone; the browser's store on the web, so a reload
 * keeps the guest's test dollars and positions) — which signs in by SIWE, takes the Practice grant and signs its own
 * calls and rides with no prompt. When the visitor makes a passkey, its dollars move to the new account by an EIP-3009
 * transfer (`useGuestSweep`) and the key is forgotten once nothing of it is left open. Real never uses it: it holds test
 * dollars only. viem's key code loads with the first use, never in a page's first load.
 */
import type { LocalAccount } from "@senryo/account";
import type { Caller } from "./caller.ts";

/** The platform store the key lives in (the one-tap delegate's shape). */
export interface GuestStore {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const keys = () => import("@senryo/account/guest-key");

let store: GuestStore | undefined;
/** undefined: not read yet; null: no guest on this device. */
let current: LocalAccount | null | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

async function load(): Promise<void> {
  const s = store;
  current = s ? ((await (await keys()).readGuestKey(s).catch(() => undefined)) ?? null) : null;
  emit();
}

/** Each app names its store once at start; the key is read from it straight away. */
export function configureGuestStore(s: GuestStore): void {
  store = s;
  void load();
}

export function subscribeGuest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const guestNow = (): LocalAccount | null | undefined => current;

/** The guest's key, made on the first call that needs it. */
export async function makeGuest(): Promise<LocalAccount> {
  if (current) return current;
  if (!store) throw new Error("No store for the practice key");
  const made = await (await keys()).createGuestKey(store);
  current = made;
  emit();
  return made;
}

/** Forget the key (everything it held has moved to the account). */
export async function forgetGuest(): Promise<void> {
  if (store) await (await keys()).forgetGuestKey(store);
  current = null;
  emit();
}

/** The guest as a caller: it signs each action itself, with no prompt. */
export const guestCaller = (key: LocalAccount): Caller => ({
  client: { stepUp: (fn) => fn(key) },
  hint: { address: key.address },
});
