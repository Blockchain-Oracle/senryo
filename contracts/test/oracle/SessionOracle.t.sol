// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Constants as C} from "../../src/libraries/Constants.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {PerpMath} from "../../src/libraries/PerpMath.sol";
import {MarketStatus, PriceView} from "../../src/libraries/Types.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";
import {Fixture} from "../utils/Fixture.sol";
import {SessionOracle} from "../../src/oracle/SessionOracle.sol";
import {RoleWiring} from "../../script/RoleWiring.sol";

/// @notice SessionOracle scenarios: future timestamp, stale, clamp → circuit → 3-round confirm, reopen window,
/// acceptFeedPrice, halts. Runs on the real CME-metals calendar (Monday 12:00 UTC start).
contract SessionOracleTest is Fixture {
    uint8 internal constant GOLD = S.GOLD_MARKET;
    int256 internal constant P0 = S.XAU_MIRROR_SEED_ANSWER;

    function setUp() public {
        _deploy(false, MONDAY + 12 * HOUR);
    }

    function _status() internal returns (MarketStatus) {
        return oracle.observe(GOLD).status;
    }

    function _bps(int256 p, int256 bps) internal pure returns (int256) {
        return p + (p * bps) / int256(C.BPS);
    }

    function test_openAndAccepted() public {
        PriceView memory v = oracle.observe(GOLD);
        assertEq(uint8(v.status), uint8(MarketStatus.OPEN));
        assertEq(v.price18, uint256(P0) * 1e10);
    }

    function test_futureTimestampIsStale() public {
        xau.pushAt(_bps(P0, 10), vm.getBlockTimestamp() + 1);
        PriceView memory v = oracle.observe(GOLD);
        assertEq(uint8(v.status), uint8(MarketStatus.STALE));
        assertEq(v.price18, uint256(P0) * 1e10, "future answer never accepted");
    }

    function test_staleAfterHeartbeatPlusGrace() public {
        vm.warp(vm.getBlockTimestamp() + S.METALS_HEARTBEAT + C.FEED_GRACE);
        assertEq(uint8(_status()), uint8(MarketStatus.OPEN), "boundary still fresh");
        vm.warp(vm.getBlockTimestamp() + 1);
        assertEq(uint8(_status()), uint8(MarketStatus.STALE));
        xau.push(_bps(P0, 10));
        assertEq(uint8(_status()), uint8(MarketStatus.OPEN), "fresh round recovers");
    }

    function test_answeredInRoundBehindIsStale() public {
        uint80 id = xau.push(_bps(P0, 10));
        xau.setAnsweredInRound(id, id - 1);
        assertEq(uint8(_status()), uint8(MarketStatus.STALE));
    }

    function test_clampTripsCircuitThenThreeRoundConfirm() public {
        int256 jumped = _bps(P0, 300);
        xau.push(jumped);
        PriceView memory v = oracle.observe(GOLD);
        assertEq(uint8(v.status), uint8(MarketStatus.CIRCUIT));
        assertEq(v.price18, uint256(P0) * 1e10, "clamped price not accepted");

        vm.warp(vm.getBlockTimestamp() + 100);
        xau.push(_bps(jumped, 10));
        assertEq(uint8(_status()), uint8(MarketStatus.CIRCUIT), "2 rounds are not enough");
        vm.warp(vm.getBlockTimestamp() + 100);
        xau.push(_bps(jumped, -10));
        assertEq(uint8(_status()), uint8(MarketStatus.CIRCUIT), "3 rounds but only 200 s");
        vm.warp(vm.getBlockTimestamp() + 100);
        xau.push(jumped);
        v = oracle.observe(GOLD);
        assertEq(uint8(v.status), uint8(MarketStatus.OPEN), "3 rounds in band over >= 300 s confirm");
        assertEq(v.price18, uint256(jumped) * 1e10);
    }

    function test_confirmRejectsRoundsOutsideBand() public {
        int256 jumped = _bps(P0, 300);
        xau.push(jumped);
        vm.warp(vm.getBlockTimestamp() + 200);
        xau.push(_bps(jumped, 100));
        vm.warp(vm.getBlockTimestamp() + 200);
        xau.push(jumped);
        assertEq(uint8(_status()), uint8(MarketStatus.CIRCUIT), "a round 1% away breaks the band");
    }

    function test_acceptFeedPriceClearsCircuitWithFeedAnswer() public {
        int256 jumped = _bps(P0, 300);
        xau.push(jumped);
        assertEq(uint8(_status()), uint8(MarketStatus.CIRCUIT));
        // PARAM_ADMIN is timelocked: schedule, wait PARAM_DELAY, execute. No price argument exists.
        RoleWiring.grant(am, C.PARAM_ADMIN_ROLE, address(this));
        bytes memory call = abi.encodeCall(SessionOracle.acceptFeedPrice, (GOLD));
        vm.expectRevert();
        oracle.acceptFeedPrice(GOLD);
        am.schedule(address(oracle), call, 0);
        vm.warp(vm.getBlockTimestamp() + C.PARAM_DELAY);
        xau.push(jumped);
        am.execute(address(oracle), call);
        PriceView memory v = oracle.observe(GOLD);
        assertEq(uint8(v.status), uint8(MarketStatus.OPEN));
        assertEq(v.price18, uint256(jumped) * 1e10, "ratifies the feed's own answer");
    }

    function test_closedDailyBreakAndClosedSpread() public {
        vm.warp(MONDAY + 21 * HOUR + 30 * 60);
        xau.push(_bps(P0, 10));
        PriceView memory v = oracle.observe(GOLD);
        assertEq(uint8(v.status), uint8(MarketStatus.CLOSED));
        assertEq(v.price18, uint256(P0) * 1e10, "no acceptance while closed");
        uint256 age = vm.getBlockTimestamp() - v.updatedAt;
        assertEq(v.spreadBps, PerpMath.closedSpreadBps(age));
    }

    function test_reopenWindowAndReopenClamp() public {
        // Friday 20:00 UTC: last accepted before the weekend.
        uint256 friday = MONDAY + 4 * DAY;
        vm.warp(friday + 20 * HOUR);
        xau.push(P0);
        assertEq(uint8(_status()), uint8(MarketStatus.OPEN));
        // Sunday 23:00 UTC reopen with a 4% gap: inside reopenClamp (5%), outside clamp (2%).
        vm.warp(friday + 2 * DAY + 23 * HOUR);
        xau.push(_bps(P0, 400));
        PriceView memory v = oracle.observe(GOLD);
        assertEq(uint8(v.status), uint8(MarketStatus.REOPENING));
        assertEq(v.price18, uint256(_bps(P0, 400)) * 1e10);
        vm.warp(vm.getBlockTimestamp() + C.REOPEN_WINDOW - 1);
        assertEq(uint8(_status()), uint8(MarketStatus.REOPENING));
        vm.warp(vm.getBlockTimestamp() + 1);
        assertEq(uint8(_status()), uint8(MarketStatus.OPEN));
    }

    function test_reopenGapBeyondReopenClampTripsCircuit() public {
        uint256 friday = MONDAY + 4 * DAY;
        vm.warp(friday + 20 * HOUR);
        xau.push(P0);
        oracle.observe(GOLD);
        vm.warp(friday + 2 * DAY + 23 * HOUR);
        xau.push(_bps(P0, 600));
        assertEq(uint8(_status()), uint8(MarketStatus.CIRCUIT));
    }

    function test_haltAutoExpires() public {
        vm.prank(guardian);
        oracle.halt(GOLD);
        assertEq(uint8(_status()), uint8(MarketStatus.HALTED));
        vm.warp(vm.getBlockTimestamp() + C.MAX_PAUSE_SECONDS);
        xau.push(P0);
        assertEq(uint8(_status()), uint8(MarketStatus.OPEN));
    }

    function test_feedDescriptionAsserted() public {
        SessionOracle.FeedInit[] memory inits = new SessionOracle.FeedInit[](1);
        inits[0] = _feedInit(GOLD, xau, S.XAG_DESCRIPTION);
        vm.expectRevert(
            abi.encodeWithSelector(
                Errors.DescriptionMismatch.selector,
                keccak256(bytes(S.XAG_DESCRIPTION)),
                keccak256(bytes(S.XAU_DESCRIPTION))
            )
        );
        new SessionOracle(address(am), calendar, inits);
    }

    function test_guardianOnlyHalts() public {
        vm.expectRevert();
        oracle.halt(GOLD);
        vm.expectRevert(abi.encodeWithSelector(Errors.UnknownMarket.selector, uint8(7)));
        oracle.peek(7);
    }
}
