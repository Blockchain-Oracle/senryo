// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {VmSafe} from "forge-std/Vm.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {SenryoCore} from "../src/core/SenryoCore.sol";
import {LpVault} from "../src/lp/LpVault.sol";
import {MarketCalendar} from "../src/oracle/MarketCalendar.sol";
import {SessionOracle} from "../src/oracle/SessionOracle.sol";
import {AggregatorV3Interface} from "../src/oracle/interfaces/AggregatorV3Interface.sol";
import {IPriceSource} from "../src/oracle/interfaces/IPriceSource.sol";
import {CollateralSwapper, IPermit2, IUniversalRouter} from "../src/periphery/CollateralSwapper.sol";
import {InboxFactory} from "../src/periphery/InboxFactory.sol";
import {IntentRouter} from "../src/periphery/IntentRouter.sol";
import {StarterDrip} from "../src/periphery/StarterDrip.sol";
import {MirrorAggregator} from "../src/testnet/MirrorAggregator.sol";
import {MockAUSD} from "../src/testnet/MockAUSD.sol";
import {MockUSDC} from "../src/testnet/MockUSDC.sol";
import {CALENDAR_WORD_COUNT, Constants as C} from "../src/libraries/Constants.sol";
import {DepositSource, MarketParams} from "../src/libraries/Types.sol";
import {DeployBase} from "./DeployBase.sol";
import {FxListing} from "./FxListing.sol";
import {RoleWiring} from "./RoleWiring.sol";
import {SeedConstants as S} from "./SeedConstants.sol";
import {Seeder} from "./Seeder.sol";

/// @title Deploy — ensure-style deployment (specs/contracts.md "Deploy steps").
/// @notice `forge script script/Deploy.s.sol --rpc-url monad_testnet --account senryo-deployer --sender <addr>
/// --broadcast --slow --gas-estimate-multiplier 110`. Reads/writes packages/contracts/src/addresses/<chainId>.json,
/// creates only what is missing and reverts on drift. Testnet-only contracts assert chainid != 143; mainnet needs
/// SENRYO_MAINNET_OK=true (an [OK?] step, S8). Roles: the broadcaster is ADMIN, GUARDIAN and PARAM_ADMIN (delayed)
/// on testnet; KEEPER / OPERATOR / SPONSOR env addresses default to the broadcaster.
/// Markets: gold (0) and silver (1) everywhere; on mainnet the five FX majors (2…6, `FxListing`) and the FX calendar
/// are configured at construction (S8.23), before admin moves to the Safe. Testnet lists FX through the timelocked
/// `AddMarkets.s.sol`, so every testnet init code here stays byte-identical to the recorded 10143 deployment.
contract Deploy is DeployBase, Seeder {
    struct Stack {
        AccessManager am;
        address ausd;
        address usdc;
        address xau;
        address xag;
        MarketCalendar calendar;
        SessionOracle oracle;
        SenryoCore core;
        LpVault vault;
        StarterDrip drip;
        InboxFactory factory;
        IntentRouter router;
        address swapper;
        /// @dev Mainnet only; empty on testnet.
        FxListing.Market[] fx;
    }

    /// @dev Gold + silver; FX ids start right after them.
    uint256 internal constant METAL_MARKETS = 2;
    uint256 internal constant METALS_AND_FX_CALENDARS = 2;

    error MainnetNotApproved();
    error FeedMismatch(address feed);
    error MarketIdOrder(uint8 marketId);

    function run() external {
        bool mainnet = block.chainid == C.MAINNET_CHAIN_ID;
        if (mainnet && !vm.envOr("SENRYO_MAINNET_OK", false)) revert MainnetNotApproved();
        _load();
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        Stack memory s = _deployAll(deployer, mainnet);
        _wire(s, deployer, mainnet);
        if (!mainnet) _seedTestnet(s.core, s.vault, s.drip, s.ausd, s.usdc, deployer);
        vm.stopBroadcast();
        // A dry run (no --broadcast) must not record addresses that were never deployed.
        if (!vm.isContext(VmSafe.ForgeContext.ScriptDryRun)) _write();
    }

    function _deployAll(address deployer, bool mainnet) internal returns (Stack memory s) {
        s.am = AccessManager(
            _ensure("AccessManager", abi.encodePacked(type(AccessManager).creationCode, abi.encode(deployer)), false)
        );
        address am = address(s.am);
        if (mainnet) {
            (s.ausd, s.usdc, s.xau, s.xag) = (S.MAINNET_AUSD, S.MAINNET_USDC, S.MAINNET_XAU_USD, S.MAINNET_XAG_USD);
            _external("AUSD", s.ausd, true);
            _external("USDC", s.usdc, true);
            _external("XAU_USD", s.xau, true);
            _external("XAG_USD", s.xag, true);
            FxListing.assertExposureWithinShare();
            s.fx = FxListing.markets();
            for (uint256 i; i < s.fx.length; ++i) {
                _external(s.fx[i].externalName, s.fx[i].mainnetFeed, true);
                _checkFeed(s.fx[i].mainnetFeed, s.fx[i].description, S.FX_FEED_DECIMALS);
            }
        } else {
            _assertTestnet();
            s.ausd = _ensure("MockAUSD", abi.encodePacked(type(MockAUSD).creationCode, abi.encode(am)), true);
            s.usdc = _ensure("MockUSDC", abi.encodePacked(type(MockUSDC).creationCode, abi.encode(am)), true);
            s.xau = _mirror("MirrorXAU", am, S.XAU_DESCRIPTION, S.XAU_MIRROR_SEED_ANSWER);
            s.xag = _mirror("MirrorXAG", am, S.XAG_DESCRIPTION, S.XAG_MIRROR_SEED_ANSWER);
        }
        _checkFeed(s.xau, S.XAU_DESCRIPTION, S.FEED_DECIMALS);
        _checkFeed(s.xag, S.XAG_DESCRIPTION, S.FEED_DECIMALS);

        s.calendar = MarketCalendar(_ensure("MarketCalendar", _calendarInitCode(am, mainnet), false));
        s.oracle = SessionOracle(
            _ensure(
                "SessionOracle",
                abi.encodePacked(type(SessionOracle).creationCode, abi.encode(am, s.calendar, _feedInits(s))),
                true
            )
        );
        s.core = SenryoCore(_ensure("SenryoCore", _coreInitCode(s, mainnet), true));
        s.vault = LpVault(
            _ensure(
                "LpVault",
                abi.encodePacked(type(LpVault).creationCode, abi.encode(am, s.ausd, s.core, S.LP_TVL_CAP_USD6)),
                true
            )
        );
        s.drip = StarterDrip(
            payable(_ensure(
                    "StarterDrip",
                    abi.encodePacked(type(StarterDrip).creationCode, abi.encode(am, s.core, _dripConfig(s, mainnet))),
                    true
                ))
        );
        s.factory = InboxFactory(
            _ensure(
                "InboxFactory",
                abi.encodePacked(type(InboxFactory).creationCode, abi.encode(s.core, s.ausd, s.usdc)),
                true
            )
        );
        s.router = IntentRouter(
            _ensure("IntentRouter", abi.encodePacked(type(IntentRouter).creationCode, abi.encode(s.core)), true)
        );
        // Uniswap v4 exists only on mainnet for our pair (D-093); the pool key was read onchain in S3 (D-122).
        if (mainnet) {
            s.swapper = _ensure(
                "CollateralSwapper",
                abi.encodePacked(
                    type(CollateralSwapper).creationCode,
                    abi.encode(am, s.core, IUniversalRouter(S.UNIVERSAL_ROUTER), IPermit2(S.PERMIT2), S.stablePoolKey())
                ),
                false
            );
        }
    }

    function _wire(Stack memory s, address deployer, bool mainnet) internal {
        if (s.core.inboxFactory() != address(s.factory)) s.core.setInboxFactory(address(s.factory));
        if (!s.core.hasDepositSource(address(s.drip))) s.core.setDepositSource(address(s.drip), DepositSource.VOUCHER);
        // Before RoleWiring moves `setSwapper` to the timelocked PARAM_ADMIN role (D-180): first run only.
        if (s.swapper != address(0) && s.core.swapper() != s.swapper) s.core.setSwapper(s.swapper);
        RoleWiring.Targets memory t;
        t.core = address(s.core);
        t.oracle = address(s.oracle);
        t.calendar = address(s.calendar);
        t.vault = address(s.vault);
        t.drip = address(s.drip);
        t.swapper = s.swapper;
        if (!mainnet) {
            t.mirrors = new address[](2);
            t.mirrors[0] = s.xau;
            t.mirrors[1] = s.xag;
            t.mocks = new address[](2);
            t.mocks[0] = s.ausd;
            t.mocks[1] = s.usdc;
        }
        RoleWiring.wire(s.am, t);
        RoleWiring.grant(s.am, C.POOL_ROLE, address(s.vault));
        RoleWiring.grant(s.am, C.ROUTER_ROLE, address(s.router));
        RoleWiring.grant(s.am, C.GUARDIAN_ROLE, deployer);
        RoleWiring.grant(s.am, C.PARAM_ADMIN_ROLE, deployer);
        RoleWiring.grant(s.am, C.CARD_OPERATOR_ROLE, vm.envOr("OPERATOR_ADDRESS", deployer));
        RoleWiring.grant(s.am, C.RELAYER_ROLE, vm.envOr("SPONSOR_ADDRESS", deployer));
        if (!mainnet) {
            RoleWiring.grant(s.am, C.MIRROR_ROLE, vm.envOr("KEEPER_ADDRESS", deployer));
            RoleWiring.grant(s.am, C.MINTER_ROLE, address(s.drip));
            RoleWiring.grant(s.am, C.MINTER_ROLE, deployer);
        }
    }

    // ---------------------------------------------------------------- init codes

    /// @dev CME metals everywhere; the FX 24/5 calendar joins at construction on mainnet only.
    function _calendarInitCode(address am, bool mainnet) internal pure returns (bytes memory) {
        uint256 count = mainnet ? METALS_AND_FX_CALENDARS : 1;
        uint8[] memory ids = new uint8[](count);
        uint256[CALENDAR_WORD_COUNT][] memory weekBits = new uint256[CALENDAR_WORD_COUNT][](count);
        ids[0] = S.CME_METALS_CALENDAR;
        weekBits[0] = S.cmeMetalsWeek();
        if (mainnet) {
            ids[1] = S.FX_CALENDAR;
            weekBits[1] = S.fxWeek();
        }
        return abi.encodePacked(type(MarketCalendar).creationCode, abi.encode(am, ids, weekBits));
    }

    function _coreInitCode(Stack memory s, bool mainnet) internal pure returns (bytes memory) {
        MarketParams[] memory markets = new MarketParams[](METAL_MARKETS + s.fx.length);
        markets[S.GOLD_MARKET] = S.goldParams();
        markets[S.SILVER_MARKET] = S.goldParams();
        for (uint256 i; i < s.fx.length; ++i) {
            // SenryoCore assigns ids in array order; SessionOracle takes them from FeedInit — they must agree.
            if (s.fx[i].marketId != METAL_MARKETS + i) revert MarketIdOrder(s.fx[i].marketId);
            markets[s.fx[i].marketId] = s.fx[i].params;
        }
        address ausdFeed = mainnet ? S.MAINNET_AUSD_USD : address(0);
        address usdcFeed = mainnet ? S.MAINNET_USDC_USD : address(0);
        return abi.encodePacked(
            type(SenryoCore).creationCode,
            abi.encode(
                s.am,
                s.ausd,
                s.usdc,
                IPriceSource(address(s.oracle)),
                markets,
                S.collateral(ausdFeed, S.AUSD_HAIRCUT_BPS),
                S.collateral(usdcFeed, S.USDC_HAIRCUT_BPS)
            )
        );
    }

    function _feedInits(Stack memory s) internal pure returns (SessionOracle.FeedInit[] memory inits) {
        inits = new SessionOracle.FeedInit[](METAL_MARKETS + s.fx.length);
        inits[0] = _feedInit(S.GOLD_MARKET, s.xau, S.XAU_DESCRIPTION);
        inits[1] = _feedInit(S.SILVER_MARKET, s.xag, S.XAG_DESCRIPTION);
        for (uint256 i; i < s.fx.length; ++i) {
            inits[METAL_MARKETS + i] = FxListing.feedInit(s.fx[i], s.fx[i].mainnetFeed, S.FX_HEARTBEAT);
        }
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

    function _dripConfig(Stack memory s, bool mainnet) internal pure returns (StarterDrip.Config memory) {
        return StarterDrip.Config({
            dripWei: mainnet ? S.MAINNET_DRIP_WEI : S.TESTNET_DRIP_WEI,
            dailyBudgetWei: mainnet ? S.MAINNET_DAILY_BUDGET_WEI : S.TESTNET_DAILY_BUDGET_WEI,
            topUpCapWei: S.TOPUP_CAP_WEI,
            practiceToken: mainnet ? address(0) : s.ausd,
            practiceAmount: mainnet ? 0 : S.PRACTICE_AMOUNT_USD6,
            voucherToken: s.ausd,
            voucherAmount: S.VOUCHER_AMOUNT_USD6,
            maxVouchers: S.MAX_VOUCHERS
        });
    }

    function _mirror(string memory name, address am, string memory desc, int256 seed) internal returns (address) {
        _assertTestnet();
        return _ensure(
            name,
            abi.encodePacked(type(MirrorAggregator).creationCode, abi.encode(am, S.FEED_DECIMALS, desc, seed)),
            true
        );
    }

    function _checkFeed(address feed, string memory desc, uint8 decimals) internal view {
        AggregatorV3Interface f = AggregatorV3Interface(feed);
        if (keccak256(bytes(f.description())) != keccak256(bytes(desc)) || f.decimals() != decimals) {
            revert FeedMismatch(feed);
        }
    }

    function _assertTestnet() internal view {
        if (block.chainid == C.MAINNET_CHAIN_ID) revert TestnetOnlyOnMainnet();
    }

    error TestnetOnlyOnMainnet();
}
