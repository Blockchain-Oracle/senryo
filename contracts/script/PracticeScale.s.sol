// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {console} from "forge-std/console.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {MarketRegistry} from "../src/core/MarketRegistry.sol";
import {SenryoCore} from "../src/core/SenryoCore.sol";
import {LpVault} from "../src/lp/LpVault.sol";
import {MockStable} from "../src/testnet/MockStable.sol";
import {Constants as C} from "../src/libraries/Constants.sol";
import {MarketParams} from "../src/libraries/Types.sol";
import {DeployBase} from "./DeployBase.sol";
import {FxListing} from "./FxListing.sol";
import {SeedConstants as S} from "./SeedConstants.sol";

/// @title PracticeScale — size Practice (10143) for real use: the LP pool, its TVL cap and every market's absolute
/// OI cap grow by the same factor, PRACTICE_SEED / LP_SEED (P$1,000,000 / P$250).
/// @notice The seed was sized for a P$250 mainnet pool, so on Practice a P$55 order already filled Gold's trade cap
/// ("Market full"). Scaling every absolute cap and the pool together keeps every ratio D-187 asserts: the abs caps
/// still equal the pool-bps caps at the (new) seed, and Σ FX abs caps stay FX_EXPOSURE_SHARE_BPS of it. Mock money
/// only — mainnet keeps the seed. `setMarketParams` and `setTvlCap` are PARAM_ADMIN with a 6 h delay, so this takes
/// two runs of the same command:
///   forge script script/PracticeScale.s.sol --rpc-url monad_testnet --account senryo-deployer --sender <addr>
///   --broadcast --slow --gas-estimate-multiplier 110
/// Run 1 schedules the eight ops (TVL cap, markets 0…6). Run 2 (≥ 6 h later) executes them, then mints mock AUSD to
/// the deployer and deposits it so the pool reaches PRACTICE_SEED. Each step is skipped once its effect is onchain.
contract PracticeScale is DeployBase {
    error TestnetOnly();
    error NotParamAdmin(address caller, address target, bytes4 selector);
    error UnknownMarket(uint8 id);

    /// @dev The Practice pool the caps are sized for, and the factor every absolute cap grows by.
    uint256 internal constant PRACTICE_SEED_USD6 = 1_000_000e6;
    uint256 internal constant SCALE = PRACTICE_SEED_USD6 / S.LP_SEED_USD6;
    uint256 internal constant PRACTICE_TVL_CAP_USD6 = S.LP_TVL_CAP_USD6 * SCALE;
    /// @dev Gold and silver come before the FX majors.
    uint8 internal constant METAL_MARKETS = 2;

    struct Ctx {
        AccessManager am;
        SenryoCore core;
        LpVault vault;
        MockStable ausd;
        address caller;
        uint256 pending;
    }

    function run() external {
        if (block.chainid != C.TESTNET_CHAIN_ID) revert TestnetOnly();
        _load();
        FxListing.assertExposureWithinShare();
        Ctx memory c;
        c.am = AccessManager(_recorded("AccessManager"));
        c.core = SenryoCore(_recorded("SenryoCore"));
        c.vault = LpVault(_recorded("LpVault"));
        c.ausd = MockStable(_recorded("MockAUSD"));

        vm.startBroadcast();
        (, c.caller,) = vm.readCallers();
        bytes memory cap = abi.encodeCall(LpVault.setTvlCap, (PRACTICE_TVL_CAP_USD6));
        _op(c, address(c.vault), cap, c.vault.tvlCap() == PRACTICE_TVL_CAP_USD6);
        uint8 count = c.core.marketCount();
        for (uint8 id; id < count; ++id) {
            MarketParams memory p = c.core.marketParams(id);
            p.oiCapAbsUsd6 = uint128(uint256(_seedAbsCap(id)) * SCALE);
            bool done = c.core.marketParams(id).oiCapAbsUsd6 == p.oiCapAbsUsd6;
            _op(c, address(c.core), abi.encodeCall(MarketRegistry.setMarketParams, (id, p)), done);
        }
        if (c.pending == 0) _fillPool(c);
        vm.stopBroadcast();

        if (c.pending == 0) console.log("Practice scaled; pool (usd6):", c.vault.totalAssets());
        else console.log("Practice scale pending; ops still waiting:", c.pending);
    }

    /// @dev The seed's absolute OI cap for a market: the metals' shared one, or the FX major's own (FxListing).
    function _seedAbsCap(uint8 id) internal pure returns (uint128) {
        if (id < METAL_MARKETS) return S.OI_CAP_ABS_USD6;
        FxListing.Market[] memory fx = FxListing.markets();
        for (uint256 i; i < fx.length; ++i) {
            if (fx[i].marketId == id) return fx[i].params.oiCapAbsUsd6;
        }
        revert UnknownMarket(id);
    }

    /// @dev Tops the pool up to PRACTICE_SEED with freshly minted mock AUSD, deposited for the deployer.
    function _fillPool(Ctx memory c) internal {
        uint256 assets = c.vault.totalAssets();
        if (assets >= PRACTICE_SEED_USD6) return;
        uint256 topUp = PRACTICE_SEED_USD6 - assets;
        c.ausd.mint(c.caller, topUp);
        c.ausd.approve(address(c.vault), topUp);
        c.vault.deposit(topUp, c.caller);
        console.log("deposited (usd6):", topUp);
    }

    /// @dev done → skip · immediate → call · unscheduled → schedule · due → execute · otherwise report when.
    function _op(Ctx memory c, address target, bytes memory data, bool done) internal {
        if (done) return;
        bytes4 selector = bytes4(data);
        (bool immediate, uint32 delay) = c.am.canCall(c.caller, target, selector);
        if (immediate) {
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
        } else if (at <= block.timestamp) {
            c.am.execute(target, data);
            console.log("executed scheduled op on", target);
        } else {
            console.log("op waiting; executable after (unix)", at);
            ++c.pending;
        }
    }

    function _bubble(bytes memory ret) private pure {
        assembly ("memory-safe") {
            revert(add(ret, 0x20), mload(ret))
        }
    }
}
