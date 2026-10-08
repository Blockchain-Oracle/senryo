# Pyth boundary oracle

`PythBoundaryOracle` is the one piece kept from the earlier binary-market prototype (`SenryoBinaryV1` and
`BinaryMath` were deleted in the D-256 pivot, never deployed). It is undeployed Practice source: S2 generalises it into
`contracts/src/markets/PythPrintVerifier.sol`, the verifier every window's open and close print goes through (D-259).

## What it proves

- **Identity.** The constructor rejects any chain except Monad testnet (10143) and any receiver except Pyth's
  testnet receiver `0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379`, which must have code. Nothing is upgradeable.
- **The boundary print.** `verify(feed, boundary, proof)` calls `parsePriceFeedUpdatesUnique` over
  `[boundary, boundary + BOUNDARY_GRACE]` (5 s), so only the first print at or after the boundary can resolve it; a
  latest display price never can. The fee must be paid exactly.
- **Time.** The publish time must sit inside the window and not be after the block's timestamp. Block time only rejects
  future prints; it never selects a settlement price.
- **Quality.** A positive price at most `MAX_PRICE` (1e16) with exponent −8, and confidence at most
  `MAX_CONFIDENCE_BPS` (25 bps) of the price. A low-quality print is returned with `quality = false`: the caller voids
  and refunds instead of settling (D-259).
- **Evidence.** `proofHash = keccak256(abi.encode(proof))` lets the Proof page re-verify the exact bytes.

## Facts it relies on

The public boundary payloads replayed against the testnet receiver are recorded in
`docs/design/reviews/2026-10-08-public-boundary-proofs.md`. The mainnet receiver is chosen in S2 by testing a keyed
payload against both candidates (D-259).
