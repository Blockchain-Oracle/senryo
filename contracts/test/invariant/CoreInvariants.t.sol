// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console2} from "forge-std/console2.sol";
import {Constants as C} from "../../src/libraries/Constants.sol";
import {PerpMath} from "../../src/libraries/PerpMath.sol";
import {Account as CoreAccount, Book, MarketParams, MarketState} from "../../src/libraries/Types.sol";
import {Fixture} from "../utils/Fixture.sol";
import {TestToken} from "../utils/Mocks.sol";
import {Handler} from "./Handler.sol";

/// @notice Stateful invariants I1–I7 of specs/contracts.md over the real SenryoCore, SessionOracle and LpVault.
/// Handlers: deposit, withdraw, swap, increase, decrease, trigger, liquidate, LP deposit/redeem, oracle moves and
/// circuit jumps, time warps, allowance, envelope, place/increase/capture(under/exact/over/too much/expired)/release/
/// release-expired holds, refund, repay.
contract CoreInvariantsTest is StdInvariant, Fixture {
    Handler internal handler;

    function setUp() public {
        _deploy(true, MONDAY + 12 * HOUR);
        _seedBooks();
        handler = new Handler(core, oracle, vault, ausd, usdc, xau, xag, operator, lp);
        targetContract(address(handler));
        excludeSender(address(core));
        excludeSender(address(vault));
    }

    /// @notice I1 conservation: token balance of the core = Σ accounts + POOL + INSURANCE + CARD_FLOAT, per token.
    function invariant_I1_conservation() public view {
        _conservation(ausd, true);
        _conservation(usdc, false);
    }

    /// @notice I2 no double pledge: after any risk-increasing action IM + max(R, H) + B ≤ E_init.
    function invariant_I2_noDoublePledge() public view {
        assertEq(handler.ghostI2Violations(), 0);
    }

    /// @notice I3 Σ open holds = Σ Account.holds; each hold captured at most once.
    function invariant_I3_holds() public view {
        assertTrue(handler.holdsConsistent(), "open holds == Account.holds");
        assertEq(handler.ghostDoubleCaptures(), 0, "captured at most once");
    }

    /// @notice I4 reserve: Σ max profit ≤ poolCash × MAX_RESERVE_UTIL_BPS.
    function invariant_I4_reserve() public view {
        uint256 reserved;
        for (uint8 id; id < core.marketCount(); ++id) {
            MarketState memory s = core.marketState(id);
            MarketParams memory m = core.marketParams(id);
            reserved += PerpMath.bpsUp(uint256(s.longNotional) + s.shortNotional, m.maxProfitBps);
        }
        (uint256 a, uint256 u) = core.book(Book.POOL);
        assertLe(reserved, (a + u) * C.MAX_RESERVE_UTIL_BPS / C.BPS);
    }

    /// @notice I5 only liquidation, capture and refund move value between two different accounts.
    function invariant_I5_noCrossAccountMoves() public view {
        assertEq(handler.ghostI5Violations(), 0);
    }

    /// @notice I6 prices enter only via SessionOracle.observe: every accepted price is a feed answer.
    function invariant_I6_pricesFromFeedOnly() public view {
        for (uint8 id; id < core.marketCount(); ++id) {
            (uint128 last,,,,,,) = oracle.states(id);
            assertTrue(last == 0 || handler.postedPrice18(last), "accepted price was posted by the feed");
        }
    }

    /// @notice I7 holds never exceed the live spend allowance (D-032).
    function invariant_I7_allowance() public view {
        assertEq(handler.ghostI7Violations(), 0);
    }

    /// @notice Per-run coverage log (`-vv`): successful calls per handler action, so a vacuous pass is visible.
    function afterInvariant() external view {
        string[18] memory names = [
            "deposit",
            "withdraw",
            "swap",
            "increase",
            "decrease",
            "trigger",
            "liquidate",
            "lpDeposit",
            "lpClaim",
            "oracleMove",
            "oracleJump",
            "setAllowance",
            "setEnvelope",
            "placeHold",
            "increaseHold",
            "capture",
            "release",
            "refund"
        ];
        string memory line = "calls:";
        for (uint256 i; i < names.length; ++i) {
            line = string.concat(line, " ", names[i], "=", vm.toString(handler.calls(bytes32(bytes(names[i])))));
        }
        console2.log(line);
    }

    function _conservation(TestToken token, bool isAusd) internal view {
        uint256 sum;
        for (uint256 i; i < handler.actorCount(); ++i) {
            CoreAccount memory a = core.account(handler.actors(i));
            sum += isAusd ? a.ausd : a.usdc;
        }
        CoreAccount memory l = core.account(handler.liquidator());
        sum += isAusd ? l.ausd : l.usdc;
        for (uint8 b; b <= uint8(Book.CARD_FLOAT); ++b) {
            (uint256 a_, uint256 u_) = core.book(Book(b));
            sum += isAusd ? a_ : u_;
        }
        assertEq(token.balanceOf(address(core)), sum);
    }
}
