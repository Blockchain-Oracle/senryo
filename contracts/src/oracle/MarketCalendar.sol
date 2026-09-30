// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {CALENDAR_WORD_COUNT, Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {IMarketCalendar} from "./interfaces/IMarketCalendar.sol";

/// @title MarketCalendar — weekly 15-minute session bitmap plus holiday windows.
/// @notice 672 slots in 3 × uint256 (bit = 1 means open); slot 0 = Monday 00:00 UTC (`WEEK_ANCHOR`).
/// DST is handled by a conservative union: a slot is closed if it is closed under either EST or EDT.
/// Roles: `setWeek` / `removeHoliday` PARAM_ADMIN (timelocked), `addHoliday` GUARDIAN (instant, risk-reducing).
contract MarketCalendar is AccessManaged, IMarketCalendar {
    struct Window {
        uint64 start;
        uint64 end;
    }

    mapping(uint8 calendarId => uint256[CALENDAR_WORD_COUNT]) private _week;
    mapping(uint8 calendarId => bool) public configured;
    mapping(uint8 calendarId => Window[]) private _holidays;

    constructor(address authority, uint8[] memory ids, uint256[CALENDAR_WORD_COUNT][] memory weekBits)
        AccessManaged(authority)
    {
        if (ids.length != weekBits.length) revert Errors.LengthMismatch();
        for (uint256 i; i < ids.length; ++i) {
            _setWeek(ids[i], weekBits[i]);
        }
    }

    // ---------------------------------------------------------------- admin

    /// @notice Replace a calendar's weekly bitmap (PARAM_ADMIN, timelocked).
    function setWeek(uint8 calendarId, uint256[CALENDAR_WORD_COUNT] calldata bits) external restricted {
        _setWeek(calendarId, bits);
    }

    /// @notice Close a window instantly (GUARDIAN). Expired windows are pruned first.
    function addHoliday(uint8 calendarId, uint64 start, uint64 end) external restricted {
        if (!configured[calendarId]) revert Errors.UnknownCalendar(calendarId);
        if (end <= start) revert Errors.InvalidWindow();
        _prune(calendarId);
        Window[] storage list = _holidays[calendarId];
        if (list.length >= C.MAX_HOLIDAYS) revert Errors.TooManyHolidays();
        list.push(Window(start, end));
        emit Events.HolidayAdded(calendarId, start, end);
    }

    /// @notice Reopen a window early (PARAM_ADMIN, timelocked: removing a closure increases risk).
    function removeHoliday(uint8 calendarId, uint256 index) external restricted {
        Window[] storage list = _holidays[calendarId];
        if (index >= list.length) revert Errors.InvalidWindow();
        Window memory removed = list[index];
        list[index] = list[list.length - 1];
        list.pop();
        emit Events.HolidayRemoved(calendarId, removed.start, removed.end);
    }

    // ---------------------------------------------------------------- views

    /// @inheritdoc IMarketCalendar
    function isOpen(uint8 calendarId, uint256 timestamp) external view returns (bool) {
        if (!configured[calendarId]) revert Errors.UnknownCalendar(calendarId);
        if (timestamp < C.WEEK_ANCHOR) return false;
        uint256 slot = slotOf(timestamp);
        uint256 word = _week[calendarId][slot / C.SLOTS_PER_WORD];
        if ((word >> (slot % C.SLOTS_PER_WORD)) & 1 == 0) return false;
        Window[] storage list = _holidays[calendarId];
        for (uint256 i; i < list.length; ++i) {
            if (list[i].start <= timestamp && timestamp < list[i].end) return false;
        }
        return true;
    }

    /// @notice Slot index within the week (0 = Monday 00:00–00:15 UTC).
    function slotOf(uint256 timestamp) public pure returns (uint256) {
        return ((timestamp - C.WEEK_ANCHOR) % C.SECONDS_PER_WEEK) / C.SLOT_SECONDS;
    }

    function week(uint8 calendarId) external view returns (uint256[CALENDAR_WORD_COUNT] memory) {
        return _week[calendarId];
    }

    function holidays(uint8 calendarId) external view returns (Window[] memory) {
        return _holidays[calendarId];
    }

    // ---------------------------------------------------------------- internal

    function _setWeek(uint8 calendarId, uint256[CALENDAR_WORD_COUNT] memory bits) private {
        _week[calendarId] = bits;
        configured[calendarId] = true;
        emit Events.CalendarSet(calendarId);
    }

    function _prune(uint8 calendarId) private {
        Window[] storage list = _holidays[calendarId];
        uint256 i;
        while (i < list.length) {
            if (list[i].end <= block.timestamp) {
                list[i] = list[list.length - 1];
                list.pop();
            } else {
                ++i;
            }
        }
    }
}
