// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Ported from CWF d7b576b:contracts/src/engine/libs/{AdminLib,ResolveLib}.sol (Agari window/print rules), without the
// order book. Senryo changes: windows are keyed by `(series, start)` and anyone may open the current or a coming one
// (no roller role); prints are stored once per `(verifier, feed, instant)` so back-to-back windows share the boundary
// print with no copy step and fills read the same store (D-261); a void or tie is decided by the reserve, which
// refunds (CWF paid half face); the verifier's own immutables bound quality and admission (D-259).

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IMarketCalendar} from "../oracle/interfaces/IMarketCalendar.sol";
import {IPrintVerifier} from "./interfaces/IPrintVerifier.sol";
import {IWindows} from "./interfaces/IWindows.sol";
import "./MarketTypes.sol";

/// @title Windows — clock-aligned price windows on proven boundary prints.
/// @notice A window `[start, expiry)` of a series opens on the unique print at `start` and closes on the unique print
///         at `expiry`. Prints are permissionless and the first valid one wins (Pyth makes it unique anyway). A window
///         resolves once both primary prints exist (and the cross-check, when the policy has one, agrees or timed
///         out); it voids once a primary print's admission has passed without one. There is no admin void.
contract Windows is AccessManaged, ReentrancyGuardTransient, IWindows {
    IMarketCalendar public immutable calendar;

    mapping(bytes32 seriesId => Series) private _series;
    mapping(bytes32 seriesId => mapping(uint8 index => PolicyVersion)) private _versions;
    mapping(bytes32 windowId => Window) private _windows;
    mapping(bytes32 printKey => Print) private _prints;
    /// @dev Only verifiers some policy names may record prints (no foreign code runs in `recordPrint`).
    mapping(address verifier => bool) public knownVerifier;

    constructor(address authority, IMarketCalendar calendar_) AccessManaged(authority) {
        calendar = calendar_;
    }

    // ------------------------------------------------------------------------------------------------ series

    /// @notice CWF E-23: a market symbol at one cadence, on a calendar (0 = always open), with its first policy.
    function registerSeries(bytes32 market, uint32 cadenceSec, uint8 calendarId, PolicyVersion calldata v0)
        external
        restricted
        returns (bytes32 seriesId)
    {
        if (cadenceSec < MIN_CADENCE_SEC || cadenceSec % MIN_CADENCE_SEC != 0 || CADENCE_DIVIDES_SEC % cadenceSec != 0)
        {
            revert BadCadence(cadenceSec);
        }
        if (market == bytes32(0)) revert BadPolicy();
        seriesId = seriesIdOf(market, cadenceSec);
        if (_series[seriesId].cadenceSec != 0) revert SeriesExists(seriesId);
        _series[seriesId] = Series(market, cadenceSec, calendarId, 0);
        emit SeriesRegistered(seriesId, market, cadenceSec, calendarId);
        _addVersion(seriesId, v0);
    }

    /// @notice CWF E-25: append-only (`index == versionCount`, ≤ 8); a written version never changes.
    function addPolicyVersion(bytes32 seriesId, uint8 index, PolicyVersion calldata v) external restricted {
        uint8 count = _requireSeries(seriesId).versionCount;
        if (index < count) revert PolicyVersionImmutable(index);
        if (index != count) revert UnknownPolicyVersion(index);
        _addVersion(seriesId, v);
    }

    function _addVersion(bytes32 seriesId, PolicyVersion calldata v) private {
        Series storage s = _series[seriesId];
        if (s.versionCount >= MAX_POLICY_VERSIONS) revert UnknownPolicyVersion(s.versionCount);
        _validate(v);
        uint8 index = s.versionCount;
        _versions[seriesId][index] = v;
        s.versionCount = index + 1;
        knownVerifier[v.primary.verifier] = true;
        if (v.check.verifier != address(0)) knownVerifier[v.check.verifier] = true;
        emit PolicyVersionAdded(
            seriesId,
            index,
            v.validFrom,
            v.validUntil,
            v.primary.verifier,
            v.primary.feedId,
            v.check.verifier,
            v.check.feedId,
            v.maxDivergenceBps
        );
    }

    /// CWF `_validate`: a range, a real primary, and either no check at all or a different verifier with a bound.
    function _validate(PolicyVersion calldata v) private view {
        if (v.validFrom >= v.validUntil) revert BadPolicy();
        _requireSource(v.primary);
        if (v.check.verifier == address(0)) {
            if (v.check.feedId != bytes32(0) || v.maxDivergenceBps != 0) revert BadPolicy();
            return;
        }
        _requireSource(v.check);
        if (v.check.verifier == v.primary.verifier || v.maxDivergenceBps == 0 || v.maxDivergenceBps > BPS) {
            revert BadPolicy();
        }
    }

    function _requireSource(PrintSource calldata p) private view {
        if (p.feedId == bytes32(0) || p.verifier.code.length == 0) revert BadPolicy();
        if (IPrintVerifier(p.verifier).admissionSec() == 0) revert BadPolicy();
    }

    // ------------------------------------------------------------------------------------------------ windows

    /// @notice Opens the window of `seriesId` starting at `start`. Anyone may call: the window is fully determined by
    ///         the series and the clock. It must be aligned, not over (its open print still admissible and calls still
    ///         possible), at most a day ahead, open on the calendar in every slot it spans (D-265), and covered by a
    ///         policy version (the highest one covering both boundaries, CWF F-S2-07).
    function openWindow(bytes32 seriesId, uint40 start) external returns (bytes32 windowId) {
        Series storage s = _requireSeries(seriesId);
        if (start % s.cadenceSec != 0) revert BadAlignment(start);
        uint40 expiry = start + s.cadenceSec;
        if (uint256(start) > block.timestamp + MAX_LEAD_SEC || block.timestamp + LOCKOUT_SEC >= expiry) {
            revert BadHorizon(start);
        }
        windowId = windowIdOf(seriesId, start);
        if (_windows[windowId].expiry != 0) revert WindowExists(windowId);
        if (s.calendarId != 0) _requireSession(s.calendarId, start, expiry);
        uint8 version = _versionFor(seriesId, s.versionCount, start, expiry);
        PrintSource storage primary = _versions[seriesId][version].primary;
        uint32 admission = IPrintVerifier(primary.verifier).admissionSec();
        if (block.timestamp > uint256(start) + admission) revert BadHorizon(start);

        Window storage w = _windows[windowId];
        w.seriesId = seriesId;
        w.start = start;
        w.expiry = expiry;
        w.policyVersion = version;
        emit WindowOpened(windowId, seriesId, start, expiry, version, msg.sender);
    }

    /// Every calendar slot the window touches must be a trading slot (no window crosses the close or a holiday).
    function _requireSession(uint8 calendarId, uint40 start, uint40 expiry) private view {
        for (uint40 t = start; t < expiry; t += CALENDAR_SLOT_SEC) {
            if (!calendar.isOpen(calendarId, t)) revert MarketClosed(calendarId, t);
        }
        if (!calendar.isOpen(calendarId, expiry - 1)) revert MarketClosed(calendarId, expiry - 1);
    }

    function _versionFor(bytes32 seriesId, uint8 count, uint40 start, uint40 expiry) private view returns (uint8) {
        for (uint256 i = count; i > 0; --i) {
            PolicyVersion storage v = _versions[seriesId][uint8(i - 1)];
            if (v.validFrom <= start && expiry <= v.validUntil) return uint8(i - 1);
        }
        revert SourceNotCovered(seriesId, start);
    }

    // ------------------------------------------------------------------------------------------------ prints

    /// @notice Records the unique print for `(verifier, feedId, t)`: admissible until `t + admissionSec`, verified by
    ///         the verifier (fee forwarded), first valid print wins.
    function recordPrint(address verifier, bytes32 feedId, uint40 t, bytes calldata proof)
        external
        payable
        nonReentrant
        returns (Print memory)
    {
        return _record(verifier, feedId, t, proof);
    }

    /// @inheritdoc IWindows
    function ensurePrint(address verifier, bytes32 feedId, uint40 t, bytes calldata proof)
        external
        payable
        nonReentrant
        returns (Print memory p)
    {
        p = _prints[printKeyOf(verifier, feedId, t)];
        if (p.publishTime != 0) {
            if (msg.value != 0) revert PrintAlreadyRecorded(printKeyOf(verifier, feedId, t));
            return p;
        }
        return _record(verifier, feedId, t, proof);
    }

    function _record(address verifier, bytes32 feedId, uint40 t, bytes calldata proof)
        private
        returns (Print memory p)
    {
        if (!knownVerifier[verifier]) revert UnknownVerifier(verifier);
        bytes32 key = printKeyOf(verifier, feedId, t);
        if (_prints[key].publishTime != 0) revert PrintAlreadyRecorded(key);
        uint256 deadline = uint256(t) + IPrintVerifier(verifier).admissionSec();
        if (block.timestamp > deadline) revert PrintTooLate(t, deadline);
        (p.priceE8, p.confE8, p.publishTime) = IPrintVerifier(verifier).verifyPrint{value: msg.value}(proof, feedId, t);
        _prints[key] = p;
        emit PrintRecorded(key, verifier, feedId, t, p.priceE8, p.confE8, p.publishTime, msg.sender);
    }

    // ------------------------------------------------------------------------------------------------ verdicts

    /// @notice CWF E-50: both primary prints present; with a check source, both checks or the check window over (an
    ///         early resolver can't skip a check that may still land); any present pair diverging beyond the bound
    ///         voids. Otherwise the window resolves with its open and close prints; the reserve applies the bands.
    function resolve(bytes32 windowId) external {
        Window storage w = _requireOpenWindow(windowId);
        PolicyVersion storage v = _versions[w.seriesId][w.policyVersion];
        Print memory open = _printAt(v.primary, w.start);
        Print memory close = _printAt(v.primary, w.expiry);
        if (open.publishTime == 0 || close.publishTime == 0) revert PrintsMissing(windowId);
        if (v.check.verifier != address(0)) {
            Print memory checkOpen = _printAt(v.check, w.start);
            Print memory checkClose = _printAt(v.check, w.expiry);
            bool hasOpen = checkOpen.publishTime != 0;
            bool hasClose = checkClose.publishTime != 0;
            uint256 checkDeadline = uint256(w.expiry) + IPrintVerifier(v.check.verifier).admissionSec();
            if (!(hasOpen && hasClose) && block.timestamp <= checkDeadline) revert CrossCheckPending(windowId);
            if (
                (hasOpen && diverges(open.priceE8, checkOpen.priceE8, v.maxDivergenceBps))
                    || (hasClose && diverges(close.priceE8, checkClose.priceE8, v.maxDivergenceBps))
            ) {
                _finish(w, windowId, STATE_VOIDED, VOID_CROSS_CHECK_DIVERGENCE, open.priceE8, close.priceE8);
                return;
            }
        }
        _finish(w, windowId, STATE_RESOLVED, VOID_NONE, open.priceE8, close.priceE8);
    }

    /// @notice CWF E-51: a primary print is missing and its admission has passed (at the deadline the print is still
    ///         admissible — the clock makes print and void mutually exclusive).
    function voidExpired(bytes32 windowId) external {
        Window storage w = _requireOpenWindow(windowId);
        PrintSource storage primary = _versions[w.seriesId][w.policyVersion].primary;
        uint256 admission = IPrintVerifier(primary.verifier).admissionSec();
        bool openMissed = _printAt(primary, w.start).publishTime == 0 && block.timestamp > w.start + admission;
        bool closeMissed = _printAt(primary, w.expiry).publishTime == 0 && block.timestamp > w.expiry + admission;
        if (!openMissed && !closeMissed) revert SettlementWindowOpen(windowId);
        _finish(w, windowId, STATE_VOIDED, VOID_MISSING_PRINT, 0, 0);
    }

    /// @notice `|p − c| × 10,000 > bps × p`.
    function diverges(int64 primary, int64 check, uint16 bps) public pure returns (bool) {
        int256 gap = int256(primary) - int256(check);
        if (gap < 0) gap = -gap;
        return gap * int256(BPS) > int256(uint256(bps)) * int256(primary);
    }

    function _finish(Window storage w, bytes32 windowId, uint8 state, uint8 reason, int64 openE8, int64 closeE8)
        private
    {
        w.state = state;
        w.voidReason = reason;
        w.openE8 = openE8;
        w.closeE8 = closeE8;
        w.resolvedAt = uint40(block.timestamp);
        emit WindowResolved(windowId, state, reason, openE8, closeE8, msg.sender);
    }

    // ------------------------------------------------------------------------------------------------ views

    function seriesIdOf(bytes32 market, uint32 cadenceSec) public pure returns (bytes32) {
        return keccak256(abi.encode(market, cadenceSec));
    }

    function windowIdOf(bytes32 seriesId, uint40 start) public pure returns (bytes32) {
        return keccak256(abi.encode(seriesId, start));
    }

    function printKeyOf(address verifier, bytes32 feedId, uint40 t) public pure returns (bytes32) {
        return keccak256(abi.encode(verifier, feedId, t));
    }

    function seriesOf(bytes32 seriesId) external view returns (Series memory) {
        return _series[seriesId];
    }

    function policyOf(bytes32 seriesId, uint8 index) external view returns (PolicyVersion memory) {
        return _versions[seriesId][index];
    }

    function windowOf(bytes32 windowId) external view returns (Window memory) {
        return _windows[windowId];
    }

    function printOf(address verifier, bytes32 feedId, uint40 t) external view returns (Print memory) {
        return _prints[printKeyOf(verifier, feedId, t)];
    }

    function primarySourceOf(bytes32 windowId) external view returns (PrintSource memory) {
        Window storage w = _requireWindow(windowId);
        return _versions[w.seriesId][w.policyVersion].primary;
    }

    function openPrintOf(bytes32 windowId) external view returns (Print memory) {
        Window storage w = _requireWindow(windowId);
        return _printAt(_versions[w.seriesId][w.policyVersion].primary, w.start);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    function _printAt(PrintSource storage src, uint40 t) private view returns (Print memory) {
        return _prints[printKeyOf(src.verifier, src.feedId, t)];
    }

    function _requireSeries(bytes32 seriesId) private view returns (Series storage s) {
        s = _series[seriesId];
        if (s.cadenceSec == 0) revert UnknownSeries(seriesId);
    }

    function _requireWindow(bytes32 windowId) private view returns (Window storage w) {
        w = _windows[windowId];
        if (w.expiry == 0) revert UnknownWindow(windowId);
    }

    function _requireOpenWindow(bytes32 windowId) private view returns (Window storage w) {
        w = _requireWindow(windowId);
        if (w.state != STATE_OPEN) revert WindowTerminal(windowId);
    }
}
