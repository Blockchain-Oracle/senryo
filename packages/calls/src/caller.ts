/**
 * Who is calling: each app's account provider (`useAccount()` on the phone and the web) already has this shape — the
 * account runtime once it has loaded, and the hint naming this device's account.
 */
import type { AccountClient, Address } from "@senryo/account";

export interface Caller {
  client: AccountClient | undefined;
  hint: { address: Address } | undefined;
}
