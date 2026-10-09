// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Ported from Mitoshi (crypto-world-fair) contracts/src/engine/verifiers/lib/RedStonePayload.sol, itself from Agari's
// `print/redstone.rs` — our own parser; RedStone's BUSL-1.1 EVM connector is never used (D-284).

/// @dev A package or trailer that is not the single-feed, 32-byte-value layout below.
error BadRedStonePackage();

/// @title The RedStone wire payload, read in place from calldata: `N × package ‖ N[2] ‖ metaSize[3] = 0 ‖ marker[9]`,
///        each package `feedId[32] ‖ value[32] ‖ ts_ms[6] ‖ valueSize[4] = 32 ‖ pointCount[3] = 1 ‖ r[32] ‖ s[32] ‖
///        v[1]` (142 bytes).
library RedStonePayload {
    uint256 internal constant PACKAGE_LEN = 142;
    uint256 internal constant TRAILER_LEN = 14;
    uint256 internal constant MARKER_LEN = 9;
    uint256 internal constant META_LEN = 3;
    uint256 internal constant COUNT_LEN = 2;
    bytes9 internal constant MARKER = 0x000002ed57011e0000;

    uint256 internal constant FEED_END = 32;
    uint256 internal constant VALUE_END = 64;
    uint256 internal constant TS_END = 70;
    uint256 internal constant SIZE_END = 74;
    /// @dev The signed part of a package: everything before the signature.
    uint256 internal constant SIGNED_LEN = 77;
    uint256 internal constant R_END = 109;
    uint256 internal constant S_END = 141;
    uint256 internal constant VALUE_SIZE = 32;
    uint8 internal constant V_BASE = 27;
    uint256 internal constant BYTE_BITS = 8;

    /// @notice No crypto yet: the marker, empty unsigned metadata, `1 ≤ N ≤ maxN`, the exact length, and every package
    ///         a single feed with a 32-byte value. Returns N, which bounds all later work.
    function preparse(bytes calldata p, uint256 maxN) internal pure returns (uint256 n) {
        uint256 len = p.length;
        if (len < TRAILER_LEN || bytes9(p[len - MARKER_LEN:len]) != MARKER) revert BadRedStonePackage();
        if (_be(p[len - MARKER_LEN - META_LEN:len - MARKER_LEN]) != 0) revert BadRedStonePackage();
        n = _be(p[len - TRAILER_LEN:len - TRAILER_LEN + COUNT_LEN]);
        if (n == 0 || n > maxN || len != PACKAGE_LEN * n + TRAILER_LEN) revert BadRedStonePackage();
        for (uint256 i; i < n; ++i) {
            uint256 at = i * PACKAGE_LEN;
            if (_be(p[at + SIZE_END:at + SIGNED_LEN]) != 1 || _be(p[at + TS_END:at + SIZE_END]) != VALUE_SIZE) {
                revert BadRedStonePackage();
            }
        }
    }

    function feedId(bytes calldata p, uint256 i) internal pure returns (bytes32) {
        return bytes32(p[i * PACKAGE_LEN:i * PACKAGE_LEN + FEED_END]);
    }

    function value(bytes calldata p, uint256 i) internal pure returns (uint256) {
        return uint256(bytes32(p[i * PACKAGE_LEN + FEED_END:i * PACKAGE_LEN + VALUE_END]));
    }

    function timestampMs(bytes calldata p, uint256 i) internal pure returns (uint256) {
        return _be(p[i * PACKAGE_LEN + VALUE_END:i * PACKAGE_LEN + TS_END]);
    }

    /// @notice `keccak256` of the signed bytes and the `(v, r, s)` that sign them (`v` 0/1 read as 27/28).
    function signature(bytes calldata p, uint256 i)
        internal
        pure
        returns (bytes32 digest, uint8 v, bytes32 r, bytes32 s)
    {
        uint256 at = i * PACKAGE_LEN;
        digest = keccak256(p[at:at + SIGNED_LEN]);
        r = bytes32(p[at + SIGNED_LEN:at + R_END]);
        s = bytes32(p[at + R_END:at + S_END]);
        v = uint8(p[at + S_END]);
        if (v < V_BASE) v += V_BASE;
    }

    function _be(bytes calldata b) private pure returns (uint256 x) {
        for (uint256 i; i < b.length; ++i) {
            x = (x << BYTE_BITS) | uint8(b[i]);
        }
    }
}
