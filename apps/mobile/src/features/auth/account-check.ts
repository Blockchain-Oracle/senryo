/**
 * The backup-passkey trap (A3, defect 7): a discoverable sign-in may open any Senryo passkey, including a backup or an
 * old one whose account was never used. Before the phone adopts what opened, this asks whether that account is empty
 * — no profile on either network, no Practice dollars and no calls, read by the api (no RPC from the app, D-280).
 * Real's balance joins with the mainnet deploy (S9). Anything that can't be read answers "not empty": the check may
 * only ever add a warning, never block a sign-in.
 */
import type { Address } from "@senryo/account";
import { ApiError, marketAccountRoute, profileGetRoute, ticketsRoute } from "@senryo/api-client";
import { type ChainId, MAINNET, TESTNET } from "@senryo/config";
import { api } from "~/lib/account/api";

const HTTP_NOT_FOUND = 404;
const CHAINS: readonly ChainId[] = [TESTNET.chainId, MAINNET.chainId];

/** True only when the profile is provably absent on this network (404); a failed read is not evidence. */
async function noProfile(address: Address, chainId: ChainId): Promise<boolean> {
  try {
    await api().call(profileGetRoute, { params: { handleOrAddress: address }, query: { chainId } });
    return false;
  } catch (error) {
    return error instanceof ApiError && error.status === HTTP_NOT_FOUND;
  }
}

/** True only when the account holds no Practice dollars and has never made a call there. */
async function holdsNothing(address: Address): Promise<boolean> {
  try {
    const query = { chainId: TESTNET.chainId, owner: address };
    const [account, tickets] = await Promise.all([
      api().call(marketAccountRoute, { query }),
      api().call(ticketsRoute, { query }),
    ]);
    return account.balance === 0n && tickets.tickets.length === 0;
  } catch {
    return false;
  }
}

export async function isEmptyAccount(address: Address): Promise<boolean> {
  const checks = await Promise.all([...CHAINS.map((chainId) => noProfile(address, chainId)), holdsNothing(address)]);
  return checks.every(Boolean);
}
