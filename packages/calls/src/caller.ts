/**
 * Who is calling: each app's account provider (`useAccount()` on the phone and the web) already has this shape — the
 * account runtime once it has loaded, and the hint naming this device's account — and so does a guest's Practice key
 * on this device (`guestCaller`, R5.10), which signs with no prompt.
 */
import type { Address, LocalAccount } from "@senryo/account";

/** What signing needs of an account: one signer for one action, behind whatever the account asks (a passkey, or none). */
export interface Signing {
  stepUp<T>(fn: (signer: LocalAccount) => Promise<T>, prompt?: string): Promise<T>;
}

export interface Caller {
  client: Signing | undefined;
  hint: { address: Address } | undefined;
}
