/**
 * A guest's Practice key (R5.10): a plain key on this device, kept like the one-tap delegate (`delegate.ts`) in the
 * platform's delegate store. It is not an account — no passkey, no recovery — and holds test dollars only; the apps
 * move what it holds to the passkey account once one exists. Its own entry point (`@senryo/account/guest-key`), so
 * viem's key code loads with the first use.
 */
import type { LocalAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { STORAGE } from "./constants.ts";
import type { DelegateStore } from "./platform/types.ts";

const PRIVATE_KEY = /^0x[0-9a-f]{64}$/i;

export async function readGuestKey(store: DelegateStore): Promise<LocalAccount | undefined> {
  const raw = await store.read(STORAGE.guest);
  return raw && PRIVATE_KEY.test(raw) ? privateKeyToAccount(raw as `0x${string}`) : undefined;
}

export async function createGuestKey(store: DelegateStore): Promise<LocalAccount> {
  const key = generatePrivateKey();
  await store.write(STORAGE.guest, key);
  return privateKeyToAccount(key);
}

export async function forgetGuestKey(store: DelegateStore): Promise<void> {
  await store.remove(STORAGE.guest);
}
