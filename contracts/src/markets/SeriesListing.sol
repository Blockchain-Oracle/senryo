// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// v3 (D-300, D-306, D-309): a series is listed once, in one call — the bounds its σ marks are held to, its spread at
// p = ½ and its band menu — laid out so a listing writes two slots of one MIP-8 page (R3.1: 162,881 gas on 10143).

import {BandMath} from "./BandMath.sol";
import {BandPool} from "./BandPool.sol";
import {SigmaMarks} from "./SigmaMarks.sol";
import {IWindows} from "./interfaces/IWindows.sol";
import "./MarketTypes.sol";

/// @title SeriesListing — which series the reserve prices, on what terms, with which bands.
abstract contract SeriesListing is BandPool, SigmaMarks {
    IWindows public immutable windows;
    /// @notice The data contract holding the calibrated shape table and the σ model's weight and fade (D-300).
    address public tailTable;

    mapping(bytes32 seriesId => SeriesBook) internal _books;

    event SigmaBoundsSet(bytes32 indexed seriesId, uint64 sigmaFloorE8, uint64 sigmaCapE8);
    event TailTableSet(address indexed table, uint32 configVersion);

    constructor(IWindows windows_, address tailTable_) {
        if (address(windows_) == address(0)) revert ZeroAddress();
        windows = windows_;
        _setTailTable(tailTable_);
    }

    // ------------------------------------------------------------------------------------------------ PARAMS

    /// @notice Lists a registered series in one call: its terms and its band menu, in order. Once.
    function listSeries(bytes32 seriesId, SeriesTerms calldata terms, BandDef[] calldata menu) external restricted {
        _requireSeries(seriesId);
        if (_books[seriesId].bandCount != 0) revert SeriesAlreadyListed(seriesId);
        if (menu.length == 0 || menu.length > MAX_BANDS || !_validTerms(terms)) revert BadParams();
        uint40[MAX_BANDS] memory packed;
        for (uint256 i; i < menu.length; ++i) {
            BandDef calldata d = menu[i];
            if (!BandMath.isValid(d)) revert BadParams();
            packed[i] = BandMath.pack(d);
            // forge-lint: disable-next-line(unsafe-typecast)
            emit BandAdded(seriesId, uint8(i), d.kind, d.lowBps, d.highBps);
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        uint8 count = uint8(menu.length);
        _books[seriesId] = SeriesBook(terms.sigmaFloorE8, terms.sigmaCapE8, terms.h50E6, count, packed);
        emit SeriesListed(seriesId, terms.sigmaFloorE8, terms.sigmaCapE8, terms.h50E6, count);
    }

    /// @notice Appends a band to a listed series' menu (D-306: mainnet adds Range, Moonshot and Crash once they are
    ///         calibrated). Entries never change or leave: tickets name them by index.
    function addBand(bytes32 seriesId, BandDef calldata d) external restricted {
        SeriesBook storage book = _listed(seriesId);
        uint8 index = book.bandCount;
        if (index >= MAX_BANDS || !BandMath.isValid(d)) revert BadParams();
        book.bands[index] = BandMath.pack(d);
        book.bandCount = index + 1;
        emit BandAdded(seriesId, index, d.kind, d.lowBps, d.highBps);
    }

    /// @notice Moves the bounds a series' σ marks are held to. No version bump (D-300): an open in flight is still
    ///         guarded by its own payout limit.
    function setSigmaBounds(bytes32 seriesId, uint64 floorE8, uint64 capE8) external restricted {
        SeriesBook storage book = _listed(seriesId);
        if (floorE8 == 0 || capE8 < floorE8 || capE8 > MAX_SIGMA_E8) revert BadParams();
        (book.sigmaFloorE8, book.sigmaCapE8) = (floorE8, capE8);
        emit SigmaBoundsSet(seriesId, floorE8, capE8);
    }

    /// @notice Prices with a recalibrated table from now on (D-306: Range, Moonshot and Crash join mainnet once a
    ///         table passes the check on Pyth's own history). A pricing change, so opens in flight are refused.
    function setTailTable(address table) external restricted {
        _setTailTable(table);
    }

    function setSigmaSigner(address signer, bool allowed) external restricted {
        if (signer == address(0)) revert ZeroAddress();
        _setSigmaSigner(signer, allowed);
    }

    // ------------------------------------------------------------------------------------------------ views

    function menuOf(bytes32 seriesId) external view returns (BandDef[] memory menu) {
        SeriesBook storage book = _books[seriesId];
        menu = new BandDef[](book.bandCount);
        for (uint8 i; i < menu.length; ++i) {
            menu[i] = BandMath.unpack(book.bands[i]);
        }
    }

    /// @notice A series' terms (all zero until it is listed).
    function termsOf(bytes32 seriesId) external view returns (SeriesTerms memory) {
        SeriesBook storage book = _books[seriesId];
        return SeriesTerms(book.sigmaFloorE8, book.sigmaCapE8, book.h50E6);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    function _setTailTable(address table) private {
        BandMath.checkShape(table);
        tailTable = table;
        configVersion += 1;
        emit TailTableSet(table, configVersion);
    }

    /// @dev 0 < floor ≤ cap ≤ the chain's bound; a spread at p = ½ inside the chain's bound.
    function _validTerms(SeriesTerms calldata t) private pure returns (bool) {
        if (t.sigmaFloorE8 == 0 || t.sigmaCapE8 < t.sigmaFloorE8 || t.sigmaCapE8 > MAX_SIGMA_E8) return false;
        return t.h50E6 != 0 && t.h50E6 <= MAX_HALF_SPREAD_E6;
    }

    function _requireSeries(bytes32 seriesId) internal view {
        if (windows.seriesOf(seriesId).cadenceSec == 0) revert UnknownSeries(seriesId);
    }

    function _listed(bytes32 seriesId) internal view returns (SeriesBook storage book) {
        book = _books[seriesId];
        if (book.bandCount == 0) revert SeriesNotListed(seriesId);
    }

    /// @dev Band `index` of a series' menu (the caller has checked `index < bandCount`).
    function _bandOf(bytes32 seriesId, uint8 index) internal view returns (BandDef memory) {
        return BandMath.unpack(_books[seriesId].bands[index]);
    }

    /// @dev What `band` of `seriesId` is worth with the price at `spotE8`, `tauSec` from the close, on a checked mark
    ///      (each σ held inside the series' bounds).
    function _priceBand(bytes32 seriesId, uint8 band, int64 k, int64 spotE8, SigmaMark calldata m, uint256 tauSec)
        internal
        view
        returns (uint256)
    {
        SeriesBook storage book = _books[seriesId];
        (uint64 lo, uint64 hi) = (book.sigmaFloorE8, book.sigmaCapE8);
        return BandMath.probE6(
            BandMath.unpack(book.bands[band]),
            k,
            spotE8,
            _clamp(m.fastE8, lo, hi),
            _clamp(m.slowE8, lo, hi),
            tauSec,
            BandMath.shapeOf(tailTable)
        );
    }

    /// @dev The series' half-spread at probability `probE6` (D-300's curve, floored by `minHalfSpreadE6`).
    function _halfSpreadAt(bytes32 seriesId, uint256 probE6) internal view returns (uint256) {
        return BandMath.halfSpreadE6(probE6, _books[seriesId].h50E6, params.minHalfSpreadE6);
    }

    function _clamp(uint64 x, uint64 lo, uint64 hi) private pure returns (uint64) {
        return x < lo ? lo : x > hi ? hi : x;
    }
}
