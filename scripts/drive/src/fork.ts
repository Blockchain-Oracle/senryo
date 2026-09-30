import { randomBytes } from "node:crypto";
import { contractCall, type Hex, signerFromPrivateKey } from "@senryo/chain";
import { CHAIN } from "./lib.ts";

/**
 * Anvil-fork fixtures (local only — never a real network): impersonated admin calls and balance cheats. Real sends
 * still go through @senryo/chain; these cheat RPCs exist only on anvil.
 */
export const DEPLOYER = "0x52d205731E97C90aAB738AE66371449F585C0E6A";
const CARD_OPERATOR_ROLE = 30n;
const ADMIN_GAS = "0x30d40";
const RICH = "0x8ac7230489e80000";
const PRIVATE_KEY_BYTES = 32;

let rpcId = 0;
export async function anvil<T = unknown>(url: string, method: string, params: unknown[]): Promise<T> {
  rpcId += 1;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result as T;
}

/** AccessManager roles used on the fork (contracts/src/libraries/Constants.sol). */
export const ROLES = { cardOperator: 30n, relayer: 60n } as const;

/** Grant roles as the (impersonated) deployer and give every listed address MON on the fork. */
export async function prepareFork(
  url: string,
  operators: readonly string[],
  funded: readonly string[],
  grants: ReadonlyArray<readonly [bigint, string]> = [],
) {
  await anvil(url, "anvil_impersonateAccount", [DEPLOYER]);
  await anvil(url, "anvil_setBalance", [DEPLOYER, RICH]);
  const all = [...operators.map((o) => [CARD_OPERATOR_ROLE, o] as const), ...grants];
  for (const [role, account] of all) {
    const call = contractCall(CHAIN, "AccessManager", "grantRole", [role, account as Hex, 0], "approve");
    await anvil(url, "eth_sendTransaction", [{ from: DEPLOYER, to: call.to, data: call.data, gas: ADMIN_GAS }]);
  }
  for (const address of [...operators, ...funded]) await anvil(url, "anvil_setBalance", [address, RICH]);
}

/** Throwaway fork user (never persisted). */
export function freshUser() {
  return signerFromPrivateKey(`0x${randomBytes(PRIVATE_KEY_BYTES).toString("hex")}`, "fork-user");
}
