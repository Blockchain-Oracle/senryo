/**
 * User sends (S6.12 — the seam S8's trade flows call): `@senryo/chain` is the only sender, the Mera scoped signer is
 * its viem `account` (the policy runs before every signature; one Face ID read when locked), nonces run through
 * `@senryo/account`'s per-address queue around chain's `LocalNonceSource`, and the lifecycle journal lives in MMKV
 * (`kvJournal`) so an app kill mid-send reconciles the same signed bytes on the next launch.
 */
import { type AccountClient, type Address, type FaceIdMode, type PolicyContext, queuedNonces } from "@senryo/account";
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

/** The app's one viem read client (sends, the query layer's market/account reads). */
export function sharedRead(): ReadClient {
  read ??= createReadClient(ACTIVE_NETWORK.chainId);
  return read;
}

/** What a trade call site knows that the policy needs (S8): market room, equity, a label for the Face ID prompt. */
export type TradeContext = Pick<PolicyContext, "marketRoomUsd6" | "equityUsd6" | "marketLabel">;

/**
 * One sender per call site; the read client and the nonce counter are shared by the whole app. A trade passes its
 * `TradeContext` so the session policy can judge the open in scope instead of asking for a step-up.
 */
export function userSender(
  client: AccountClient,
  address: Address,
  faceId: FaceIdMode | undefined,
  trade?: TradeContext,
): Sender {
  const read = sharedRead();
  nonces ??= queuedNonces(new LocalNonceSource(read));
  const base = policyContext(address, faceId);
  return createSender({
    chainId: ACTIVE_NETWORK.chainId,
    account: client.signer(trade ? () => ({ ...base(), ...trade }) : base),
    read,
    nonces,
    journal: kvJournal(mmkv),
  });
}
