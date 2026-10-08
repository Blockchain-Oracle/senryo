/**
 * One-tap calls (D-267, D-280): a session delegate key made on this device. The owner signs one `SessionGrant` under
 * Face ID naming it; from then until expiry the delegate signs calls itself, and `BandReserve` enforces the caps
 * (per call, per session) and the owner's epoch (a revoke kills every outstanding signature). The account key never
 * signs in a session — its typed-data policy keeps every EIP-712 request behind a step-up.
 */
import type { LocalAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { STORAGE } from "./constants.ts";
import type { DelegateStore } from "./platform/types.ts";

const keyOf = (owner: string, chainId: number) => `${STORAGE.delegate}.${chainId}.${owner.toLowerCase()}`;
const PRIVATE_KEY = /^0x[0-9a-f]{64}$/i;

export class DelegateKeys {
  constructor(private readonly store: DelegateStore) {}

  /** This device's delegate for `owner` on `chainId`, if one was made. */
  async get(owner: string, chainId: number): Promise<LocalAccount | undefined> {
    const raw = await this.store.read(keyOf(owner, chainId));
    return raw && PRIVATE_KEY.test(raw) ? privateKeyToAccount(raw as `0x${string}`) : undefined;
  }

  /** A fresh delegate (replacing any previous one): the next grant names it. */
  async create(owner: string, chainId: number): Promise<LocalAccount> {
    const key = generatePrivateKey();
    await this.store.write(keyOf(owner, chainId), key);
    return privateKeyToAccount(key);
  }

  /** Forget the delegate (sign-out, revoke, expiry). */
  async forget(owner: string, chainId: number): Promise<void> {
    await this.store.remove(keyOf(owner, chainId));
  }
}
