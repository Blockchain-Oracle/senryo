// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// New for Senryo v3 (D-300). The pool priced every call on one admin σ per series, so σ couldn't follow the market
// without a global version bump refusing everything in flight. Now the keeper signs each feed's σ every minute and a
// fill carries the one mark its instant allows — nobody can pick between marks, and none can come from after the fill.

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./MarketTypes.sol";

/// @title SigmaMarks — the keeper's per-minute volatility, signed, checked at the fill.
abstract contract SigmaMarks is EIP712 {
    bytes32 public constant SIGMA_MARK_TYPEHASH =
        keccak256("SigmaMark(bytes32 feedId,uint40 minute,uint64 fastE8,uint64 slowE8)");

    /// @notice Keys allowed to sign σ marks (the keeper's, and the relay's so a fill never waits on one service).
    mapping(address signer => bool) public sigmaSigner;

    event SigmaSignerSet(address indexed signer, bool allowed);

    error BadSigmaMark(bytes32 feedId, uint40 minute);

    /// @notice The minute boundary whose mark a fill at `target` carries: the last one `SIGMA_MARK_LAG_SEC` or more
    ///         before it (the keeper signs a few seconds after each boundary).
    function markMinuteOf(uint40 target) public pure returns (uint40) {
        uint40 t = target - SIGMA_MARK_LAG_SEC;
        return t - t % SIGMA_MARK_STEP_SEC;
    }

    function hashSigmaMark(SigmaMark calldata m) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(SIGMA_MARK_TYPEHASH, m.feedId, m.minute, m.fastE8, m.slowE8)));
    }

    /// @dev The mark is `feedId`'s for exactly the minute `target` allows, both σ positive, signed by an allowed key.
    function _checkMark(SigmaMark calldata m, bytes calldata sig, bytes32 feedId, uint40 target) internal view {
        if (m.feedId != feedId || m.minute != markMinuteOf(target) || m.fastE8 == 0 || m.slowE8 == 0) {
            revert BadSigmaMark(m.feedId, m.minute);
        }
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hashSigmaMark(m), sig);
        if (err != ECDSA.RecoverError.NoError || !sigmaSigner[signer]) revert BadSigmaMark(m.feedId, m.minute);
    }

    function _setSigmaSigner(address signer, bool allowed) internal {
        sigmaSigner[signer] = allowed;
        emit SigmaSignerSet(signer, allowed);
    }
}
