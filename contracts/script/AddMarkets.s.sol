// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {console} from "forge-std/console.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {MarketRegistry} from "../src/core/MarketRegistry.sol";
import {SenryoCore} from "../src/core/SenryoCore.sol";
import {MarketCalendar} from "../src/oracle/MarketCalendar.sol";
import {SessionOracle} from "../src/oracle/SessionOracle.sol";
import {AggregatorV3Interface} from "../src/oracle/interfaces/AggregatorV3Interface.sol";
import {MirrorAggregator} from "../src/testnet/MirrorAggregator.sol";
import {Constants as C} from "../src/libraries/Constants.sol";
import {MarketParams} from "../src/libraries/Types.sol";
import {DeployBase} from "./DeployBase.sol";
import {FxListing} from "./FxListing.sol";
import {RoleWiring} from "./RoleWiring.sol";
import {SeedConstants as S} from "./SeedConstants.sol";

/// @title AddMarkets — list the FX majors on an existing testnet deployment (S8.23, D-188).
/// @notice `addMarket`, `setFeed` and `setWeek` are PARAM_ADMIN with a PARAM_DELAY (6 h) execution delay, so listing
/// takes two runs of the same command:
///   forge script script/AddMarkets.s.sol --rpc-url monad_testnet --account senryo-deployer --sender <addr>
///   --broadcast --slow --gas-estimate-multiplier 110
/// Run 1 deploys MirrorEUR…MirrorCAD (ensure-style, 18 decimals like the mainnet feeds), maps their `pushAnswer` to
/// MIRROR_ROLE (ADMIN, immediate) and schedules every PARAM_ADMIN op on the AccessManager. Run 2 (≥ 6 h later)
/// executes the due ops in dependency order: FX calendar → SessionOracle feeds → SenryoCore markets (a core market
/// without its oracle feed would make `poolValue` revert). Each op is skipped once its effect is onchain; anything
/// onchain that differs from these constants reverts as drift. Start the keeper's FX mirror relay after run 1, so the
/// feeds are fresh when run 2 lists them. Mainnet lists FX at construction in `Deploy.s.sol` instead.
contract AddMarkets is DeployBase {
    error MainnetListsAtConstruction();
    error NotParamAdmin(address caller, address target, bytes4 selector);
    error ListingDrift(uint8 id);

    struct Ctx {
        AccessManager am;
        MarketCalendar calendar;
        SessionOracle oracle;
        SenryoCore core;
        address caller;
        uint256 pending;
    }

    function run() external {
        if (block.chainid == C.MAINNET_CHAIN_ID) revert MainnetListsAtConstruction();
        _load();
        _keepRecorded();
        FxListing.assertExposureWithinShare();
        FxListing.Market[] memory fx = FxListing.markets();
        Ctx memory c;
        c.am = AccessManager(_recorded("AccessManager"));
        c.calendar = MarketCalendar(_recorded("MarketCalendar"));
        c.oracle = SessionOracle(_recorded("SessionOracle"));
        c.core = SenryoCore(_recorded("SenryoCore"));

        vm.startBroadcast();
        (, c.caller,) = vm.readCallers();
        address[] memory mirrors = new address[](fx.length);
        for (uint256 i; i < fx.length; ++i) {
            mirrors[i] = _ensure(
                fx[i].mirrorName,
                abi.encodePacked(
                    type(MirrorAggregator).creationCode,
                    abi.encode(c.am, S.FX_FEED_DECIMALS, fx[i].description, fx[i].mirrorSeedAnswer)
                ),
                true
            );
        }
        RoleWiring.wireMirrors(c.am, mirrors);

        bytes memory week = abi.encodeCall(MarketCalendar.setWeek, (S.FX_CALENDAR, S.fxWeek()));
        _op(c, address(c.calendar), week, _weekSet(c), true);
        for (uint256 i; i < fx.length; ++i) {
            SessionOracle.FeedInit memory init = FxListing.feedInit(fx[i], mirrors[i], S.FX_MIRROR_HEARTBEAT);
            // A feed on the FX calendar needs that calendar first (`peek` reverts on an unknown calendar).
            _op(c, address(c.oracle), abi.encodeCall(SessionOracle.setFeed, (init)), _feedSet(c, init), _weekSet(c));
        }
        for (uint256 i; i < fx.length; ++i) {
            // Scheduled with everything else in run 1; executed only once its oracle feed exists (a core market
            // without one makes `poolValue` revert) and in id order (SenryoCore assigns ids sequentially).
            bool ready = _feedReady(c, fx[i].marketId, mirrors[i]) && c.core.marketCount() == fx[i].marketId;
            bytes memory add = abi.encodeCall(MarketRegistry.addMarket, (fx[i].params));
            _op(c, address(c.core), add, _marketListed(c, fx[i]), ready);
        }
        vm.stopBroadcast();

        if (c.pending == 0) console.log("FX listing complete");
        else console.log("FX listing pending; ops still waiting:", c.pending);
        if (!vm.isContext(VmSafe.ForgeContext.ScriptDryRun)) _write();
    }

    /// @dev done → skip · unscheduled → schedule · due and `ready` → execute · otherwise report when it can run.
    function _op(Ctx memory c, address target, bytes memory data, bool done, bool ready) internal {
        if (done) return;
        bytes4 selector = bytes4(data);
        (bool immediate, uint32 delay) = c.am.canCall(c.caller, target, selector);
        if (immediate) {
            if (!ready) {
                ++c.pending;
                return;
            }
            (bool ok, bytes memory ret) = target.call(data);
            if (!ok) _bubble(ret);
            return;
        }
        if (delay == 0) revert NotParamAdmin(c.caller, target, selector);
        uint48 at = c.am.getSchedule(c.am.hashOperation(c.caller, target, data));
        if (at == 0) {
            (, uint32 nonce) = c.am.schedule(target, data, 0);
            console.log("scheduled op nonce", nonce, "executable after (unix)", block.timestamp + delay);
            ++c.pending;
        } else if (at <= block.timestamp && ready) {
            c.am.execute(target, data);
            console.log("executed scheduled op on", target);
        } else {
            console.log("op waiting; executable after (unix)", at);
            ++c.pending;
        }
    }

    function _weekSet(Ctx memory c) internal view returns (bool) {
        if (!c.calendar.configured(S.FX_CALENDAR)) return false;
        if (keccak256(abi.encode(c.calendar.week(S.FX_CALENDAR))) != keccak256(abi.encode(S.fxWeek()))) {
            revert ListingDrift(S.FX_CALENDAR);
        }
        return true;
    }

    function _feedSet(Ctx memory c, SessionOracle.FeedInit memory init) internal view returns (bool) {
        (AggregatorV3Interface feed, uint8 calendarId,, uint32 heartbeat, uint16 clamp, uint16 reopenClamp) =
            c.oracle.feeds(init.marketId);
        if (address(feed) == address(0)) return false;
        if (
            address(feed) != address(init.feed) || calendarId != init.calendarId || heartbeat != init.heartbeat
                || clamp != init.clampBps || reopenClamp != init.reopenClampBps
        ) revert ListingDrift(init.marketId);
        return true;
    }

    function _feedReady(Ctx memory c, uint8 marketId, address mirror) internal view returns (bool) {
        (AggregatorV3Interface feed,,,,,) = c.oracle.feeds(marketId);
        return address(feed) == mirror;
    }

    function _marketListed(Ctx memory c, FxListing.Market memory m) internal view returns (bool) {
        if (c.core.marketCount() <= m.marketId) return false;
        MarketParams memory onchain = c.core.marketParams(m.marketId);
        if (keccak256(abi.encode(onchain)) != keccak256(abi.encode(m.params))) revert ListingDrift(m.marketId);
        return true;
    }

    function _bubble(bytes memory ret) private pure {
        assembly ("memory-safe") {
            revert(add(ret, 0x20), mload(ret))
        }
    }
}
