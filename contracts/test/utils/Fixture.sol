// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SenryoCore} from "../../src/core/SenryoCore.sol";
import {LpVault} from "../../src/lp/LpVault.sol";
import {MarketCalendar} from "../../src/oracle/MarketCalendar.sol";
import {SessionOracle} from "../../src/oracle/SessionOracle.sol";
import {IPriceSource} from "../../src/oracle/interfaces/IPriceSource.sol";
import {ISenryoCore} from "../../src/interfaces/ISenryoCore.sol";
import {CALENDAR_WORD_COUNT, Constants as C} from "../../src/libraries/Constants.sol";
import {Book, MarketParams} from "../../src/libraries/Types.sol";
import {RoleWiring} from "../../script/RoleWiring.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";
import {MockFeed, ParSwapper, TestToken} from "./Mocks.sol";

/// @notice Shared deployment for the targeted checks: the real contracts, controllable feeds and test tokens.
abstract contract Fixture is Test {
    /// @dev Monday 2026-09-28 00:00 UTC (WEEK_ANCHOR + 2960 weeks).
    uint256 internal constant MONDAY = 1_790_553_600;
    uint256 internal constant HOUR = 3600;
    uint256 internal constant DAY = 86_400;

    AccessManager internal am;
    MarketCalendar internal calendar;
    SessionOracle internal oracle;
    SenryoCore internal core;
    LpVault internal vault;
    TestToken internal ausd;
    TestToken internal usdc;
    MockFeed internal xau;
    MockFeed internal xag;
    ParSwapper internal swapper;

    address internal operator = makeAddr("operator");
    address internal guardian = makeAddr("guardian");
    address internal lp = makeAddr("lp");

    function _deploy(bool alwaysOpen, uint256 startAt) internal {
        vm.warp(startAt);
        vm.roll(1000);
        am = new AccessManager(address(this));
        ausd = new TestToken("AUSD");
        usdc = new TestToken("USDC");
        xau = new MockFeed(S.FEED_DECIMALS, S.XAU_DESCRIPTION);
        xag = new MockFeed(S.FEED_DECIMALS, S.XAG_DESCRIPTION);
        xau.push(S.XAU_MIRROR_SEED_ANSWER);
        xag.push(S.XAG_MIRROR_SEED_ANSWER);

        uint8[] memory ids = new uint8[](1);
        uint256[CALENDAR_WORD_COUNT][] memory weeks_ = new uint256[CALENDAR_WORD_COUNT][](1);
        weeks_[0] = alwaysOpen ? _allOpen() : S.cmeMetalsWeek();
        calendar = new MarketCalendar(address(am), ids, weeks_);

        SessionOracle.FeedInit[] memory inits = new SessionOracle.FeedInit[](2);
        inits[0] = _feedInit(S.GOLD_MARKET, xau, S.XAU_DESCRIPTION);
        inits[1] = _feedInit(S.SILVER_MARKET, xag, S.XAG_DESCRIPTION);
        oracle = new SessionOracle(address(am), calendar, inits);

        MarketParams[] memory markets = new MarketParams[](2);
        markets[0] = S.goldParams();
        markets[1] = S.goldParams();
        core = new SenryoCore(
            address(am),
            address(ausd),
            address(usdc),
            IPriceSource(address(oracle)),
            markets,
            S.collateral(address(0), S.AUSD_HAIRCUT_BPS),
            S.collateral(address(0), S.USDC_HAIRCUT_BPS)
        );
        vault = new LpVault(address(am), IERC20(address(ausd)), ISenryoCore(address(core)), S.LP_TVL_CAP_USD6);
        swapper = new ParSwapper();
        core.setSwapper(address(swapper));

        RoleWiring.Targets memory t;
        t.core = address(core);
        t.oracle = address(oracle);
        t.calendar = address(calendar);
        t.vault = address(vault);
        RoleWiring.wire(am, t);
        RoleWiring.grant(am, C.CARD_OPERATOR_ROLE, operator);
        RoleWiring.grant(am, C.POOL_ROLE, address(vault));
        RoleWiring.grant(am, C.GUARDIAN_ROLE, guardian);

        oracle.observe(S.GOLD_MARKET);
        oracle.observe(S.SILVER_MARKET);
    }

    function _seedBooks() internal {
        ausd.mint(lp, S.LP_SEED_USD6);
        vm.startPrank(lp);
        ausd.approve(address(vault), S.LP_SEED_USD6);
        vault.deposit(S.LP_SEED_USD6, lp);
        vm.stopPrank();
        ausd.mint(address(this), S.INSURANCE_SEED_USD6);
        ausd.approve(address(core), S.INSURANCE_SEED_USD6);
        core.fundBook(Book.INSURANCE, address(ausd), S.INSURANCE_SEED_USD6);
        usdc.mint(address(this), S.CARD_FLOAT_SEED_USD6);
        usdc.approve(address(core), S.CARD_FLOAT_SEED_USD6);
        core.fundBook(Book.CARD_FLOAT, address(usdc), S.CARD_FLOAT_SEED_USD6);
    }

    function _depositFor(address user, TestToken token, uint256 amount) internal {
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(core), amount);
        core.deposit(address(token), amount);
        vm.stopPrank();
    }

    function _feedInit(uint8 marketId, MockFeed feed, string memory desc)
        internal
        pure
        returns (SessionOracle.FeedInit memory)
    {
        return SessionOracle.FeedInit({
            marketId: marketId,
            feed: feed,
            descriptionHash: keccak256(bytes(desc)),
            calendarId: S.CME_METALS_CALENDAR,
            heartbeat: S.METALS_HEARTBEAT,
            clampBps: S.CLAMP_BPS,
            reopenClampBps: S.REOPEN_CLAMP_BPS
        });
    }

    function _allOpen() internal pure returns (uint256[CALENDAR_WORD_COUNT] memory w) {
        for (uint256 i; i < CALENDAR_WORD_COUNT; ++i) {
            w[i] = type(uint256).max;
        }
    }
}
