// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Constants as C} from "../../src/libraries/Constants.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";
import {Fixture} from "../utils/Fixture.sol";

/// @notice CME-metals calendar: DST-union slot boundaries (UTC) and holiday windows.
/// Union rule: closed daily 21:00–23:00 UTC; closed Fri 21:00 → Sun 23:00 UTC.
contract MarketCalendarTest is Fixture {
    uint8 internal constant CAL = S.CME_METALS_CALENDAR;
    uint256 internal constant FRIDAY = MONDAY + 4 * DAY;
    uint256 internal constant SUNDAY = MONDAY + 6 * DAY;

    function setUp() public {
        _deploy(false, MONDAY + 12 * HOUR);
    }

    function _open(uint256 t) internal view returns (bool) {
        return calendar.isOpen(CAL, t);
    }

    function test_slotZeroIsMondayMidnight() public view {
        assertEq(calendar.slotOf(MONDAY), 0);
        assertEq(calendar.slotOf(MONDAY + C.SLOT_SECONDS - 1), 0);
        assertEq(calendar.slotOf(MONDAY + C.SLOT_SECONDS), 1);
        assertEq(calendar.slotOf(MONDAY + C.SECONDS_PER_WEEK - 1), C.SLOTS_PER_WEEK - 1);
        assertEq(calendar.slotOf(MONDAY + C.SECONDS_PER_WEEK), 0);
    }

    function test_dailyBreakUnionBoundaries() public view {
        for (uint256 d; d < 4; ++d) {
            uint256 day = MONDAY + d * DAY;
            assertTrue(_open(day + 21 * HOUR - 1), "20:59:59 open (EDT close is 21:00)");
            assertFalse(_open(day + 21 * HOUR), "21:00 closed");
            assertFalse(_open(day + 22 * HOUR), "22:00 closed (EST close)");
            assertFalse(_open(day + 23 * HOUR - 1), "22:59:59 closed (EST reopen is 23:00)");
            assertTrue(_open(day + 23 * HOUR), "23:00 open");
        }
    }

    function test_weekendUnionBoundaries() public view {
        assertTrue(_open(FRIDAY + 21 * HOUR - 1), "Fri 20:59:59 open");
        assertFalse(_open(FRIDAY + 21 * HOUR), "Fri 21:00 closed");
        assertFalse(_open(FRIDAY + DAY + 12 * HOUR), "Sat closed");
        assertFalse(_open(SUNDAY + 22 * HOUR), "Sun 22:00 closed (EDT reopen 22:00 excluded by union)");
        assertFalse(_open(SUNDAY + 23 * HOUR - 1), "Sun 22:59:59 closed");
        assertTrue(_open(SUNDAY + 23 * HOUR), "Sun 23:00 open");
        assertTrue(_open(SUNDAY + DAY), "Mon 00:00 open");
    }

    function test_nextWeekSameBoundaries() public view {
        uint256 w = C.SECONDS_PER_WEEK;
        assertFalse(_open(FRIDAY + w + 21 * HOUR));
        assertTrue(_open(SUNDAY + w + 23 * HOUR));
    }

    function test_holidayClosesAndExpires() public {
        uint64 start = uint64(MONDAY + DAY + 14 * HOUR);
        uint64 end = uint64(MONDAY + DAY + 18 * HOUR);
        vm.prank(guardian);
        calendar.addHoliday(CAL, start, end);
        assertTrue(_open(start - 1));
        assertFalse(_open(start));
        assertFalse(_open(end - 1));
        assertTrue(_open(end));
    }

    function test_holidayAddIsGuardianOnlyAndRemovalTimelocked() public {
        vm.expectRevert();
        calendar.addHoliday(CAL, uint64(vm.getBlockTimestamp()), uint64(vm.getBlockTimestamp() + HOUR));
        vm.prank(guardian);
        calendar.addHoliday(CAL, uint64(vm.getBlockTimestamp()), uint64(vm.getBlockTimestamp() + HOUR));
        vm.prank(guardian);
        vm.expectRevert();
        calendar.removeHoliday(CAL, 0);
        assertFalse(_open(vm.getBlockTimestamp()));
    }

    function test_expiredHolidaysArePruned() public {
        for (uint256 i; i < C.MAX_HOLIDAYS; ++i) {
            vm.prank(guardian);
            calendar.addHoliday(
                CAL, uint64(vm.getBlockTimestamp() + i * HOUR), uint64(vm.getBlockTimestamp() + i * HOUR + 60)
            );
        }
        vm.warp(vm.getBlockTimestamp() + C.MAX_HOLIDAYS * HOUR);
        vm.prank(guardian);
        calendar.addHoliday(CAL, uint64(vm.getBlockTimestamp()), uint64(vm.getBlockTimestamp() + HOUR));
        assertEq(calendar.holidays(CAL).length, 1);
    }
}
