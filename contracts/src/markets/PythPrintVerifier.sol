// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Generalised from Senryo's `predictions/PythBoundaryOracle.sol` (testnet-only, fixed 5 s / 25 bps) into CWF's
// verifier shape (d7b576b:contracts/src/engine/interfaces/IPrintVerifier.sol); normalisation from CWF
// d7b576b:contracts/src/engine/libs/ResolveLib.sol `normalize` (E-49).

import {IPrintVerifier} from "./interfaces/IPrintVerifier.sol";
import {IPyth} from "./interfaces/IPyth.sol";
import {BPS, DECIMAL_BASE, MIN_SOURCE_EXPO, PRINT_EXPO} from "./MarketTypes.sol";

/// @title PythPrintVerifier — the unique Pyth print at an instant, as one window boundary or one fill (D-259, D-261).
/// @notice `parsePriceFeedUpdatesUnique` over `[t, t + graceSec]` returns only the first update at or after `t` (its
///         previous publish time is before `t`), so the print is fixed by the instant, never chosen by the caller. A
///         print wider than `maxConfBps` of its price is refused; no print ever resolving the slot voids it later.
/// @dev Immutable: one deployment per quality class (crypto 25 bps, equities 50 bps), so every series sharing a
///      verifier shares the same meaning of "the print at t".
contract PythPrintVerifier is IPrintVerifier {
    uint16 public constant MAX_GRACE_SEC = 60;
    uint32 public constant MAX_ADMISSION_SEC = 86_400;

    IPyth public immutable pyth;
    uint16 public immutable graceSec;
    uint16 public immutable maxConfBps;
    uint32 public immutable admissionSec;

    error BadConfig();
    error WrongFee(uint256 sent, uint256 fee);
    error NotUnique(bytes32 feedId, uint40 t);
    error OutOfWindow(uint256 publishTime, uint40 t);
    error LowQuality(int64 price, uint64 conf);
    error BadPrice(int256 price, int32 expo);

    constructor(IPyth pyth_, uint16 graceSec_, uint16 maxConfBps_, uint32 admissionSec_) {
        if (address(pyth_).code.length == 0) revert BadConfig();
        if (graceSec_ == 0 || graceSec_ > MAX_GRACE_SEC || maxConfBps_ == 0 || maxConfBps_ > BPS) revert BadConfig();
        if (admissionSec_ < graceSec_ || admissionSec_ > MAX_ADMISSION_SEC) revert BadConfig();
        pyth = pyth_;
        graceSec = graceSec_;
        maxConfBps = maxConfBps_;
        admissionSec = admissionSec_;
    }

    /// @inheritdoc IPrintVerifier
    function fee(bytes calldata proof) external view virtual returns (uint256) {
        return pyth.getUpdateFee(abi.decode(proof, (bytes[])));
    }

    /// @inheritdoc IPrintVerifier
    /// @dev `proof` is `abi.encode(bytes[] updateData)` as Hermes serves it for the instant.
    function verifyPrint(bytes calldata proof, bytes32 feedId, uint40 t)
        external
        payable
        virtual
        returns (int64 priceE8, uint64 confE8, uint40 publishTime)
    {
        bytes[] memory updates = abi.decode(proof, (bytes[]));
        uint256 required = pyth.getUpdateFee(updates);
        if (msg.value != required) revert WrongFee(msg.value, required);
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = feedId;
        IPyth.PriceFeed[] memory feeds =
            pyth.parsePriceFeedUpdatesUnique{value: msg.value}(updates, ids, uint64(t), uint64(t) + graceSec);
        if (feeds.length != 1 || feeds[0].id != feedId) revert NotUnique(feedId, t);
        return _checked(feeds[0].price, t);
    }

    /// @dev One print's quality and time, normalised: inside `[t, t + grace]` and not in the future, positive, its
    ///      confidence within `maxConfBps` of the price.
    function _checked(IPyth.Price memory p, uint40 t)
        internal
        view
        returns (int64 priceE8, uint64 confE8, uint40 publishTime)
    {
        // Block time only refuses a future print; it never selects one.
        // forge-lint: disable-next-line(block-timestamp)
        if (p.publishTime < t || p.publishTime > uint256(t) + graceSec || p.publishTime > block.timestamp) {
            revert OutOfWindow(p.publishTime, t);
        }
        if (p.price <= 0) revert BadPrice(p.price, p.expo);
        // forge-lint: disable-next-line(unsafe-typecast)
        if (uint256(p.conf) * BPS > uint256(uint64(p.price)) * maxConfBps) revert LowQuality(p.price, p.conf);
        priceE8 = normalize(p.price, p.expo);
        // conf ≤ price × maxConfBps / BPS (checked above), so the normalised confidence fits like the price.
        // forge-lint: disable-next-line(unsafe-typecast)
        confE8 = uint64(uint256(normalizeUnsigned(p.conf, p.expo)));
        // forge-lint: disable-next-line(unsafe-typecast)
        publishTime = uint40(p.publishTime);
    }

    /// @notice CWF E-49: to expo −8, exact at or coarser than 1e-8, floored when finer; `0 < q ≤ int64`.
    function normalize(int256 price, int32 expo) public pure returns (int64) {
        if (price <= 0 || expo > 0 || expo < MIN_SOURCE_EXPO) revert BadPrice(price, expo);
        int256 q = _scale(price, expo);
        if (q <= 0 || q > type(int64).max) revert BadPrice(price, expo);
        // forge-lint: disable-next-line(unsafe-typecast)
        return int64(q);
    }

    /// @dev The confidence on the same scale (a zero confidence stays zero).
    function normalizeUnsigned(uint64 conf, int32 expo) public pure returns (int256) {
        if (expo > 0 || expo < MIN_SOURCE_EXPO) revert BadPrice(int256(uint256(conf)), expo);
        return _scale(int256(uint256(conf)), expo);
    }

    function _scale(int256 v, int32 expo) private pure returns (int256) {
        if (expo >= PRINT_EXPO) return v * int256(DECIMAL_BASE ** uint256(int256(expo - PRINT_EXPO)));
        return v / int256(DECIMAL_BASE ** uint256(int256(PRINT_EXPO - expo)));
    }
}
