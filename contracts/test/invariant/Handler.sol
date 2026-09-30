// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {SenryoCore} from "../../src/core/SenryoCore.sol";
import {LpVault} from "../../src/lp/LpVault.sol";
import {SessionOracle} from "../../src/oracle/SessionOracle.sol";
import {Constants as C} from "../../src/libraries/Constants.sol";
import {Account as CoreAccount, Hold, HoldState} from "../../src/libraries/Types.sol";
import {MockFeed, TestToken} from "../utils/Mocks.sol";
import {HandlerBase} from "./HandlerBase.sol";
import {TradeHandler} from "./TradeHandler.sol";

/// @notice The invariant handler: trade actions plus the card (allowance, envelope, holds, capture, refund, repay).
contract Handler is TradeHandler {
    uint256 internal constant MAX_LIMIT = 150e6;
    uint256 internal constant MAX_HOLD = 60e6;
    uint256 internal constant CAPTURE_MODES = 5;
    uint256 internal constant TOL_OVER_BPS = 12_000;
    uint256 internal constant TOO_MUCH_BPS = 13_000;
    uint256 internal constant HALF_BPS = 5000;
    uint256 internal constant MODE_HALF = 0;
    uint256 internal constant MODE_EXACT = 1;
    uint256 internal constant MODE_OVER = 2;
    uint256 internal constant MODE_TOO_MUCH = 3;

    constructor(
        SenryoCore core_,
        SessionOracle oracle_,
        LpVault vault_,
        TestToken ausd_,
        TestToken usdc_,
        MockFeed xau,
        MockFeed xag,
        address operator_,
        address lp_
    ) HandlerBase(core_, oracle_, vault_, ausd_, usdc_, xau, xag, operator_, lp_) {}

    function setAllowance(uint256 seed, uint256 limit, uint256 life) external {
        address user = _actor(seed);
        uint128 dailyLimit = uint128(bound(limit, 0, MAX_LIMIT));
        uint64 expiry = _now() + uint64(bound(life, 1, 2 days));
        uint256[] memory before = _snapshot();
        _signAllowance(user, dailyLimit, expiry);
        ++calls["setAllowance"];
        _onlyChanged(before, user, user);
    }

    function setEnvelope(uint256 seed, uint256 amount) external {
        address user = _actor(seed);
        amount = bound(amount, 0, MAX_HOLD);
        vm.prank(user);
        try core.setCardEnvelope(uint128(amount)) {
            ++calls["setEnvelope"];
            _checkI2(user);
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
    }

    function placeHold(uint256 seed, uint256 amount) external {
        address user = _actor(seed);
        amount = bound(amount, 1, MAX_HOLD);
        if (_allowanceLeft(user) == 0) _signAllowance(user, uint128(MAX_LIMIT), _now() + 1 days);
        if (seed % 2 == 0) _fund(user, amount + C.SAFETY_BUFFER_USD6);
        if (seed % 3 != 0) {
            _heal(0);
            _heal(1);
        }
        uint256 leftBefore = _allowanceLeft(user);
        bytes32 token = bytes32(holdIds.length);
        uint256[] memory before = _snapshot();
        vm.prank(operator);
        try core.placeHold(keccak256("issuer"), token, user, uint128(amount)) returns (bytes32 id) {
            ++calls["placeHold"];
            holdIds.push(id);
            if (amount > leftBefore) ++ghostI7Violations;
            if (!core.hold(id).fromEnvelope) _checkI2(user);
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, user, user);
    }

    function increaseHold(uint256 idx, uint256 delta) external {
        if (holdIds.length == 0) return;
        bytes32 id = holdIds[idx % holdIds.length];
        Hold memory h = core.hold(id);
        delta = bound(delta, 1, MAX_HOLD);
        uint256 leftBefore = _allowanceLeft(h.user);
        uint256[] memory before = _snapshot();
        vm.prank(operator);
        try core.increaseHold(id, uint128(delta)) {
            ++calls["increaseHold"];
            if (delta > leftBefore) ++ghostI7Violations;
            if (!core.hold(id).fromEnvelope) _checkI2(h.user);
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, h.user, h.user);
    }

    function capture(uint256 idx, uint256 mode, bool expire) external {
        if (holdIds.length == 0) return;
        bytes32 id = holdIds[idx % holdIds.length];
        Hold memory h = core.hold(id);
        // Forward only: block timestamps are monotonic (a backwards warp fakes future-dated accepted prices).
        if (expire && vm.getBlockTimestamp() <= h.expiry) vm.warp(uint256(h.expiry) + 1);
        mode = mode % CAPTURE_MODES;
        uint256 amount = mode == MODE_HALF
            ? h.amount * HALF_BPS / C.BPS
            : mode == MODE_EXACT
                ? h.amount
                : mode == MODE_OVER ? h.amount * TOL_OVER_BPS / C.BPS : h.amount * TOO_MUCH_BPS / C.BPS;
        uint256[] memory before = _snapshot();
        vm.prank(operator);
        try core.captureHold(id, uint128(amount)) {
            ++calls["capture"];
            if (++captures[id] > 1) ++ghostDoubleCaptures;
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, h.user, h.user);
    }

    function release(uint256 idx, bool asStranger) external {
        if (holdIds.length == 0) return;
        bytes32 id = holdIds[idx % holdIds.length];
        address user = core.hold(id).user;
        uint256[] memory before = _snapshot();
        if (asStranger) {
            try core.releaseExpiredHold(id) {
                ++calls["releaseExpired"];
            } catch (bytes memory reason) {
                _noPanic(reason);
            }
        } else {
            vm.prank(operator);
            try core.releaseHold(id) {
                ++calls["release"];
            } catch (bytes memory reason) {
                _noPanic(reason);
            }
        }
        _onlyChanged(before, user, user);
    }

    function refund(uint256 seed, uint256 amount) external {
        address user = _actor(seed);
        amount = bound(amount, 1, MAX_HOLD);
        uint256[] memory before = _snapshot();
        vm.prank(operator);
        try core.refund(user, keccak256(abi.encode(calls["refund-id"]++)), uint128(amount)) {
            ++calls["refund"];
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, user, user);
    }

    function repay(uint256 seed, uint256 amount) external {
        address user = _actor(seed);
        CoreAccount memory a = core.account(user);
        if (a.cardDebt == 0) return;
        amount = bound(amount, 1, a.cardDebt);
        uint256[] memory before = _snapshot();
        vm.prank(user);
        try core.repayCardDebt(amount) {
            ++calls["repay"];
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, user, user);
    }

    /// @dev I3 helper: Σ open holds per user equals Account.holds.
    function holdsConsistent() external view returns (bool) {
        for (uint256 i; i < actors.length; ++i) {
            uint256 sum;
            for (uint256 j; j < holdIds.length; ++j) {
                Hold memory h = core.hold(holdIds[j]);
                if (h.user == actors[i] && h.state == HoldState.OPEN) sum += h.amount;
            }
            if (sum != core.account(actors[i]).holds) return false;
        }
        return true;
    }
}
