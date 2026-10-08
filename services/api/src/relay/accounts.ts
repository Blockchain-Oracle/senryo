import {
  type Address,
  addressOf,
  dollarTokenOf,
  grantSessionCallData,
  type Hex,
  mintDollarsCallData,
  type PermitArgs,
  type ReadClient,
  revokeCallData,
  sendTx,
  transferWithAuthorizationData,
} from "@senryo/chain";
import { type ChainId, TESTNET_CHAIN_ID } from "@senryo/config";
import { testUSDAbi } from "@senryo/contracts/abis";
import { type Db, type Logger, MS_PER_SECOND } from "@senryo/service-common";
import type { StreamBus } from "../stream/bus.ts";
import { PRACTICE_GRANT, PRACTICE_TOPUP_EVERY_MS } from "./constants.ts";
import type { Lane } from "./lanes.ts";

/**
 * Account-level relays: the owner's one Face ID session grant and its revocation (D-267), and Practice dollars
 * (D-258: Test USD minted by the sponsor's MINTER role — the grant at sign-up, then one top-up a day back to $1,000).
 * Every one is simulated, journaled and sent on the owner's lane; the chain checks the owner's signature.
 */

export interface RelayResult {
  txHash: Hex;
  state: "proposed" | "reverted";
}

export class AccountRelay {
  constructor(
    private readonly d: {
      chainId: ChainId;
      read: ReadClient;
      laneFor: (owner: Address) => Lane;
      bus: StreamBus;
      db: Db;
      log: Logger;
    },
  ) {}

  async grantSession(
    grant: {
      owner: Address;
      delegate: Address;
      perCallCap: bigint;
      sessionCap: bigint;
      expiry: bigint;
      epoch: number;
      nonce: bigint;
    },
    signature: Hex,
    permit: PermitArgs | null,
  ): Promise<RelayResult> {
    const data = grantSessionCallData(grant, signature, permit);
    const result = await this.send(grant.owner, data, "sessionGrant");
    this.d.bus.emit(`user:${grant.owner.toLowerCase()}`, "session", { delegate: grant.delegate, ...result });
    return result;
  }

  async revoke(owner: Address, nonce: bigint, deadline: bigint, signature: Hex): Promise<RelayResult> {
    const data = revokeCallData(owner, nonce, deadline, signature);
    const result = await this.send(owner, data, "sessionRevoke");
    this.d.bus.emit(`user:${owner.toLowerCase()}`, "session", { revoked: true, ...result });
    return result;
  }

  /** A withdrawal: the owner's signed EIP-3009 transfer, submitted on the dollar from the owner's lane. */
  async withdraw(
    a: { from: Address; to: Address; value: bigint; validAfter: bigint; validBefore: bigint; nonce: Hex },
    signature: Hex,
  ): Promise<RelayResult> {
    const dollar = dollarTokenOf(this.d.chainId);
    if (!dollar) throw new Error(`no dollar token on ${this.d.chainId}`);
    const data = transferWithAuthorizationData(a, signature);
    const sent = await this.d
      .laneFor(a.from)
      .run((sender) =>
        sendTx(sender, { to: dollar, data, action: "transferWithAuthorization", meta: { job: "withdraw" } }),
      );
    const result = { txHash: sent.hash, state: sent.stage } as const;
    this.d.bus.emit(`user:${a.from.toLowerCase()}`, "dollars", { amount: -a.value, txHash: sent.hash });
    return result;
  }

  /** Practice only: the first grant, then a daily top-up back to `PRACTICE_GRANT` when the balance is below it. */
  async practiceGrant(address: Address) {
    if (this.d.chainId !== TESTNET_CHAIN_ID)
      return { state: "unavailable" as const, amount: 0n, txHash: null, nextAt: null };
    const dollar = dollarTokenOf(this.d.chainId);
    if (!dollar) return { state: "unavailable" as const, amount: 0n, txHash: null, nextAt: null };
    const owner = address.toLowerCase();
    const [last] = await this.d.db<{ granted_at: Date }[]>`
      SELECT granted_at FROM practice_grants WHERE chain_id = ${this.d.chainId} AND address = ${owner}
      ORDER BY granted_at DESC LIMIT 1`;
    const nextAt = last ? last.granted_at.getTime() + PRACTICE_TOPUP_EVERY_MS : 0;
    if (last && Date.now() < nextAt) {
      return { state: "already" as const, amount: 0n, txHash: null, nextAt: Math.floor(nextAt / MS_PER_SECOND) };
    }
    const balance = await this.d.read.readContract({
      address: dollar,
      abi: testUSDAbi,
      functionName: "balanceOf",
      args: [address],
    });
    const amount = last ? (balance < PRACTICE_GRANT ? PRACTICE_GRANT - balance : 0n) : PRACTICE_GRANT;
    if (amount === 0n) return { state: "already" as const, amount: 0n, txHash: null, nextAt: null };
    const data = mintDollarsCallData(address, amount);
    const sent = await this.d
      .laneFor(address)
      .run((sender) => sendTx(sender, { to: dollar, data, action: "dollarMint", meta: { job: "practice-grant" } }));
    if (sent.stage === "reverted") throw new Error(`practice grant reverted in ${sent.hash}`);
    await this.d.db`INSERT INTO practice_grants (chain_id, address, amount, tx_hash)
                    VALUES (${this.d.chainId}, ${owner}, ${amount}, ${sent.hash})`;
    this.d.bus.emit(`user:${owner}`, "dollars", { amount, txHash: sent.hash });
    return { state: "granted" as const, amount, txHash: sent.hash, nextAt: null };
  }

  private async send(owner: Address, data: Hex, action: "sessionGrant" | "sessionRevoke"): Promise<RelayResult> {
    const sent = await this.d
      .laneFor(owner)
      .run((sender) => sendTx(sender, { to: addressOf(this.d.chainId, "BandReserve"), data, action }));
    return { txHash: sent.hash, state: sent.stage };
  }
}
