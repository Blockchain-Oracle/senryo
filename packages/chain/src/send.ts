import { type ChainId, GAS_HEADROOM_BPS, GAS_LIMITS, type GasAction } from "@senryo/config";
import type { TxStage } from "@senryo/core";
import {
  type Address,
  type Hex,
  keccak256,
  type LocalAccount,
  type SignedAuthorization,
  type TransactionReceipt,
} from "viem";
import { createBroadcastClients, createReadClient, type ReadClient, type RpcOverrides } from "./clients.ts";
import { type Confirmation, confirmFinalized } from "./confirm.ts";
import { BPS, POLL_INTERVAL_MS, RECEIPT_TIMEOUT_MS, SEND_SYNC_TIMEOUT_MS } from "./constants.ts";
import { BroadcastError, decodeRevert, describeError, GasAboveCapError, SimulationRevertedError } from "./errors.ts";
import { FeeCache } from "./fees.ts";
import type { HeadTracker } from "./heads.ts";
import type { TxJournal } from "./journal.ts";
import { LocalNonceSource, type NonceSource } from "./nonce.ts";

/**
 * The only send path in the repo (invariant `write-boundary`). Every tx carries an explicit gas limit — Monad charges
 * the LIMIT — computed as `eth_estimateGas` (which is also the simulation: a revert here means nothing is sent)
 * × (1 + GAS_HEADROOM_BPS), capped at the action's budget from `GAS_LIMITS`; an estimate above the budget refuses to
 * send. Hot paths (card holds) pass a pre-calibrated `fixedGas` instead of estimating. The gas field is never left unset.
 *
 * Broadcast: the same signed bytes go to two RPCs with `eth_sendRawTransactionSync` (D-027); if neither returns a
 * receipt, `eth_sendRawTransaction` + receipt polling. The receipt from a sync send is at `proposed`; money paths then
 * `confirmFinalized`. Journalled before broadcast; re-broadcast of the same bytes is the only retry.
 */

export interface Sender {
  chainId: ChainId;
  account: LocalAccount;
  read: ReadClient;
  broadcast: ReadClient[];
  nonces: NonceSource;
  fees: FeeCache;
  journal?: TxJournal | undefined;
  heads?: HeadTracker | undefined;
}

export interface CreateSenderOptions {
  chainId: ChainId;
  account: LocalAccount;
  rpc?: RpcOverrides | undefined;
  read?: ReadClient | undefined;
  journal?: TxJournal | undefined;
  heads?: HeadTracker | undefined;
  nonces?: NonceSource | undefined;
  fees?: FeeCache | undefined;
}

export function createSender(options: CreateSenderOptions): Sender {
  const read = options.read ?? createReadClient(options.chainId, options.rpc);
  return {
    chainId: options.chainId,
    account: options.account,
    read,
    broadcast: createBroadcastClients(options.chainId, options.rpc),
    nonces: options.nonces ?? new LocalNonceSource(read),
    fees: options.fees ?? new FeeCache(read),
    journal: options.journal,
    heads: options.heads,
  };
}

export interface TxRequest {
  to: Address;
  data: Hex;
  value?: bigint | undefined;
  /** Budget key in `GAS_LIMITS`. */
  action: GasAction;
  /** Budget override (e.g. `liquidateGasLimit(positions)`); still an upper bound. */
  gasCap?: bigint | undefined;
  /** Skip the estimate and use this explicit limit (pre-calibrated hot paths); must be ≤ the budget. */
  fixedGas?: bigint | undefined;
  /**
   * EIP-7702 authorizations (signed by each EOA behind a step-up, `@senryo/account` `signDelegation`): present → a
   * type-4 tx, e.g. the sponsor delegating a user's EOA (D-145, D-155). Monad supports type 4; clear = authorize `0x0`.
   */
  authorizationList?: readonly SignedAuthorization[] | undefined;
  meta?: Record<string, string> | undefined;
}

export interface SentTx {
  hash: Hex;
  nonce: number;
  gas: bigint;
  receipt: TransactionReceipt;
  /** `proposed` on success, `reverted` when the receipt status is 0 (gas was still paid). */
  stage: Extract<TxStage, "proposed" | "reverted">;
}

/** estimate × (1 + headroom), capped; refuses when the estimate alone is above the cap. */
export function gasWithHeadroom(estimate: bigint, cap: bigint, action: string): bigint {
  if (estimate > cap) throw new GasAboveCapError(action, estimate, cap);
  const padded = (estimate * (BPS + GAS_HEADROOM_BPS)) / BPS;
  return padded < cap ? padded : cap;
}

/** Simulate (eth_estimateGas) and size the gas limit — throws `SimulationRevertedError` with the decoded revert. */
export async function planGas(sender: Sender, req: TxRequest): Promise<bigint> {
  const cap = req.gasCap ?? GAS_LIMITS[req.action];
  if (req.fixedGas !== undefined) {
    if (req.fixedGas > cap) throw new GasAboveCapError(req.action, req.fixedGas, cap);
    return req.fixedGas;
  }
  let estimate: bigint;
  try {
    estimate = await sender.read.estimateGas({
      account: sender.account.address,
      to: req.to,
      data: req.data,
      value: req.value ?? 0n,
      ...(req.authorizationList ? { authorizationList: [...req.authorizationList] } : {}),
    });
  } catch (error) {
    throw new SimulationRevertedError(req.action, decodeRevert(error), error);
  }
  return gasWithHeadroom(estimate, cap, req.action);
}

async function broadcast(sender: Sender, raw: Hex, hash: Hex): Promise<TransactionReceipt> {
  try {
    return await Promise.any(
      sender.broadcast.map((client) =>
        client.sendRawTransactionSync({
          serializedTransaction: raw,
          timeout: SEND_SYNC_TIMEOUT_MS,
          throwOnReceiptRevert: false,
        }),
      ),
    );
  } catch (syncFailure) {
    // Fallback (D-027): plain send (an "already known" error means a sync copy got through) + receipt polling.
    await sender.read.sendRawTransaction({ serializedTransaction: raw }).catch(() => undefined);
    try {
      return await sender.read.waitForTransactionReceipt({
        hash,
        pollingInterval: POLL_INTERVAL_MS,
        timeout: RECEIPT_TIMEOUT_MS,
      });
    } catch {
      throw new BroadcastError(hash, syncFailure);
    }
  }
}

/** Sign, journal and broadcast one tx; resolves at `proposed` (or `reverted`). */
export async function sendTx(sender: Sender, req: TxRequest): Promise<SentTx> {
  const gas = await planGas(sender, req);
  const fees = await sender.fees.get();
  const from = sender.account.address;
  const signed = await sender.nonces.withNext(from, async (nonce) => {
    const common = {
      chainId: sender.chainId,
      to: req.to,
      data: req.data,
      value: req.value ?? 0n,
      gas,
      nonce,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    };
    const raw = await sender.account.signTransaction(
      req.authorizationList
        ? { ...common, type: "eip7702", authorizationList: [...req.authorizationList] }
        : { ...common, type: "eip1559" },
    );
    const hash = keccak256(raw);
    const now = Date.now();
    await sender.journal?.put({
      hash,
      chainId: sender.chainId,
      from,
      to: req.to,
      nonce,
      gas: gas.toString(),
      action: req.action,
      raw,
      stage: "submitted",
      createdAt: now,
      updatedAt: now,
      meta: req.meta,
    });
    return { raw, hash, nonce };
  });

  let receipt: TransactionReceipt;
  try {
    receipt = await broadcast(sender, signed.raw, signed.hash);
  } catch (error) {
    sender.nonces.resync(from);
    await sender.journal?.update(signed.hash, { error: describeError(error) });
    throw error;
  }
  const stage = receipt.status === "success" ? "proposed" : "reverted";
  await sender.journal?.update(signed.hash, {
    stage,
    blockNumber: receipt.blockNumber.toString(),
    blockHash: receipt.blockHash,
  });
  return { hash: signed.hash, nonce: signed.nonce, gas, receipt, stage };
}

/** `sendTx` then wait for "finalized" — the default for anything that moves money. */
export async function sendAndFinalize(sender: Sender, req: TxRequest): Promise<SentTx & { final: Confirmation }> {
  const sent = await sendTx(sender, req);
  const final = await confirmFinalized({ read: sender.read, heads: sender.heads }, sent.receipt);
  // The proposal carrying it was dropped: the local counter already moved past its nonce (S8.5b K7).
  if (final.stage === "abandoned") sender.nonces.resync(sender.account.address);
  await sender.journal?.update(sent.hash, {
    stage: final.stage,
    blockNumber: final.receipt?.blockNumber.toString(),
    blockHash: final.receipt?.blockHash,
  });
  return { ...sent, final };
}
