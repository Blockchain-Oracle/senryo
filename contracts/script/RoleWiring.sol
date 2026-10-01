// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {AccountLedger} from "../src/core/AccountLedger.sol";
import {AdminModule} from "../src/core/AdminModule.sol";
import {CardModule} from "../src/core/CardModule.sol";
import {CollateralConfig} from "../src/core/CollateralConfig.sol";
import {MarketRegistry} from "../src/core/MarketRegistry.sol";
import {PerpModule} from "../src/core/PerpModule.sol";
import {LpVault} from "../src/lp/LpVault.sol";
import {MarketCalendar} from "../src/oracle/MarketCalendar.sol";
import {SessionOracle} from "../src/oracle/SessionOracle.sol";
import {CollateralSwapper} from "../src/periphery/CollateralSwapper.sol";
import {StarterDrip} from "../src/periphery/StarterDrip.sol";
import {MirrorAggregator} from "../src/testnet/MirrorAggregator.sol";
import {MockStable} from "../src/testnet/MockStable.sol";
import {Constants as C} from "../src/libraries/Constants.sol";

/// @title RoleWiring — the single source of the selector → role map (specs/contracts.md "AccessManager").
/// @notice Unlisted restricted selectors stay ADMIN_ROLE (OZ default). Every call is idempotent, so the ensure-style
/// deploy can re-run it. The caller must hold ADMIN_ROLE on `am`.
library RoleWiring {
    struct Targets {
        address core;
        address oracle;
        address calendar;
        address vault;
        address drip;
        address swapper;
        address[] mirrors;
        address[] mocks;
    }

    function wire(AccessManager am, Targets memory t) internal {
        _set(am, t.core, _coreOperator(), C.CARD_OPERATOR_ROLE);
        _set(am, t.core, _one(AccountLedger.fundPool.selector, AccountLedger.drainPool.selector), C.POOL_ROLE);
        _set(am, t.core, _single(PerpModule.increaseFor.selector), C.ROUTER_ROLE);
        _set(am, t.core, _coreGuardian(), C.GUARDIAN_ROLE);
        _set(am, t.core, _coreParam(), C.PARAM_ADMIN_ROLE);

        _set(am, t.oracle, _one(SessionOracle.halt.selector, SessionOracle.unhalt.selector), C.GUARDIAN_ROLE);
        _set(
            am,
            t.oracle,
            _one(SessionOracle.setFeed.selector, SessionOracle.acceptFeedPrice.selector),
            C.PARAM_ADMIN_ROLE
        );
        _set(am, t.calendar, _single(MarketCalendar.addHoliday.selector), C.GUARDIAN_ROLE);
        _set(
            am,
            t.calendar,
            _one(MarketCalendar.setWeek.selector, MarketCalendar.removeHoliday.selector),
            C.PARAM_ADMIN_ROLE
        );
        _set(am, t.vault, _single(LpVault.setTvlCap.selector), C.PARAM_ADMIN_ROLE);
        if (t.drip != address(0)) _set(am, t.drip, _dripRelayer(), C.RELAYER_ROLE);
        if (t.swapper != address(0)) {
            _set(am, t.swapper, _single(CollateralSwapper.setPoolKey.selector), C.PARAM_ADMIN_ROLE);
        }
        wireMirrors(am, t.mirrors);
        for (uint256 i; i < t.mocks.length; ++i) {
            _set(am, t.mocks[i], _single(MockStable.mint.selector), C.MINTER_ROLE);
        }
        // The guardian may cancel any scheduled PARAM_ADMIN operation.
        if (am.getRoleGuardian(C.PARAM_ADMIN_ROLE) != C.GUARDIAN_ROLE) {
            am.setRoleGuardian(C.PARAM_ADMIN_ROLE, C.GUARDIAN_ROLE);
        }
    }

    /// @notice Map `pushAnswer` of testnet mirrors to MIRROR_ROLE (also AddMarkets.s.sol's new FX mirrors).
    function wireMirrors(AccessManager am, address[] memory mirrors) internal {
        for (uint256 i; i < mirrors.length; ++i) {
            _set(am, mirrors[i], _single(MirrorAggregator.pushAnswer.selector), C.MIRROR_ROLE);
        }
    }

    /// @notice Grant `role` to `account` unless it already holds it (PARAM_ADMIN always with PARAM_DELAY).
    function grant(AccessManager am, uint64 role, address account) internal {
        (bool member,) = am.hasRole(role, account);
        if (member) return;
        uint32 delay = role == C.PARAM_ADMIN_ROLE ? C.PARAM_DELAY : 0;
        am.grantRole(role, account, delay);
    }

    function _set(AccessManager am, address target, bytes4[] memory selectors, uint64 role) private {
        uint256 missing;
        for (uint256 i; i < selectors.length; ++i) {
            if (am.getTargetFunctionRole(target, selectors[i]) != role) ++missing;
        }
        if (missing != 0) am.setTargetFunctionRole(target, selectors, role);
    }

    function _coreOperator() private pure returns (bytes4[] memory s) {
        s = new bytes4[](5);
        s[0] = CardModule.placeHold.selector;
        s[1] = CardModule.increaseHold.selector;
        s[2] = CardModule.captureHold.selector;
        s[3] = CardModule.releaseHold.selector;
        s[4] = CardModule.refund.selector;
    }

    function _coreGuardian() private pure returns (bytes4[] memory s) {
        s = new bytes4[](6);
        s[0] = AdminModule.pause.selector;
        s[1] = AdminModule.unpause.selector;
        s[2] = MarketRegistry.lowerCaps.selector;
        s[3] = MarketRegistry.raiseMargins.selector;
        s[4] = MarketRegistry.disableMarket.selector;
        s[5] = CollateralConfig.raiseHaircut.selector;
    }

    function _coreParam() private pure returns (bytes4[] memory s) {
        s = new bytes4[](4);
        s[0] = MarketRegistry.setMarketParams.selector;
        s[1] = MarketRegistry.addMarket.selector;
        s[2] = CollateralConfig.setCollateral.selector;
        s[3] = AdminModule.setSwapper.selector;
    }

    function _dripRelayer() private pure returns (bytes4[] memory s) {
        s = new bytes4[](3);
        s[0] = StarterDrip.claimFor.selector;
        s[1] = StarterDrip.redeemVoucher.selector;
        s[2] = StarterDrip.topUp.selector;
    }

    function _one(bytes4 a, bytes4 b) private pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = a;
        s[1] = b;
    }

    function _single(bytes4 a) private pure returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = a;
    }
}
