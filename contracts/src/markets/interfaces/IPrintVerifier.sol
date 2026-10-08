// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Ported from CWF d7b576b:contracts/src/engine/interfaces/IPrintVerifier.sol — narrowed to one source family and made
// payable (Pyth charges an update fee). The quality bound, grace and admission window are the verifier's own
// immutables, so a print recorded for `(verifier, feedId, t)` means the same thing for every series that uses it.

/// @title A stateless proof checker for the unique print at an instant (D-259).
interface IPrintVerifier {
    /// @notice Seconds after `t` a print for `t` may still be recorded; after that the slot is missed for good.
    function admissionSec() external view returns (uint32);

    /// @notice The fee `verifyPrint` must be sent with for this proof.
    function fee(bytes calldata proof) external view returns (uint256);

    /// @notice Proves the first print at or after `t` (within the verifier's grace), normalised to e-8. Reverts on a
    ///         wrong fee, a non-unique or late print, a future publish time or a print outside the quality bound.
    function verifyPrint(bytes calldata proof, bytes32 feedId, uint40 t)
        external
        payable
        returns (int64 priceE8, uint64 confE8, uint40 publishTime);
}
