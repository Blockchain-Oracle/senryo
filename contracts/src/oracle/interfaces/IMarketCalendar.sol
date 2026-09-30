// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

interface IMarketCalendar {
    function isOpen(uint8 calendarId, uint256 timestamp) external view returns (bool);
}
