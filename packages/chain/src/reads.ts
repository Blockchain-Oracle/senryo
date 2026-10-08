/**
 * Consistent multi-reads: one Multicall3 `eth_call` at one block tag, so every field comes from the same state
 * (two separate "finalized" calls could straddle a new finalized block). Money decisions use "finalized"; Monad's
 * `latest` is only proposed (D-272).
 */
export type ReadTag = "latest" | "safe" | "finalized";
