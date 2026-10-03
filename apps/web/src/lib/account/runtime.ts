/**
 * The web account runtime — loaded with a dynamic `import()` after first paint so Mera, viem and the derivation code
 * stay out of the landing bundle (plan §2.4: landing ≤ 120 KB gz). Web platform pieces resolve through
 * `@senryo/account`'s `default` export conditions (browser WebAuthn client, hint-only store, BroadcastChannel sync).
 */
import { AccountClient, type Flow, type SessionSettings } from "@senryo/account";
import { passkeyPlatform } from "@senryo/account/passkey";
import { secretStore } from "@senryo/account/secret-store";
import { createSessionSync } from "@senryo/account/sync";
import { recordMeasure } from "./measure";
import { WEB_RP_ID } from "./rp";

export function createWebAccountClient(settings: SessionSettings, onExtraPrompt: (flow: Flow) => void): AccountClient {
  return new AccountClient({
    rpId: WEB_RP_ID,
    passkey: passkeyPlatform,
    store: secretStore,
    sync: createSessionSync(),
    settings,
    measure: recordMeasure,
    onExtraPrompt,
  });
}
