// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

/// @dev File-level so it can size fixed arrays (672 calendar slots / 256 bits per word).
uint256 constant CALENDAR_WORD_COUNT = 3;

/// @title Constants — every protocol-wide number lives here (invariant `sol-no-magic-numbers`).
/// @notice The prediction-market constants (windows, pricing, reserve caps) arrive with `src/markets/` in S2 (D-256).
library Constants {
    uint256 internal constant SECONDS_PER_WEEK = 604_800;

    // ---------------------------------------------------------------- calendar (MarketCalendar)
    /// @dev Monday 1970-01-05 00:00 UTC; slot 0 of every week.
    uint256 internal constant WEEK_ANCHOR = 345_600;
    /// @dev 15-minute slots: the NYSE open (09:30 ET) and early close (13:00 ET) fall on slot boundaries.
    uint256 internal constant SLOT_SECONDS = 900;
    uint256 internal constant SLOTS_PER_WEEK = 672;
    uint256 internal constant SLOTS_PER_WORD = 256;
    uint256 internal constant CALENDAR_WORDS = CALENDAR_WORD_COUNT;
    uint256 internal constant MAX_HOLIDAYS = 32;
}
