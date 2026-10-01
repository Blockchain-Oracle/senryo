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
import type { ChainId } from "@senryo/config";
import { userFeeCache } from "@senryo/query";
import { activeNetwork } from "~/lib/network";
import { storage } from "~/lib/storage";
import { policyContext } from "./api";

const mmkv: KvStore = {
  getItem: (key) => storage.getString(key),
  setItem: (key, value) => storage.set(key, value),
};

/**
 * One read client and one nonce counter PER CHAIN (S8.22): a nonce cached for an address on practice must never be
 * reused on mainnet (the counter is keyed by address only), and reads must follow the selected network.
 */
const reads = new Map<ChainId, ReadClient>();
const nonceSources = new Map<ChainId, NonceSource>();

/** The app's viem read client for a chain (default: the selected network). */
export function sharedRead(chainId: ChainId = activeNetwork().chainId): ReadClient {
  let read = reads.get(chainId);
  if (!read) {
    read = createReadClient(chainId);
    reads.set(chainId, read);
  }
  return read;
}

function sharedNonces(chainId: ChainId): NonceSource {
  let nonces = nonceSources.get(chainId);
  if (!nonces) {
    nonces = queuedNonces(new LocalNonceSource(sharedRead(chainId)));
    nonceSources.set(chainId, nonces);
  }
  return nonces;
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
  const chainId = activeNetwork().chainId;
  const read = sharedRead(chainId);
  const base = policyContext(address, faceId);
  return createSender({
    chainId,
    account: client.signer(trade ? () => ({ ...base(), ...trade }) : base),
    read,
    nonces: sharedNonces(chainId),
    journal: kvJournal(mmkv),
    // The same quote the gas budget uses (D-171): what the ticket checks is exactly what gets signed.
    fees: userFeeCache(read),
  });
}
