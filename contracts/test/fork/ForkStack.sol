// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISenryoCore} from "../../src/interfaces/ISenryoCore.sol";
import {SenryoCore} from "../../src/core/SenryoCore.sol";
import {LpVault} from "../../src/lp/LpVault.sol";
import {MarketCalendar} from "../../src/oracle/MarketCalendar.sol";
import {SessionOracle} from "../../src/oracle/SessionOracle.sol";
import {AggregatorV3Interface} from "../../src/oracle/interfaces/AggregatorV3Interface.sol";
import {IPriceSource} from "../../src/oracle/interfaces/IPriceSource.sol";
import {CollateralSwapper, IPermit2, IUniversalRouter, PoolKey} from "../../src/periphery/CollateralSwapper.sol";
import {StarterDrip} from "../../src/periphery/StarterDrip.sol";
import {MirrorAggregator} from "../../src/testnet/MirrorAggregator.sol";
import {CALENDAR_WORD_COUNT, Constants as C} from "../../src/libraries/Constants.sol";
import {DepositSource, MarketParams} from "../../src/libraries/Types.sol";
import {RoleWiring} from "../../script/RoleWiring.sol";
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

/// @notice The Senryo stack as `script/Deploy.s.sol` builds it, on a fork of Monad mainnet (143: real AUSD/USDC,
/// Chainlink XAU/XAG + stable feeds, Uniswap v4) or testnet (10143: the deployed MockAUSD/MockUSDC and MirrorXAU/XAG
/// from `packages/contracts/src/addresses/10143.json`, i.e. what a testnet redeploy reuses). Runs only when
/// `MONAD_FORK_URL` is set (a local `anvil --fork-url … --network monad`); otherwise every test is skipped.
/// Nothing is ever broadcast: impersonation and balances exist only inside the fork.
abstract contract ForkStack is Test {
    using stdJson for string;

    /// @dev Testnet deployer (public, docs/plan/ids-and-txs.md): ADMIN of the testnet AccessManager.
    address internal constant TESTNET_DEPLOYER = 0x52d205731E97C90aAB738AE66371449F585C0E6A;

    AccessManager internal am;
    SessionOracle internal oracle;
    SenryoCore internal core;
    LpVault internal vault;
    StarterDrip internal drip;
    CollateralSwapper internal swapper;
    IV4Quoter internal quoter = IV4Quoter(S.V4_QUOTER);
    IERC20 internal ausd;
    IERC20 internal usdc;
    address internal xauFeed;
    address internal xagFeed;
    bool internal mainnet;

    function _forkOrSkip() internal returns (bool) {
        string memory rpc = vm.envOr("MONAD_FORK_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return false;
        }
        vm.createSelectFork(rpc);
        mainnet = block.chainid == C.MAINNET_CHAIN_ID;
        return true;
    }

    /// @dev Same constructor arguments and wiring as Deploy.s.sol; this test is ADMIN plus every operational role.
    function _deployStack() internal {
        _externals();
        am = new AccessManager(address(this));
        uint8[] memory ids = new uint8[](1);
        ids[0] = S.CME_METALS_CALENDAR;
        uint256[CALENDAR_WORD_COUNT][] memory weekBits = new uint256[CALENDAR_WORD_COUNT][](1);
        weekBits[0] = S.cmeMetalsWeek();
        MarketCalendar calendar = new MarketCalendar(address(am), ids, weekBits);

        SessionOracle.FeedInit[] memory inits = new SessionOracle.FeedInit[](2);
        inits[0] = _feedInit(S.GOLD_MARKET, xauFeed, S.XAU_DESCRIPTION);
        inits[1] = _feedInit(S.SILVER_MARKET, xagFeed, S.XAG_DESCRIPTION);
        oracle = new SessionOracle(address(am), calendar, inits);

        MarketParams[] memory markets = new MarketParams[](2);
        markets[S.GOLD_MARKET] = S.goldParams();
        markets[S.SILVER_MARKET] = S.goldParams();
        core = new SenryoCore(
            address(am),
            address(ausd),
            address(usdc),
            IPriceSource(address(oracle)),
            markets,
            S.collateral(mainnet ? S.MAINNET_AUSD_USD : address(0), S.AUSD_HAIRCUT_BPS),
            S.collateral(mainnet ? S.MAINNET_USDC_USD : address(0), S.USDC_HAIRCUT_BPS)
        );
        vault = new LpVault(address(am), ausd, ISenryoCore(address(core)), S.LP_TVL_CAP_USD6);
        drip = new StarterDrip(address(am), ISenryoCore(address(core)), _dripConfig());
        if (mainnet) {
            swapper = new CollateralSwapper(
                address(am), address(core), IUniversalRouter(S.UNIVERSAL_ROUTER), IPermit2(S.PERMIT2), S.stablePoolKey()
            );
            core.setSwapper(address(swapper));
        }
        core.setDepositSource(address(drip), DepositSource.VOUCHER);
        _wire();
    }

    /// @dev Real tokens: mainnet from the v4 PoolManager's balance (its pool accounting is internal; S3 swap check),
    /// testnet mocks via storage (`deal`).
    function _fund(address to, IERC20 token, uint256 amount) internal {
        if (!mainnet) {
            deal(address(token), to, token.balanceOf(to) + amount);
            return;
        }
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

    /// @dev Testnet mirrors carry no keeper rounds yet (S8.2): publish the current answers as a fresh round.
    function _freshPrices() internal {
        if (mainnet) return;
        _repush(xauFeed);
        _repush(xagFeed);
    }

    function _quote(bool zeroForOne, uint256 amountIn) internal returns (uint256 amountOut) {
        (amountOut,) = quoter.quoteExactInputSingle(
            IV4Quoter.QuoteExactSingleParams({
                poolKey: S.stablePoolKey(), zeroForOne: zeroForOne, exactAmount: uint128(amountIn), hookData: ""
            })
        );
    }

    // ---------------------------------------------------------------- internal

    function _externals() private {
        if (mainnet) {
            (ausd, usdc) = (IERC20(S.MAINNET_AUSD), IERC20(S.MAINNET_USDC));
            (xauFeed, xagFeed) = (S.MAINNET_XAU_USD, S.MAINNET_XAG_USD);
            return;
        }
        string memory book = vm.readFile(
            string.concat(
                vm.projectRoot(), "/../packages/contracts/src/addresses/", vm.toString(block.chainid), ".json"
            )
        );
        ausd = IERC20(book.readAddress(".contracts.MockAUSD.address"));
        usdc = IERC20(book.readAddress(".contracts.MockUSDC.address"));
        xauFeed = book.readAddress(".contracts.MirrorXAU.address");
        xagFeed = book.readAddress(".contracts.MirrorXAG.address");
        AccessManager testnetAm = AccessManager(book.readAddress(".contracts.AccessManager.address"));
        vm.startPrank(TESTNET_DEPLOYER);
        testnetAm.grantRole(C.MIRROR_ROLE, address(this), 0);
        vm.stopPrank();
        _freshPrices();
    }

    function _wire() private {
        RoleWiring.Targets memory t;
        t.core = address(core);
        t.oracle = address(oracle);
        t.calendar = address(oracle.calendar());
        t.vault = address(vault);
        t.drip = address(drip);
        t.swapper = address(swapper);
        RoleWiring.wire(am, t);
        RoleWiring.grant(am, C.POOL_ROLE, address(vault));
        RoleWiring.grant(am, C.CARD_OPERATOR_ROLE, address(this));
        RoleWiring.grant(am, C.GUARDIAN_ROLE, address(this));
        RoleWiring.grant(am, C.RELAYER_ROLE, address(this));
        if (!mainnet) {
            string memory book = vm.readFile(
                string.concat(
                    vm.projectRoot(), "/../packages/contracts/src/addresses/", vm.toString(block.chainid), ".json"
                )
            );
            AccessManager testnetAm = AccessManager(book.readAddress(".contracts.AccessManager.address"));
            vm.prank(TESTNET_DEPLOYER);
            testnetAm.grantRole(C.MINTER_ROLE, address(drip), 0);
        }
    }

    function _repush(address feed) private {
        (, int256 answer,,,) = AggregatorV3Interface(feed).latestRoundData();
        MirrorAggregator(feed).pushAnswer(answer);
    }

    function _dripConfig() private view returns (StarterDrip.Config memory) {
        return StarterDrip.Config({
            dripWei: mainnet ? S.MAINNET_DRIP_WEI : S.TESTNET_DRIP_WEI,
            dailyBudgetWei: mainnet ? S.MAINNET_DAILY_BUDGET_WEI : S.TESTNET_DAILY_BUDGET_WEI,
            topUpCapWei: S.TOPUP_CAP_WEI,
            practiceToken: mainnet ? address(0) : address(ausd),
            practiceAmount: mainnet ? 0 : S.PRACTICE_AMOUNT_USD6,
            voucherToken: address(ausd),
            voucherAmount: S.VOUCHER_AMOUNT_USD6,
            maxVouchers: S.MAX_VOUCHERS
        });
    }

    function _feedInit(uint8 marketId, address feed, string memory desc)
        private
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
