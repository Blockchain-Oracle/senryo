/**
 * Runtime env for handlers and effects (config.yaml interpolates its own ENVIO_* values). Every name carries the
 * ENVIO_ prefix (Envio Cloud only exposes those). Bad values fail at startup, never mid-sync.
 */
import { DEFAULT_APP_LAUNCH_BLOCK_143, DEFAULT_ARCHIVE_RPC, MAINNET_CHAIN_ID } from "./constants.ts";

function blockNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a block number, got "${raw}"`);
  return Number.parseInt(raw, 10);
}

/** Perpl noisy events start here, per chain (only 143 indexes Perpl today). */
export const APP_LAUNCH_BLOCK: Readonly<Record<number, number>> = {
  [MAINNET_CHAIN_ID]: blockNumber("ENVIO_APP_LAUNCH_BLOCK_143", DEFAULT_APP_LAUNCH_BLOCK_143),
};

/** Our Perpl builder id (1..255, Q-003). 0 = none, so builder volume stays 0 until Perpl assigns one. */
export const PERPL_BUILDER_ID: bigint = (() => {
  const raw = process.env.ENVIO_PERPL_BUILDER_ID ?? "";
  if (raw === "") return 0n;
  if (!/^\d+$/.test(raw)) throw new Error(`ENVIO_PERPL_BUILDER_ID must be an integer, got "${raw}"`);
  return BigInt(raw);
})();

/** Archive-capable RPC for historical eth_call per chain (ENVIO_ARCHIVE_RPC_URL_<chainId>). */
export function archiveRpcUrl(chainId: number): string {
  const url = process.env[`ENVIO_ARCHIVE_RPC_URL_${chainId}`] || DEFAULT_ARCHIVE_RPC[chainId];
  if (!url) throw new Error(`no archive RPC for chain ${chainId}: set ENVIO_ARCHIVE_RPC_URL_${chainId}`);
  return url;
}
