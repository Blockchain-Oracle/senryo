// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

/// @title Errors — shared custom errors. The market errors arrive with `src/markets/` in S2 (D-256).
library Errors {
    error LengthMismatch();
    error UnknownCalendar(uint8 calendarId);
    error TooManyHolidays();
    error InvalidWindow();
}
