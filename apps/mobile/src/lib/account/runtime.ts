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
import QuickCrypto from "react-native-quick-crypto";
import { recordMeasure } from "./measure";

const SHA512 = "sha512";

const pbkdf2: Pbkdf2Sha512 = (password, salt, rounds, keyLength) =>
  new Uint8Array(QuickCrypto.pbkdf2Sync(password, salt, rounds, keyLength, SHA512));

export function createNativeAccountClient(settings: SessionSettings, onExtraPrompt: (flow: Flow) => void) {
  return new AccountClient({
    rpId: RP_ID,
    passkey: passkeyPlatform,
    store: secretStore,
    sync: createSessionSync(),
    pbkdf2,
    settings,
    measure: recordMeasure,
    onExtraPrompt,
  });
}
