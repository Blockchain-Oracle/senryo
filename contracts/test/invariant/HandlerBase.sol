// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {SenryoCore} from "../../src/core/SenryoCore.sol";
import {LpVault} from "../../src/lp/LpVault.sol";
import {SessionOracle} from "../../src/oracle/SessionOracle.sol";
import {Account as CoreAccount, Allowance, MarketStatus, Risk} from "../../src/libraries/Types.sol";
import {Constants as C} from "../../src/libraries/Constants.sol";
import {MockFeed, TestToken} from "../utils/Mocks.sol";

/// @notice Actors, ghost variables and snapshot helpers shared by the invariant handler.
abstract contract HandlerBase is Test {
    uint256 internal constant ACTORS = 3;
    uint256 internal constant FEED_SCALE = 1e10;
    bytes4 internal constant PANIC_SELECTOR = 0x4e487b71;

    SenryoCore public core;
    SessionOracle public oracle;
    LpVault public vault;
    TestToken public ausd;
    TestToken public usdc;
    MockFeed[2] internal feeds;
    address public operator;
    address public liquidator;
    address public lp;

    address[] public actors;
    mapping(address => uint256) internal keyOf;

    // ghosts
    uint256 public ghostI2Violations;
    uint256 public ghostI5Violations;
    uint256 public ghostI7Violations;
    uint256 public ghostDoubleCaptures;
    /// @dev Reverts are expected (fail_on_revert = false) but a Panic (overflow, div-by-zero…) is always a bug —
    /// D-182's aggregate underflow hid behind `catch {}` until S8.5.
    uint256 public ghostPanics;
    bytes4 public lastPanicAction;
    bytes32[] public holdIds;
    mapping(bytes32 => uint256) public captures;
    mapping(uint256 => bool) public postedPrice18;
    uint256[] public redeemIds;
    mapping(bytes32 => uint256) public calls;

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
    ) {
        core = core_;
        oracle = oracle_;
        vault = vault_;
        ausd = ausd_;
        usdc = usdc_;
        feeds[0] = xau;
        feeds[1] = xag;
        operator = operator_;
        lp = lp_;
        liquidator = makeAddr("liquidator");
        for (uint256 i; i < ACTORS; ++i) {
            (address a, uint256 k) = makeAddrAndKey(string.concat("actor", vm.toString(i)));
            actors.push(a);
            keyOf[a] = k;
        }
        for (uint256 m; m < feeds.length; ++m) {
            (, int256 answer,,,) = feeds[m].latestRoundData();
            postedPrice18[uint256(answer) * FEED_SCALE] = true;
        }
    }

    // ---------------------------------------------------------------- views for invariants

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function holdCount() external view returns (uint256) {
        return holdIds.length;
    }

    // ---------------------------------------------------------------- helpers

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _token(uint256 seed) internal view returns (TestToken) {
        return seed % 2 == 0 ? ausd : usdc;
    }

    function _now() internal view returns (uint64) {
        return uint64(vm.getBlockTimestamp());
    }

    function _balance(address who) internal view returns (uint256) {
        CoreAccount memory a = core.account(who);
        return uint256(a.ausd) + a.usdc;
    }

    /// @dev Balance + card debt of every tracked account, for the I5 "no transfer between accounts" check.
    function _snapshot() internal view returns (uint256[] memory s) {
        s = new uint256[](actors.length + 1);
        for (uint256 i; i < actors.length; ++i) {
            CoreAccount memory a = core.account(actors[i]);
            s[i] = uint256(a.ausd) + a.usdc + (uint256(a.cardDebt) << 128);
        }
        CoreAccount memory l = core.account(liquidator);
        s[actors.length] = uint256(l.ausd) + l.usdc + (uint256(l.cardDebt) << 128);
    }

    /// @dev I5: only `a` and `b` may have changed since `before`.
    function _onlyChanged(uint256[] memory before, address a, address b) internal {
        uint256[] memory afterSnap = _snapshot();
        for (uint256 i; i < before.length; ++i) {
            address who = i < actors.length ? actors[i] : liquidator;
            if (who == a || who == b) continue;
            if (before[i] != afterSnap[i]) ++ghostI5Violations;
        }
    }

    /// @dev Count Panic(uint256) reverts; any other revert is an expected rejection.
    function _noPanic(bytes memory reason) internal {
        if (reason.length >= 4 && bytes4(reason) == PANIC_SELECTOR) {
            ++ghostPanics;
            lastPanicAction = msg.sig;
        }
    }

    /// @dev I2 after a risk-increasing action.
    function _checkI2(address user) internal {
        Risk memory r = core.accountRisk(user);
        if (r.freeToTrade < 0) ++ghostI2Violations;
    }

    function _allowanceLeft(address user) internal view returns (uint256 left) {
        (, left) = core.allowance(user);
    }

    function _allowance(address user) internal view returns (Allowance memory al) {
        (al,) = core.allowance(user);
    }

    function _sign(address user, bytes32 digest) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(keyOf[user], digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Bring a market back to OPEN (fresh round, or confirm a circuit with in-band rounds over >= 300 s).
    function _heal(uint256 m) internal {
        MarketStatus st = oracle.peek(uint8(m)).status;
        (, int256 answer,,,) = feeds[m].latestRoundData();
        if (st == MarketStatus.STALE) {
            _pushPrice(m, answer);
        } else if (st == MarketStatus.CIRCUIT) {
            for (uint256 i; i < C.CONFIRM_ROUNDS; ++i) {
                vm.warp(vm.getBlockTimestamp() + C.CONFIRM_SECONDS / 2);
                vm.roll(vm.getBlockNumber() + C.CONFIRM_SECONDS / 2);
                _pushPrice(m, answer);
            }
        }
        oracle.observe(uint8(m));
    }

    function _signAllowance(address user, uint128 dailyLimit, uint64 expiry) internal {
        uint64 n = core.allowanceNonce(user);
        bytes32 structHash = keccak256(abi.encode(core.ALLOWANCE_TYPEHASH(), user, dailyLimit, expiry, n));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", core.DOMAIN_SEPARATOR(), structHash));
        core.setSpendAllowance(user, dailyLimit, expiry, _sign(user, digest));
    }

    /// @dev Top the actor up so a sized action can pass the margin check (the fuzzer favours 1-wei deposits).
    function _fund(address user, uint256 amount) internal {
        Risk memory r = core.accountRisk(user);
        if (r.freeToTrade >= int256(amount)) return;
        ausd.mint(user, amount);
        vm.startPrank(user);
        ausd.approve(address(core), amount);
        core.deposit(address(ausd), amount);
        vm.stopPrank();
    }

    function _pushPrice(uint256 marketId, int256 answer) internal {
        if (answer <= 0) return;
        feeds[marketId].push(answer);
        postedPrice18[uint256(answer) * FEED_SCALE] = true;
    }
}
