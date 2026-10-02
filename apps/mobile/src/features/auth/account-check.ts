/**
 * The backup-passkey trap (A3, defect 7): a discoverable sign-in may open any Senryo passkey, including a backup or an
 * old one whose account was never used. Before the phone adopts what opened, this asks whether that account is empty
 * — no profile on either network and nothing held on either network. Until the any-asset holdings read (B1) ships,
 * "nothing held" is the portfolio snapshot (trading account, wallet dollars and MON) reading zero on both chains.
 * Anything that can't be read answers "not empty": the check may only ever add a warning, never block a sign-in.
 */
import type { Address } from "@senryo/account";
import { ApiError, profileGetRoute } from "@senryo/api-client";
import { readPortfolio } from "@senryo/chain";
import { type ChainId, MAINNET, TESTNET } from "@senryo/config";
import { api } from "~/lib/account/api";
import { sharedRead } from "~/lib/account/sender";

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

/** True only when every valued part of the portfolio reads exactly zero. */
async function holdsNothing(address: Address, chainId: ChainId): Promise<boolean> {
  try {
    const snapshot = await readPortfolio(sharedRead(chainId), chainId, address, () =>
      Promise.resolve({ ids: [], complete: true }),
    );
    return (
      snapshot.totalUsd6 === 0n && snapshot.components.every((c) => c.valueUsd6 === undefined || c.valueUsd6 === 0n)
    );
  } catch {
    return false;
  }
}

export async function isEmptyAccount(address: Address): Promise<boolean> {
  const checks = await Promise.all([
    ...CHAINS.map((chainId) => noProfile(address, chainId)),
    ...CHAINS.map((chainId) => holdsNothing(address, chainId)),
  ]);
  return checks.every(Boolean);
}
