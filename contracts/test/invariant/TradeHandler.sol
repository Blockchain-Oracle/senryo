// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Constants as C} from "../../src/libraries/Constants.sol";
import {Account as CoreAccount, Position, TriggerOrder} from "../../src/libraries/Types.sol";
import {HandlerBase} from "./HandlerBase.sol";

/// @notice Ledger, trading, triggers, liquidation, LP, oracle and time actions.
abstract contract TradeHandler is HandlerBase {
    uint256 internal constant MAX_DEPOSIT = 120e6;
    uint256 internal constant MAX_NOTIONAL = 50e6;
    uint256 internal constant MAX_MOVE_BPS = 190;
    uint256 internal constant MAX_ADVERSE_BPS = 1200;
    uint256 internal constant MIN_JUMP_BPS = 250;
    uint256 internal constant MAX_JUMP_BPS = 700;
    uint256 internal constant MAX_WARP = 2 hours;
    uint256 internal constant MAX_LP = 300e6;
    uint256 internal constant PCT = 100;

    // ---------------------------------------------------------------- ledger

    function deposit(uint256 seed, uint256 tokenSeed, uint256 amount) external {
        ++calls["deposit"];
        address user = _actor(seed);
        amount = bound(amount, 1, MAX_DEPOSIT);
        _token(tokenSeed).mint(user, amount);
        uint256[] memory before = _snapshot();
        vm.startPrank(user);
        _token(tokenSeed).approve(address(core), amount);
        core.deposit(address(_token(tokenSeed)), amount);
        vm.stopPrank();
        _onlyChanged(before, user, user);
    }

    function withdraw(uint256 seed, uint256 tokenSeed, uint256 amount) external {
        address user = _actor(seed);
        CoreAccount memory a = core.account(user);
        uint256 bal = tokenSeed % 2 == 0 ? a.ausd : a.usdc;
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        uint256[] memory before = _snapshot();
        vm.prank(user);
        try core.withdraw(address(_token(tokenSeed)), amount, user) {
            ++calls["withdraw"];
            _checkI2(user);
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, user, user);
    }

    function swapCollateral(uint256 seed, uint256 tokenSeed, uint256 amount) external {
        address user = _actor(seed);
        CoreAccount memory a = core.account(user);
        uint256 bal = tokenSeed % 2 == 0 ? a.ausd : a.usdc;
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        uint256[] memory before = _snapshot();
        vm.prank(user);
        try core.swapCollateral(address(_token(tokenSeed)), amount, amount) {
            ++calls["swap"];
            _checkI2(user);
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, user, user);
    }

    // ---------------------------------------------------------------- trading

    function increase(uint256 seed, uint256 marketSeed, bool isLong, uint256 notional) external {
        address user = _actor(seed);
        // Fund with ~12-60 % margin so later moves can push some accounts under maintenance.
        _fund(user, C.MIN_POSITION_NOTIONAL_USD6 + (notional % MAX_NOTIONAL) * (seed % 5 + 1) / 8);
        uint8 m = uint8(marketSeed % feeds.length);
        notional = bound(notional, C.MIN_POSITION_NOTIONAL_USD6, MAX_NOTIONAL);
        _heal(m);
        uint256[] memory before = _snapshot();
        vm.prank(user);
        try core.increase(m, isLong, notional, isLong ? type(uint256).max : 0, _now()) {
            ++calls["increase"];
            _checkI2(user);
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, user, user);
    }

    function decrease(uint256 seed, uint256 marketSeed, uint256 pct, bool waitHold) external {
        (address user, uint256 mm) = _findPosition(seed, marketSeed);
        uint8 m = uint8(mm);
        Position memory p = core.position(user, m);
        if (p.size == 0) return;
        if (waitHold) vm.roll(vm.getBlockNumber() + C.MIN_HOLD_BLOCKS);
        uint256 size = p.size * bound(pct, 1, PCT) / PCT;
        if (size == 0) size = p.size;
        uint256[] memory before = _snapshot();
        vm.prank(user);
        try core.decrease(m, size, p.isLong ? 0 : type(uint256).max, _now()) {
            ++calls["decrease"];
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, user, user);
    }

    function trigger(uint256 seed, uint256 marketSeed, bool takeProfit, uint256 offsetBps) external {
        (address user, uint256 mm) = _findPosition(seed, marketSeed);
        uint8 m = uint8(mm);
        Position memory p = core.position(user, m);
        if (p.size == 0) return;
        _heal(m);
        uint256 price = oracle.peek(m).price18;
        offsetBps = bound(offsetBps, 0, MAX_MOVE_BPS);
        bool upward = p.isLong == takeProfit;
        uint256 trig = upward ? price - price * offsetBps / C.BPS : price + price * offsetBps / C.BPS;
        TriggerOrder memory o = TriggerOrder({
            user: user,
            marketId: m,
            isLong: p.isLong,
            takeProfit: takeProfit,
            triggerPrice18: uint128(trig),
            sizeDelta: p.size,
            acceptablePrice18: p.isLong ? 0 : type(uint128).max,
            expiry: _now() + 1 hours,
            salt: uint64(calls["trigger-placed"]++)
        });
        bytes32 id = core.triggerId(o);
        core.placeTrigger(o, _sign(user, id));
        vm.roll(vm.getBlockNumber() + C.MIN_HOLD_BLOCKS);
        uint256[] memory before = _snapshot();
        try core.executeTrigger(id) {
            ++calls["trigger"];
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, user, user);
    }

    /// @dev Optionally move the price against one of the user's positions first (confirmed through the circuit),
    /// so the waterfall actually runs.
    function liquidate(uint256 seed, uint256 marketSeed, uint256 adverseBps) external {
        (address user, uint256 m) = _findPosition(seed, marketSeed);
        Position memory p = core.position(user, uint8(m));
        if (p.size != 0) {
            (, int256 answer,,,) = feeds[m].latestRoundData();
            int256 delta = answer * int256(bound(adverseBps, 0, MAX_ADVERSE_BPS)) / int256(C.BPS);
            _pushPrice(m, p.isLong ? answer - delta : answer + delta);
        }
        _heal(0);
        _heal(1);
        uint256[] memory before = _snapshot();
        vm.prank(liquidator);
        try core.liquidate(user) {
            ++calls["liquidate"];
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, user, liquidator);
    }

    /// @dev First (actor, market) with an open position, starting from the seeds; falls back to the seeds.
    function _findPosition(uint256 seed, uint256 marketSeed) internal view returns (address, uint256) {
        for (uint256 i; i < actors.length * feeds.length; ++i) {
            address user = _actor(seed + i / feeds.length);
            uint256 m = (marketSeed + i) % feeds.length;
            if (core.position(user, uint8(m)).size != 0) return (user, m);
        }
        return (_actor(seed), marketSeed % feeds.length);
    }

    // ---------------------------------------------------------------- LP

    function lpDeposit(uint256 amount) external {
        amount = bound(amount, 1e6, MAX_LP);
        ausd.mint(lp, amount);
        uint256[] memory before = _snapshot();
        vm.startPrank(lp);
        ausd.approve(address(vault), amount);
        try vault.deposit(amount, lp) {
            ++calls["lpDeposit"];
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        vm.stopPrank();
        _onlyChanged(before, address(0), address(0));
    }

    function lpRequestRedeem(uint256 pct) external {
        uint256 shares = vault.balanceOf(lp) * bound(pct, 1, PCT) / PCT;
        if (shares == 0) return;
        vm.prank(lp);
        redeemIds.push(vault.requestRedeem(shares, lp));
    }

    function lpClaim(uint256 idx, bool wait) external {
        if (redeemIds.length == 0) return;
        uint256 id = redeemIds[idx % redeemIds.length];
        if (wait) {
            vm.warp(vm.getBlockTimestamp() + C.LP_REDEEM_DELAY);
            _heal(0);
            _heal(1);
        }
        uint256[] memory before = _snapshot();
        try vault.claimRedeem(id) {
            ++calls["lpClaim"];
        } catch (bytes memory reason) {
            _noPanic(reason);
        }
        _onlyChanged(before, address(0), address(0));
    }

    // ---------------------------------------------------------------- oracle / time

    function oracleMove(uint256 marketSeed, uint256 bps, bool up) external {
        uint256 m = marketSeed % feeds.length;
        (, int256 answer,,,) = feeds[m].latestRoundData();
        int256 delta = answer * int256(bound(bps, 0, MAX_MOVE_BPS)) / int256(C.BPS);
        _pushPrice(m, up ? answer + delta : answer - delta);
        oracle.observe(uint8(m));
        ++calls["oracleMove"];
    }

    function oracleJump(uint256 marketSeed, uint256 bps, bool up) external {
        uint256 m = marketSeed % feeds.length;
        (, int256 answer,,,) = feeds[m].latestRoundData();
        int256 delta = answer * int256(bound(bps, MIN_JUMP_BPS, MAX_JUMP_BPS)) / int256(C.BPS);
        _pushPrice(m, up ? answer + delta : answer - delta);
        oracle.observe(uint8(m));
        ++calls["oracleJump"];
    }

    function warp(uint256 secs, uint256 refreshSeed) external {
        secs = bound(secs, 1, MAX_WARP);
        bool refresh = refreshSeed % 4 != 0;
        vm.warp(vm.getBlockTimestamp() + secs);
        vm.roll(vm.getBlockNumber() + secs);
        if (refresh) {
            for (uint256 m; m < feeds.length; ++m) {
                (, int256 answer,,,) = feeds[m].latestRoundData();
                _pushPrice(m, answer);
                core.poke(uint8(m));
            }
        }
        ++calls["warp"];
    }
}
