/**
 * Dry-run of a Perpl sequence with `eth_simulateV1` (one block, calls in order, state carried between them — Monad's
 * public RPC serves it): what each step would revert with, and what the order would fill, before anything is signed.
 * Read-only. `stateOverrides` exists for checks (crediting a throwaway wallet); the app passes none.
 */
import { type Address, encodeAbiParameters, type Hex, keccak256, type Log, type StateOverride, toHex } from "viem";
import type { ReadClient } from "../clients.ts";
import { decodeRevert } from "../errors.ts";
import type { TxRequest } from "../send.ts";

const WORD_BYTES = 32;

/**
 * A simulation-only override writing `value` into `mapping(address => …)` entry `key` of `contract`, whose mapping
 * lives at `baseSlot` (Solidity layout: keccak256(abi.encode(key, baseSlot))). For checks that credit a throwaway
 * wallet; never used for anything sent.
 */
export function mappingSlotOverride(
  contract: Address,
  baseSlot: Hex,
  key: Address,
  value: bigint,
): StateOverride[number] {
  const slot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [key, baseSlot]));
  return { address: contract, stateDiff: [{ slot, value: toHex(value, { size: WORD_BYTES }) }] };
}

/** Per-call gas in a simulation: generous, so a step's outcome never depends on it (Monad reports this as used). */
const SIMULATION_CALL_GAS = 5_000_000n;

export interface SimulatedStep {
  action: TxRequest["action"];
  ok: boolean;
  /** The decoded revert when the step failed (`AccountDoesNotExist(…)`, `PriceOutOfRange(…)`, …). */
  revert: string | undefined;
  /** The step's logs (feed them to `decodePerplOrder` / `decodePerplCollateral`). */
  logs: Log[];
}

export async function simulatePerplSteps(
  read: ReadClient,
  from: Address,
  requests: readonly TxRequest[],
  stateOverrides?: StateOverride,
): Promise<SimulatedStep[]> {
  const [block] = await read.simulateBlocks({
    blocks: [
      {
        ...(stateOverrides ? { stateOverrides } : {}),
        calls: requests.map((r) => ({
          account: from,
          to: r.to,
          data: r.data,
          value: r.value ?? 0n,
          gas: SIMULATION_CALL_GAS,
        })),
      },
    ],
  });
  return (block?.calls ?? []).map((call, i) => ({
    action: requests[i]?.action ?? "perplOrder",
    ok: call.status === "success",
    revert:
      call.status === "success" ? undefined : (decodeRevert(call.error)?.message ?? call.error?.message ?? "reverted"),
    logs: call.logs ?? [],
  }));
}
