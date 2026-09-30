/**
 * Native ceremonies: Mera's React Native client over `react-native-passkey@3.6.1` (platform authenticator only — the
 * general iOS entry point could offer a security key without PRF). Needs the associated domain / assetlinks on the rpId.
 */
import { reactNativeWebAuthnClient } from "@category-labs/mera/react-native-webauthn-client";
import type { PasskeyPlatform } from "./types.ts";

export const passkeyPlatform: PasskeyPlatform = { kind: "native", webAuthnClient: reactNativeWebAuthnClient };
