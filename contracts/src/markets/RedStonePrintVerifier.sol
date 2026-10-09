// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IPrintVerifier} from "./interfaces/IPrintVerifier.sol";
import {Median} from "./redstone/Median.sol";
import {RedStonePayload as P} from "./redstone/RedStonePayload.sol";

// Ported from Mitoshi (crypto-world-fair) contracts/src/engine/verifiers/RedStonePrintVerifier.sol onto Senryo's
// IPrintVerifier (D-284): our own MIT parser, never RedStone's BUSL-1.1 Solidity.

/// @title RedStonePrintVerifier — RedStone's signed prices as the unique print of an instant (D-284).
/// @notice RedStone signs on a 10-second grid, so the print of `t` is the grid point at or after it, `ceil10(t)`: fixed
///         by the instant, never chosen by the poster (a fill at `t` waits up to 10 s for its print). Every package
///         names the market's feed and that exact time; each is signed by a distinct configured signer. While the grid
///         point is fresh (`strictSec`) every signer must be present — a poster can't pick a subset to move the median —
///         after it `threshold` will do. The price is the median of the signed values (even count: floored average),
///         the confidence half their spread, both already at e-8. Free to call (no fee).
contract RedStonePrintVerifier is IPrintVerifier {
    uint256 public constant MAX_SIGNERS = 5;
    uint40 public constant GRID_SEC = 10;
    uint256 internal constant MS_PER_SEC = 1000;
    uint256 internal constant HALF = 2;
    /// @dev Signer slots (immutables can't be an array).
    uint256 private constant SLOT_2 = 2;
    uint256 private constant SLOT_3 = 3;
    uint256 private constant SLOT_4 = 4;

    address private immutable _s0;
    address private immutable _s1;
    address private immutable _s2;
    address private immutable _s3;
    address private immutable _s4;
    uint8 public immutable signerCount;
    uint8 public immutable threshold;
    uint32 public immutable strictSec;
    uint32 public immutable admissionSec;

    error BadSignerSet();
    error BadConfig();
    error FeeNotTaken();
    error FeedIdMismatch(bytes32 feedId);
    error TimestampMismatch(uint256 expectedMs);
    error NotYet(uint40 printAt);
    error TooFewSigners(uint256 present, uint256 required);
    error UnknownSigner();
    error DuplicateSigner();
    error InvalidValue();

    /// @param signers_ 1–5 distinct non-zero addresses (`redstone-primary-prod`'s five).
    /// @param threshold_ `1 ≤ threshold ≤ signers` (3).
    constructor(address[] memory signers_, uint8 threshold_, uint32 strictSec_, uint32 admissionSec_) {
        uint256 n = signers_.length;
        if (n == 0 || n > MAX_SIGNERS || threshold_ == 0 || threshold_ > n) revert BadSignerSet();
        for (uint256 i; i < n; ++i) {
            if (signers_[i] == address(0)) revert BadSignerSet();
            for (uint256 j; j < i; ++j) {
                if (signers_[j] == signers_[i]) revert BadSignerSet();
            }
        }
        if (admissionSec_ <= GRID_SEC || strictSec_ > admissionSec_) revert BadConfig();
        address[MAX_SIGNERS] memory s;
        for (uint256 i; i < n; ++i) {
            s[i] = signers_[i];
        }
        (_s0, _s1, _s2, _s3, _s4) = (s[0], s[1], s[SLOT_2], s[SLOT_3], s[SLOT_4]);
        // forge-lint: disable-next-line(unsafe-typecast)
        signerCount = uint8(n);
        threshold = threshold_;
        strictSec = strictSec_;
        admissionSec = admissionSec_;
    }

    /// @inheritdoc IPrintVerifier
    function fee(bytes calldata) external pure returns (uint256) {
        return 0;
    }

    /// @notice The grid point a print of `t` is taken at.
    function printTimeOf(uint40 t) public pure returns (uint40) {
        return ((t + GRID_SEC - 1) / GRID_SEC) * GRID_SEC;
    }

    /// @inheritdoc IPrintVerifier
    /// @dev `proof` is RedStone's wire payload for the market's feed at `printTimeOf(t)`.
    function verifyPrint(bytes calldata proof, bytes32 feedId, uint40 t)
        external
        payable
        returns (int64 priceE8, uint64 confE8, uint40 publishTime)
    {
        if (msg.value != 0) revert FeeNotTaken();
        publishTime = printTimeOf(t);
        // Block time only refuses a print from the future; it never selects one.
        // forge-lint: disable-next-line(block-timestamp)
        if (publishTime > block.timestamp) revert NotYet(publishTime);
        uint256 n = P.preparse(proof, signerCount);
        uint256 atMs = uint256(publishTime) * MS_PER_SEC;
        for (uint256 i; i < n; ++i) {
            if (P.feedId(proof, i) != feedId) revert FeedIdMismatch(feedId);
            if (P.timestampMs(proof, i) != atMs) revert TimestampMismatch(atMs);
        }
        // forge-lint: disable-next-line(block-timestamp)
        uint256 required = block.timestamp < uint256(publishTime) + strictSec ? signerCount : threshold;
        if (n < required) revert TooFewSigners(n, required);
        (uint256 median, uint256 low, uint256 high) = _signedValues(proof, n);
        // Values are bounded to int64 in `_signedValues`.
        // forge-lint: disable-next-line(unsafe-typecast)
        priceE8 = int64(uint64(median));
        // forge-lint: disable-next-line(unsafe-typecast)
        confE8 = uint64((high - low) / HALF);
    }

    function signers() external view returns (address[] memory out) {
        out = new address[](signerCount);
        for (uint256 i; i < out.length; ++i) {
            out[i] = _signer(i);
        }
    }

    /// @dev Each package's signer (OZ `tryRecover`: low-s only) must be configured and unseen; each value in
    ///      `1..int64.max`. Returns the median and the lowest and highest value.
    function _signedValues(bytes calldata proof, uint256 n)
        private
        view
        returns (uint256 median, uint256 low, uint256 high)
    {
        uint256[] memory values = new uint256[](n);
        uint256 seen;
        low = type(uint256).max;
        for (uint256 i; i < n; ++i) {
            (bytes32 digest, uint8 v, bytes32 r, bytes32 s) = P.signature(proof, i);
            (address who, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, v, r, s);
            uint256 idx = err == ECDSA.RecoverError.NoError ? _indexOf(who) : MAX_SIGNERS;
            if (idx == MAX_SIGNERS) revert UnknownSigner();
            if (seen & (1 << idx) != 0) revert DuplicateSigner();
            seen |= 1 << idx;
            uint256 value = P.value(proof, i);
            if (value == 0 || value > uint256(uint64(type(int64).max))) revert InvalidValue();
            values[i] = value;
            if (value < low) low = value;
            if (value > high) high = value;
        }
        median = Median.median(values);
    }

    function _indexOf(address who) private view returns (uint256) {
        for (uint256 i; i < signerCount; ++i) {
            if (_signer(i) == who) return i;
        }
        return MAX_SIGNERS;
    }

    function _signer(uint256 i) private view returns (address) {
        address[MAX_SIGNERS] memory s = [_s0, _s1, _s2, _s3, _s4];
        return s[i];
    }
}
