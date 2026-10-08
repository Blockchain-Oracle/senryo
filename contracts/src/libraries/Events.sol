// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

/// @title Events — shared events. The market events arrive with `src/markets/` in S2 (D-256).
library Events {
    event CalendarSet(uint8 indexed calendarId);
    event HolidayAdded(uint8 indexed calendarId, uint64 start, uint64 end);
    event HolidayRemoved(uint8 indexed calendarId, uint64 start, uint64 end);
}
