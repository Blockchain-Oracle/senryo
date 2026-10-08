/**
 * The native account runtime. Platform pieces resolve through `@senryo/account`'s `react-native` export conditions
 * (Mera's React Native WebAuthn client over react-native-passkey 3.6.1, expo-secure-store with the biometric-gated
 * unlock item, no cross-tab sync). BIP-39 PBKDF2 runs natively through react-native-quick-crypto — the same function
 * the parity check proves equal to the web's JS path (checks/derivation.check.ts).
 */
import { AccountClient, type Flow, type Pbkdf2Sha512, type SessionSettings } from "@senryo/account";
import { passkeyPlatform } from "@senryo/account/passkey";
import { secretStore } from "@senryo/account/secret-store";
import { createSessionSync } from "@senryo/account/sync";
import { RP_ID } from "@senryo/config";
import { AppState } from "react-native";
import QuickCrypto from "react-native-quick-crypto";
import { type ForegroundSource, waitForAuthForeground } from "./foreground";
import { recordMeasure } from "./measure";
import { countingPrompts, type PromptOptions } from "./system-prompt";

const SHA512 = "sha512";

const APP_STATE: ForegroundSource = {
  current: () => AppState.currentState,
  subscribe: (listener) => {
    const sub = AppState.addEventListener("change", listener);
    return () => sub.remove();
  },
};
/** Face ID and passkey sheets resolve before iOS reports `active` again: nothing proceeds until it does. */
const settle = () => waitForAuthForeground(APP_STATE);
const STORE_PROMPTS: PromptOptions = { raises: new Set(["readUnlock", "storeUnlock"]), settle };
const PASSKEY_PROMPTS: PromptOptions = { raises: new Set(["createCredential", "getCredential"]), settle };

const pbkdf2: Pbkdf2Sha512 = (password, salt, rounds, keyLength) =>
  new Uint8Array(QuickCrypto.pbkdf2Sync(password, salt, rounds, keyLength, SHA512));

export function createNativeAccountClient(settings: SessionSettings, onExtraPrompt: (flow: Flow) => void) {
  return new AccountClient({
    rpId: RP_ID,
    // Counted so the privacy plate stays down behind the passkey and Face ID sheets (system-prompt.ts).
    passkey: {
      ...passkeyPlatform,
      webAuthnClient:
        passkeyPlatform.webAuthnClient && countingPrompts(passkeyPlatform.webAuthnClient, PASSKEY_PROMPTS),
    },
    store: countingPrompts(secretStore, STORE_PROMPTS),
    sync: createSessionSync(),
    pbkdf2,
    settings,
    measure: recordMeasure,
    onExtraPrompt,
  });
}
