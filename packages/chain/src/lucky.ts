/**
 * Lucky's seal (S8.8, D-295): the server commits to `keccak(serverSeed)` and to the market list a draw indexes into
 * before the player's seed exists; the draw's digest is keccak(serverSeed ‖ clientSeed ‖ owner ‖ marketsHash). Both
 * apps re-hash all three, so a draw can be checked without trusting the server's word.
 */
import { type Address, encodeAbiParameters, type Hex, keccak256, toBytes } from "viem";

export const luckyCommitmentOf = (serverSeed: Hex): Hex => keccak256(serverSeed);

/** The sealed list, in its order (the draw is an index into it). */
export const luckyMarketsHashOf = (markets: readonly string[]): Hex => keccak256(toBytes(markets.join(",")));

export const luckyDigestOf = (serverSeed: Hex, clientSeed: Hex, owner: Address, marketsHash: Hex): Hex =>
  keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "address" }, { type: "bytes32" }],
      [serverSeed, clientSeed, owner, marketsHash],
    ),
  );

/** Whether a revealed draw is the one sealed: the seed matches its commitment and the digest re-hashes. */
export function luckyVerifies(d: {
  serverSeed: Hex;
  commitment: Hex;
  clientSeed: Hex;
  owner: Address;
  markets: readonly string[];
  marketsHash: Hex;
  digest: Hex;
}): boolean {
  return (
    luckyCommitmentOf(d.serverSeed) === d.commitment.toLowerCase() &&
    luckyMarketsHashOf(d.markets) === d.marketsHash.toLowerCase() &&
    luckyDigestOf(d.serverSeed, d.clientSeed, d.owner, d.marketsHash) === d.digest.toLowerCase()
  );
}
