/** This device's one-tap delegate keys (D-280): SecureStore, ungated, device-only. */
import { DelegateKeys } from "@senryo/account";
import { delegateStore } from "@senryo/account/delegate-store";

let keys: DelegateKeys | undefined;

export function appDelegates(): DelegateKeys {
  keys ??= new DelegateKeys(delegateStore);
  return keys;
}
