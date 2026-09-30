/**
 * User sends (S6.12 — the seam S8's trade flows call): `@senryo/chain` is the only sender, the Mera scoped signer is
 * its viem `account` (the policy runs before every signature; one Face ID read when locked), nonces run through
 * `@senryo/account`'s per-address queue around chain's `LocalNonceSource`, and the lifecycle journal lives in MMKV
 * (`kvJournal`) so an app kill mid-send reconciles the same signed bytes on the next launch.
 */
import { type AccountClient, type Address, type FaceIdMode, queuedNonces } from "@senryo/account";
import {
  createReadClient,
  createSender,
  type KvStore,
  kvJournal,
  LocalNonceSource,
  type NonceSource,
  type ReadClient,
  type Sender,
} from "@senryo/chain";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { storage } from "~/lib/storage";
import { policyContext } from "./api";

const mmkv: KvStore = {
  getItem: (key) => storage.getString(key),
  setItem: (key, value) => storage.set(key, value),
};

let read: ReadClient | undefined;
let nonces: NonceSource | undefined;

/** One sender per call site; the read client and the nonce counter are shared by the whole app. */
export function userSender(client: AccountClient, address: Address, faceId: FaceIdMode | undefined): Sender {
  read ??= createReadClient(ACTIVE_NETWORK.chainId);
  nonces ??= queuedNonces(new LocalNonceSource(read));
  return createSender({
    chainId: ACTIVE_NETWORK.chainId,
    account: client.signer(policyContext(address, faceId)),
    read,
    nonces,
    journal: kvJournal(mmkv),
  });
}
