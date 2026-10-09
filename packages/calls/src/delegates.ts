/**
 * This device's one-tap delegate keys (D-280): ungated, device-only — SecureStore on the phone, the browser's store on
 * the web (`@senryo/account/delegate-store` resolves per platform).
 */
import { DelegateKeys } from "@senryo/account";
import { delegateStore } from "@senryo/account/delegate-store";

let keys: DelegateKeys | undefined;

export function appDelegates(): DelegateKeys {
  keys ??= new DelegateKeys(delegateStore);
  return keys;
}
