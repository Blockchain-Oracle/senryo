// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SenryoCore} from "../../src/core/SenryoCore.sol";
import {MarketCalendar} from "../../src/oracle/MarketCalendar.sol";
import {SessionOracle} from "../../src/oracle/SessionOracle.sol";
import {AggregatorV3Interface} from "../../src/oracle/interfaces/AggregatorV3Interface.sol";
import {IPriceSource} from "../../src/oracle/interfaces/IPriceSource.sol";
import {CollateralSwapper, IPermit2, IUniversalRouter, PoolKey} from "../../src/periphery/CollateralSwapper.sol";
import {CALENDAR_WORD_COUNT} from "../../src/libraries/Constants.sol";
import {MarketParams} from "../../src/libraries/Types.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";

/// @notice v4 Quoter (v4-periphery `IV4Quoter`): simulated through unlock + revert, state is unchanged.
interface IV4Quoter {
    struct QuoteExactSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 exactAmount;
        bytes hookData;
    }

    function quoteExactInputSingle(QuoteExactSingleParams memory params)
        external
        returns (uint256 amountOut, uint256 gasEstimate);
}

/// @notice The mainnet stack (real AUSD/USDC, Chainlink XAU/XAG + stable feeds, Uniswap v4) on a Monad mainnet fork.
/// Runs only when `MONAD_FORK_URL` is set, e.g. a local `anvil --fork-url https://rpc.monad.xyz --network monad`;
/// otherwise every test in the suite is skipped (no RPC in the default gate). Nothing is ever broadcast.
abstract contract ForkStack is Test {
    AccessManager internal am;
    SessionOracle internal oracle;
    SenryoCore internal core;
    CollateralSwapper internal swapper;
    IV4Quoter internal quoter = IV4Quoter(S.V4_QUOTER);
    IERC20 internal ausd = IERC20(S.MAINNET_AUSD);
    IERC20 internal usdc = IERC20(S.MAINNET_USDC);

    function _forkOrSkip() internal returns (bool) {
        string memory rpc = vm.envOr("MONAD_FORK_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return false;
        }
        vm.createSelectFork(rpc);
        return true;
    }

    /// @dev Mirrors script/Deploy.s.sol on mainnet: same constructor arguments, the swapper wired to the core.
    function _deployStack() internal {
        am = new AccessManager(address(this));
        uint8[] memory ids = new uint8[](1);
        ids[0] = S.CME_METALS_CALENDAR;
        uint256[CALENDAR_WORD_COUNT][] memory weekBits = new uint256[CALENDAR_WORD_COUNT][](1);
        weekBits[0] = S.cmeMetalsWeek();
        MarketCalendar calendar = new MarketCalendar(address(am), ids, weekBits);

        SessionOracle.FeedInit[] memory inits = new SessionOracle.FeedInit[](2);
        inits[0] = _feedInit(S.GOLD_MARKET, S.MAINNET_XAU_USD, S.XAU_DESCRIPTION);
        inits[1] = _feedInit(S.SILVER_MARKET, S.MAINNET_XAG_USD, S.XAG_DESCRIPTION);
        oracle = new SessionOracle(address(am), calendar, inits);

        MarketParams[] memory markets = new MarketParams[](2);
        markets[S.GOLD_MARKET] = S.goldParams();
        markets[S.SILVER_MARKET] = S.goldParams();
        core = new SenryoCore(
            address(am),
            S.MAINNET_AUSD,
            S.MAINNET_USDC,
            IPriceSource(address(oracle)),
            markets,
            S.collateral(S.MAINNET_AUSD_USD, S.AUSD_HAIRCUT_BPS),
            S.collateral(S.MAINNET_USDC_USD, S.USDC_HAIRCUT_BPS)
        );
        swapper = new CollateralSwapper(
            address(am), address(core), IUniversalRouter(S.UNIVERSAL_ROUTER), IPermit2(S.PERMIT2), S.stablePoolKey()
        );
        core.setSwapper(address(swapper));
    }

    /// @dev Real tokens from the v4 PoolManager's balance (its pool accounting is internal; S3 swap check).
    function _fund(address to, IERC20 token, uint256 amount) internal {
        vm.prank(S.V4_POOL_MANAGER);
        require(token.transfer(to, amount), "fund");
    }

    function _depositInto(address user, IERC20 token, uint256 amount) internal {
        _fund(user, token, amount);
        vm.startPrank(user);
        token.approve(address(core), amount);
        core.deposit(address(token), amount);
        vm.stopPrank();
    }

    function _quote(bool zeroForOne, uint256 amountIn) internal returns (uint256 amountOut) {
        (amountOut,) = quoter.quoteExactInputSingle(
            IV4Quoter.QuoteExactSingleParams({
                poolKey: S.stablePoolKey(), zeroForOne: zeroForOne, exactAmount: uint128(amountIn), hookData: ""
            })
        );
    }

    function _feedInit(uint8 marketId, address feed, string memory desc)
        internal
        pure
        returns (SessionOracle.FeedInit memory)
    {
        return SessionOracle.FeedInit({
            marketId: marketId,
            feed: AggregatorV3Interface(feed),
            descriptionHash: keccak256(bytes(desc)),
            calendarId: S.CME_METALS_CALENDAR,
            heartbeat: S.METALS_HEARTBEAT,
            clampBps: S.CLAMP_BPS,
            reopenClampBps: S.REOPEN_CLAMP_BPS
        });
    }
}
