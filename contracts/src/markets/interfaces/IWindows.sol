// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Print, PrintSource, PolicyVersion, Series, Window} from "../MarketTypes.sol";

/// @title Windows' vocabulary: series, policy versions, prints and window verdicts (CWF engine A.1–A.5, no book).
interface IWindows {
    event SeriesRegistered(bytes32 indexed seriesId, bytes32 indexed market, uint32 cadenceSec, uint8 calendarId);
    event PolicyVersionAdded(
        bytes32 indexed seriesId,
        uint8 index,
        uint40 validFrom,
        uint40 validUntil,
        address primaryVerifier,
        bytes32 primaryFeed,
        address checkVerifier,
        bytes32 checkFeed,
        uint16 maxDivergenceBps
    );
    event WindowOpened(
        bytes32 indexed windowId, bytes32 indexed seriesId, uint40 start, uint40 expiry, uint8 policyVersion, address by
    );
    event PrintRecorded(
        bytes32 indexed printKey,
        address indexed verifier,
        bytes32 indexed feedId,
        uint40 t,
        int64 priceE8,
        uint64 confE8,
        uint40 publishTime,
        address by
    );
    event WindowResolved(
        bytes32 indexed windowId, uint8 state, uint8 voidReason, int64 openE8, int64 closeE8, address by
    );

    error UnknownSeries(bytes32 seriesId);
    error SeriesExists(bytes32 seriesId);
    error BadCadence(uint32 cadenceSec);
    error BadPolicy();
    error PolicyVersionImmutable(uint8 index);
    error UnknownPolicyVersion(uint8 index);
    error UnknownVerifier(address verifier);
    error BadAlignment(uint40 start);
    error BadHorizon(uint40 start);
    error WindowExists(bytes32 windowId);
    error UnknownWindow(bytes32 windowId);
    error MarketClosed(uint8 calendarId, uint40 at);
    error SourceNotCovered(bytes32 seriesId, uint40 start);
    error PrintAlreadyRecorded(bytes32 printKey);
    error PrintTooLate(uint40 t, uint256 deadline);
    error WindowTerminal(bytes32 windowId);
    error PrintsMissing(bytes32 windowId);
    error CrossCheckPending(bytes32 windowId);
    error SettlementWindowOpen(bytes32 windowId);

    function seriesOf(bytes32 seriesId) external view returns (Series memory);
    function policyOf(bytes32 seriesId, uint8 index) external view returns (PolicyVersion memory);
    function windowOf(bytes32 windowId) external view returns (Window memory);
    function printOf(address verifier, bytes32 feedId, uint40 t) external view returns (Print memory);
    function primarySourceOf(bytes32 windowId) external view returns (PrintSource memory);
    function openPrintOf(bytes32 windowId) external view returns (Print memory);

    /// @notice Records the print for `(verifier, feedId, t)` unless it already exists; returns it either way. Sending
    ///         value when the print exists, or the wrong fee when it doesn't, reverts.
    function ensurePrint(address verifier, bytes32 feedId, uint40 t, bytes calldata proof)
        external
        payable
        returns (Print memory);
}
