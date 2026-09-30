/**
 * User sends (S6.12 — the seam S8's trade flows call): `@senryo/chain` is the only sender, the Mera scoped signer is
 * its viem `account` (the policy runs before every signature; one prompt when locked), nonces run through
 * `@senryo/account`'s per-address queue around chain's `LocalNonceSource`, and the lifecycle journal lives in
 * localStorage (`kvJournal`) so a reload mid-send reconciles the same signed bytes. Import this lazily — chain carries
 * the contract ABIs, which stay out of the landing bundle.
 */
import { type AccountClient, type Address, type FaceIdMode, queuedNonces } from "@senryo/account";
import {
  createReadClient,
  createSender,
  kvJournal,
  LocalNonceSource,
  type NonceSource,
  type ReadClient,
  type Sender,
} from "@senryo/chain";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { policyContext } from "./api";
import { kvStore } from "./local";

let read: ReadClient | undefined;
let nonces: NonceSource | undefined;

/** One sender per call site; the read client and the nonce counter are shared by the whole tab. */
export function userSender(client: AccountClient, address: Address, faceId: FaceIdMode | undefined): Sender {
  read ??= createReadClient(ACTIVE_NETWORK.chainId);
  nonces ??= queuedNonces(new LocalNonceSource(read));
  return createSender({
    chainId: ACTIVE_NETWORK.chainId,
    account: client.signer(policyContext(address, faceId)),
    read,
    nonces,
    journal: kvJournal(kvStore),
  });
}
