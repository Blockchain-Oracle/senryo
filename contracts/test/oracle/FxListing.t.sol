// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Constants as C} from "../../src/libraries/Constants.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {Book, MarketParams, MarketStatus, PriceView} from "../../src/libraries/Types.sol";
import {MarketRegistry} from "../../src/core/MarketRegistry.sol";
import {MarketCalendar} from "../../src/oracle/MarketCalendar.sol";
import {SessionOracle} from "../../src/oracle/SessionOracle.sol";
import {FxListing} from "../../script/FxListing.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";
import {Fixture} from "../utils/Fixture.sol";
import {MockFeed} from "../utils/Mocks.sol";

/// @notice S8.23 FX majors: listing through the timelocked PARAM_ADMIN path in AddMarkets' order (calendar → feeds →
/// markets), 18-decimal feeds normalised 1:1 in their own orientation, the 24/5 calendar, the per-market caps whose sum
/// bounds correlated USD exposure (D-187), and the 10 % profit cap.
contract FxListingTest is Fixture {
    uint256 internal constant FRIDAY = MONDAY + 4 * DAY;
    uint256 internal constant SUNDAY = MONDAY + 6 * DAY;
    uint256 internal constant CONFIRM_STEP = 150;
    uint256 internal constant PRICE_UP_20_PCT = 12_000;
    uint256 internal constant DEADLINE = 1 hours;

    FxListing.Market[] internal fx;
    MockFeed[] internal feeds;
    address internal trader = makeAddr("trader");

    function setUp() public {
        _deploy(false, MONDAY + 12 * HOUR);
        _seedBooks();
        FxListing.Market[] memory m = FxListing.markets();
        for (uint256 i; i < m.length; ++i) {
            fx.push(m[i]);
            MockFeed f = new MockFeed(S.FX_FEED_DECIMALS, m[i].description);
            f.push(m[i].mirrorSeedAnswer);
            feeds.push(f);
        }
        // Same path as AddMarkets.s.sol: PARAM_ADMIN with the 6 h delay schedules, then executes after the delay.
        am.grantRole(C.PARAM_ADMIN_ROLE, address(this), C.PARAM_DELAY);
        bytes[] memory calls = _listingCalls();
        address[] memory targets = _listingTargets();
        for (uint256 i; i < calls.length; ++i) {
            am.schedule(targets[i], calls[i], 0);
        }
        vm.warp(vm.getBlockTimestamp() + C.PARAM_DELAY);
        for (uint256 i; i < feeds.length; ++i) {
            feeds[i].push(fx[i].mirrorSeedAnswer);
        }
        xau.push(S.XAU_MIRROR_SEED_ANSWER);
        xag.push(S.XAG_MIRROR_SEED_ANSWER);
        for (uint256 i; i < calls.length; ++i) {
            am.execute(targets[i], calls[i]);
        }
    }

    function _listingCalls() internal view returns (bytes[] memory calls) {
        calls = new bytes[](1 + 2 * fx.length);
        calls[0] = abi.encodeCall(MarketCalendar.setWeek, (S.FX_CALENDAR, S.fxWeek()));
        for (uint256 i; i < fx.length; ++i) {
            SessionOracle.FeedInit memory init = FxListing.feedInit(fx[i], address(feeds[i]), S.FX_HEARTBEAT);
            calls[1 + i] = abi.encodeCall(SessionOracle.setFeed, (init));
            calls[1 + fx.length + i] = abi.encodeCall(MarketRegistry.addMarket, (fx[i].params));
        }
    }

    function _listingTargets() internal view returns (address[] memory targets) {
        targets = new address[](1 + 2 * fx.length);
        targets[0] = address(calendar);
        for (uint256 i; i < fx.length; ++i) {
            targets[1 + i] = address(oracle);
            targets[1 + fx.length + i] = address(core);
        }
    }

    function test_listingIsTimelockedAndIdsAgree() public view {
        assertEq(core.marketCount(), 2 + fx.length, "gold, silver + five FX");
        for (uint256 i; i < fx.length; ++i) {
            assertEq(fx[i].marketId, 2 + i, "ids follow silver");
            MarketParams memory p = core.marketParams(fx[i].marketId);
            assertEq(keccak256(abi.encode(p)), keccak256(abi.encode(fx[i].params)), "params as seeded");
            (, uint8 cal,, uint32 hb,,) = oracle.feeds(fx[i].marketId);
            assertEq(cal, S.FX_CALENDAR);
            assertEq(hb, S.FX_HEARTBEAT);
        }
    }

    function test_unscheduledListingReverts() public {
        vm.expectRevert();
        core.addMarket(fx[0].params);
    }

    function test_eighteenDecimalFeedsAreNotRescaledOrInverted() public view {
        for (uint256 i; i < fx.length; ++i) {
            PriceView memory pv = oracle.peek(fx[i].marketId);
            assertEq(uint8(pv.status), uint8(MarketStatus.OPEN));
            // forge-lint: disable-next-line(unsafe-typecast)
            assertEq(pv.price18, uint256(fx[i].mirrorSeedAnswer), "1e18 answer = 1e18 price");
        }
        // JPY / USD is USD per yen (≈ 0.00635), never inverted into yen per USD.
        assertLt(oracle.peek(S.JPY_MARKET).price18, C.WAD);
    }

    function test_fxCalendarIs24x5WithDstUnion() public view {
        for (uint256 d; d < 4; ++d) {
            assertTrue(calendar.isOpen(S.FX_CALENDAR, MONDAY + d * DAY + 22 * HOUR), "no daily break");
        }
        assertTrue(calendar.isOpen(S.FX_CALENDAR, FRIDAY + 21 * HOUR - 1), "Fri 20:59:59 open");
        assertFalse(calendar.isOpen(S.FX_CALENDAR, FRIDAY + 21 * HOUR), "Fri 21:00 closed (17:00 EDT)");
        assertFalse(calendar.isOpen(S.FX_CALENDAR, FRIDAY + DAY + 12 * HOUR), "Sat closed");
        assertFalse(calendar.isOpen(S.FX_CALENDAR, SUNDAY + 23 * HOUR - 1), "Sun 22:59:59 closed (18:00 EST)");
        assertTrue(calendar.isOpen(S.FX_CALENDAR, SUNDAY + 23 * HOUR), "Sun 23:00 open");
    }

    function test_exposureShareHoldsAndCapsBind() public {
        FxListing.assertExposureWithinShare();
        uint256 absSum;
        uint256 oiSum;
        _depositFor(trader, ausd, S.LP_SEED_USD6);
        for (uint256 i; i < fx.length; ++i) {
            MarketParams memory p = fx[i].params;
            uint8 id = fx[i].marketId;
            absSum += p.oiCapAbsUsd6;
            assertEq(p.skewCapPoolBps, p.oiCapPoolBps, "skew cap = OI cap");
            // Fill each market's long side in trade-cap steps (a correlated "short USD" book) until the cap binds.
            uint256 pool = _pool();
            uint256 cap = _min(p.oiCapAbsUsd6, pool * p.oiCapPoolBps / C.BPS);
            uint256 step = pool * p.tradeCapPoolBps / C.BPS;
            while (_longOi(id) + step <= cap) {
                _long(id, step);
            }
            uint256 room = cap - _longOi(id);
            if (room >= C.MIN_POSITION_NOTIONAL_USD6) _long(id, room - C.MIN_POSITION_NOTIONAL_USD6 / 2);
            vm.prank(trader);
            vm.expectPartialRevert(Errors.OpenInterestCapExceeded.selector);
            core.increase(id, true, C.MIN_POSITION_NOTIONAL_USD6, type(uint256).max, _deadline());
            oiSum += _longOi(id);
        }
        assertEq(absSum, S.LP_SEED_USD6 * S.FX_EXPOSURE_SHARE_BPS / C.BPS, "caps sum to 50 % of the seed");
        assertLe(oiSum, _pool() * S.FX_EXPOSURE_SHARE_BPS / C.BPS, "correlated FX OI within 50 % of the pool");
    }

    function _longOi(uint8 id) internal view returns (uint256) {
        return uint256(core.marketState(id).longSize) * oracle.peek(id).price18 / C.NOTIONAL_SCALE;
    }

    function _pool() internal view returns (uint256) {
        (uint256 a, uint256 u) = core.book(Book.POOL);
        return a + u;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _deadline() internal view returns (uint64) {
        return uint64(vm.getBlockTimestamp() + DEADLINE);
    }

    function test_realisedFxProfitIsCappedAtTenPercent() public {
        _depositFor(trader, ausd, S.LP_SEED_USD6);
        uint256 notional = S.LP_SEED_USD6 * S.FX_TRADE_CAP_POOL_BPS / C.BPS;
        _long(S.EUR_MARKET, notional);
        vm.roll(block.number + C.MIN_HOLD_BLOCKS);
        // +20 % EUR/USD, confirmed over 3 rounds / 300 s (it trips the 2 % clamp first).
        MockFeed eur = feeds[0];
        int256 up = S.EUR_MIRROR_SEED_ANSWER * int256(PRICE_UP_20_PCT) / int256(C.BPS);
        for (uint256 i; i < C.CONFIRM_ROUNDS; ++i) {
            eur.push(up);
            vm.warp(vm.getBlockTimestamp() + CONFIRM_STEP);
        }
        eur.push(up);
        uint256 before = _balance(trader);
        vm.prank(trader);
        core.close(S.EUR_MARKET, 0, uint64(vm.getBlockTimestamp() + DEADLINE));
        uint256 gained = _balance(trader) - before;
        assertLe(gained, notional * S.FX_MAX_PROFIT_BPS / C.BPS, "profit <= 10 % of notional");
        assertGt(gained, notional * S.FX_MAX_PROFIT_BPS / C.BPS / 2, "and the cap, not the move, bound it");
    }

    function _long(uint8 marketId, uint256 notional) internal {
        vm.prank(trader);
        core.increase(marketId, true, notional, type(uint256).max, uint64(vm.getBlockTimestamp() + DEADLINE));
    }

    function _balance(address user) internal view returns (uint256) {
        return uint256(core.account(user).ausd) + core.account(user).usdc;
    }

    function test_marketBeforeFeedWouldBreakPoolValue() public {
        // Why AddMarkets executes setFeed before addMarket: a core market without an oracle feed reverts `peek`,
        // and `poolValue` (LP mint/redeem) peeks every core market.
        am.schedule(address(core), abi.encodeCall(MarketRegistry.addMarket, (fx[0].params)), 0);
        vm.warp(vm.getBlockTimestamp() + C.PARAM_DELAY);
        am.execute(address(core), abi.encodeCall(MarketRegistry.addMarket, (fx[0].params)));
        vm.expectRevert(abi.encodeWithSelector(Errors.UnknownMarket.selector, uint8(2 + fx.length)));
        core.poolValue(true);
    }
}
