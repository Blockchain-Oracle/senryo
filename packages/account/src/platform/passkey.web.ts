/** Web ceremonies: Mera's default browser client (`navigator.credentials`), same rpId as the apps (D-011). */
import type { PasskeyPlatform } from "./types.ts";

export const passkeyPlatform: PasskeyPlatform = { kind: "web", webAuthnClient: undefined };
